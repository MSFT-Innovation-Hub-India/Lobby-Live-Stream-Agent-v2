const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');

class FrameAnalysisService {
  constructor() {
    this.captureDir = path.join(__dirname, '..', 'captures');
    this.captureInterval = null;
    this.analyzedFrames = [];
    this.rtspUrl = null;
    this.isCapturing = false;
    this.maxFrames = parseInt(process.env.MAX_ANALYZED_FRAMES) || 10;
    this.streamService = null; // Will be set when starting capture
    this.failedCaptureCount = 0;
    this.maxFailedCaptures = 5;
    this.captureIntervalMs = parseInt(process.env.FRAME_CAPTURE_INTERVAL) || 60000; // Default 60 seconds

    // Ensure capture directory exists
    if (!fs.existsSync(this.captureDir)) {
      fs.mkdirSync(this.captureDir, { recursive: true });
    }

    // Initialize Azure OpenAI client
    this.openaiClient = null;
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';
    if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY) {
      this.openaiClient = new OpenAIClient(
        process.env.AZURE_OPENAI_ENDPOINT,
        new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
      );
    }
  }

  // Start capturing frames at 1-minute intervals
  startCapture(rtspUrl, streamService = null) {
    if (this.isCapturing) {
      console.log('Frame capture is already running');
      return { success: true, message: 'Frame capture is already running' };
    }

    this.rtspUrl = rtspUrl;
    this.streamService = streamService;
    this.isCapturing = true;
    this.failedCaptureCount = 0;

    // Capture immediately, then every minute
    this.captureAndAnalyzeFrame();
    
    // Set interval based on environment variable (default 60000 ms = 1 minute)
    this.captureInterval = setInterval(() => {
      this.captureAndAnalyzeFrame();
    }, this.captureIntervalMs);

    console.log(`Frame capture started - capturing every ${this.captureIntervalMs / 1000} seconds`);
    return { success: true, message: 'Frame capture started' };
  }

  // Stop capturing frames
  stopCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
      this.isCapturing = false;
      this.failedCaptureCount = 0;
      console.log('Frame capture stopped');
      return { success: true, message: 'Frame capture stopped' };
    }
    return { success: false, message: 'No capture is running' };
  }

  // Capture a single frame from RTSP stream and analyze it
  async captureAndAnalyzeFrame() {
    if (!this.rtspUrl) {
      console.error('No RTSP URL configured');
      return;
    }

    // Check if stream is running (if streamService is available)
    if (this.streamService) {
      const streamStatus = this.streamService.getStatus();
      if (!streamStatus.isStreaming) {
        console.log('Skipping frame capture - stream is not running. Waiting for stream to restart...');
        return;
      }
    }

    const timestamp = Date.now();
    const filename = `frame_${timestamp}.jpg`;
    const filepath = path.join(this.captureDir, filename);

    console.log(`Capturing frame at ${new Date(timestamp).toISOString()}`);

    // Use FFmpeg to capture a single frame
    const ffmpeg = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', this.rtspUrl,
      '-frames:v', '1',
      '-q:v', '2',
      '-y',
      filepath
    ]);

    let errorOutput = '';

    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // Log FFmpeg output for debugging
      if (data.toString().includes('error') || data.toString().includes('Error')) {
        console.error('FFmpeg stderr:', data.toString().substring(0, 200));
      }
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0 && fs.existsSync(filepath)) {
        console.log(`Frame captured successfully: ${filename}`);
        this.failedCaptureCount = 0; // Reset on success
        
        // Analyze the frame with Azure OpenAI
        try {
          const analysis = await this.analyzeFrame(filepath);
          
          // Store the analyzed frame info
          const frameData = {
            id: timestamp,
            filename: filename,
            filepath: `/captures/${filename}`,
            timestamp: timestamp,
            capturedAt: new Date(timestamp).toISOString(),
            analysis: analysis,
          };

          this.analyzedFrames.unshift(frameData);
          
          // Keep only configured number of analyzed frames
          if (this.analyzedFrames.length > this.maxFrames) {
            const removed = this.analyzedFrames.pop();
            // Optionally delete old frame file
            const oldFilePath = path.join(this.captureDir, removed.filename);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }

          console.log(`Frame analyzed successfully`);
        } catch (error) {
          console.error('Error analyzing frame:', error.message);
        }
      } else {
        this.failedCaptureCount++;
        console.error(`Failed to capture frame (${this.failedCaptureCount}/${this.maxFailedCaptures}). Exit code: ${code}`);
        
        // If too many failures, stop trying
        if (this.failedCaptureCount >= this.maxFailedCaptures) {
          console.error(`Maximum failed captures reached. Stopping frame capture. Please check RTSP connection.`);
          this.stopCapture();
        }
        
        if (errorOutput.length > 0) {
          console.error('FFmpeg output:', errorOutput.substring(Math.max(0, errorOutput.length - 500)));
        }
      }
    });

    ffmpeg.on('error', (error) => {
      console.error('FFmpeg spawn error:', error.message);
    });
  }

  // Analyze frame using Azure OpenAI GPT-4o
  async analyzeFrame(imagePath) {
    if (!this.openaiClient) {
      console.warn('Azure OpenAI client not configured');
      return 'Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY environment variables.';
    }

    try {
      // Read and encode image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Call Azure OpenAI with vision capabilities
      const analysisPrompt = `You are an AI security analyst monitoring a lobby/reception area. Analyze this frame and provide a JSON response with the following structure:
{
    "timestamp": "current_time",
    "persons_near_doors": number,
    "persons_at_reception": number,
    "persons_in_other_areas": number,
    "total_persons": number,
    "scene_description": "markdown_formatted_description"
}

CRITICAL COUNTING INSTRUCTIONS - READ CAREFULLY:
• FIRST: Carefully scan the ENTIRE image from edge to edge, including all corners and distant areas
• IDENTIFY: Look for ALL human figures - standing, sitting, walking, or partially visible
• COUNT EVERYONE: Every person you see must be included, even if partially obscured or at a distance
• VERIFY: After counting, double-check by scanning the image again to ensure no one was missed
• "persons_near_doors": Count people within 2-3 meters of entrance/exit doors
• "persons_at_reception": Count people at or immediately near the reception desk
• "persons_in_other_areas": Count people in waiting areas, walking through lobby, or anywhere else
• "total_persons": MUST equal persons_near_doors + persons_at_reception + persons_in_other_areas
• ACCURACY CHECK: If you see 2 people, total_persons must be 2. If you see 5 people, total_persons must be 5
• DO NOT default to 0 - if you see people in the image, COUNT THEM ALL

For the SCENE_DESCRIPTION field:
- The very first line should be a creative, witty caption returned AS AN HTML SNIPPET only (not markdown). The HTML must be a single line using the class 'ai-caption'.

CREATIVITY GUIDELINES for the caption - BE DYNAMIC AND OBSERVANT:
• FOCUS ON WHAT'S ACTUALLY HAPPENING: Comment on the specific activity, behavior, or situation you observe
• AVOID generic starts like "In this lobby..." or "The lobby..." - be specific about the ACTION or SCENE
• Observe specific behaviors and interactions:
  - Busy reception? Comment on the queue, service interaction, or multitasking
  - People waiting? Note their body language, patience levels, phone usage
  - Doors/gates in motion? Comment on the flow, entry/exit patterns
  - Lift area activity? Note the waiting, anticipation, or rush
  - Empty space? Observe the calm, the architecture's moment to shine, or the "before the storm" feel
  - Fire extinguisher visible? Make a witty safety observation
  - Plants, furniture, lighting? Note how they set the mood
• Use varied humor styles: observational wit, gentle irony, playful metaphors, situational comedy, social commentary
• Reference different themes based on what you SEE: office culture, human nature, architectural design, technology, social dynamics, time of day, energy levels
• VARY your opening words - use action verbs, observations, questions, or scene-setters
• Make each caption unique to what's happening in THIS specific frame

Examples showing VARIETY and SPECIFICITY:
- <span class="ai-caption">Rush hour choreography: three people, three destinations, one perfectly timed door avoidance dance.</span>
- <span class="ai-caption">Reception desk operating at full capacity while the lobby's geometric carpet patiently awaits its next set of footprints.</span>
- <span class="ai-caption">That fire extinguisher has seen more action in safety drills than it ever will in real life.</span>
- <span class="ai-caption">Two at reception, one contemplating the elevator buttons — the eternal triangle of lobby decision-making.</span>
- <span class="ai-caption">Early morning tranquility: even the plants look half-asleep before the caffeine crowd arrives.</span>
- <span class="ai-caption">Queue formation in progress — observe the careful maintenance of personal space boundaries.</span>
- <span class="ai-caption">Lift doors closing while someone power-walks from the entrance — the daily gamble begins.</span>
- <span class="ai-caption">The reception desk: where multitasking meets marathon patience, one visitor at a time.</span>
- <span class="ai-caption">Architectural minimalism gets a reality check as actual humans add delightful chaos to the clean lines.</span>

DO NOT use repetitive patterns or generic lobby descriptions. Each caption should reflect the SPECIFIC scene you're analyzing.

- Following that first HTML line, include the rest of the scene description as markdown using exactly this structure (with ONE blank line between header and content and ONE blank line between sections):

**🏢 Location & Environment:**
[Brief description of setting and lighting conditions]

**👥 People & Activities:**
[Describe ALL people visible - their locations (near doors, at reception, in other areas) and actions]

**🔍 Notable Elements:**
[Signs, equipment, furniture, or any unusual activities observed]

**📊 Overall Status:**
[General assessment - busy/quiet, normal operations, any security concerns]

IMPORTANT: Use exactly ONE blank line between each section header and content, and ONE blank line between sections. The first (HTML) line should be one single HTML element only. VERIFY that total_persons equals the sum of persons_near_doors + persons_at_reception + persons_in_other_areas. Return ONLY valid JSON, no other text.`;

      const response = await this.openaiClient.getChatCompletions(
        this.deploymentName,
        [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: analysisPrompt
              },
              {
                type: 'image_url',
                imageUrl: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        { 
          maxTokens: 1000,
          temperature: 0.3  // Lower temperature for more accurate, consistent counting
        }
      );

      const rawAnalysis = response.choices[0]?.message?.content || 'No analysis available';
      
      // Try to parse JSON response
      try {
        // Extract JSON from markdown code blocks if present
        let jsonStr = rawAnalysis;
        const jsonMatch = rawAnalysis.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        }
        
        const parsedAnalysis = JSON.parse(jsonStr);
        return parsedAnalysis;
      } catch (parseError) {
        console.warn('Failed to parse JSON response, returning raw text:', parseError.message);
        console.warn('Raw response:', rawAnalysis);
        // Return in expected format even if parsing fails
        return {
          timestamp: new Date().toISOString(),
          persons_near_doors: 0,
          persons_at_reception: 0,
          persons_in_other_areas: 0,
          total_persons: 0,
          scene_description: rawAnalysis
        };
      }
    } catch (error) {
      console.error('Error in Azure OpenAI analysis:', error.message);
      return `Error analyzing frame: ${error.message}`;
    }
  }

  // Get all analyzed frames
  getAnalyzedFrames() {
    return this.analyzedFrames;
  }

  // Get capture status
  getStatus() {
    return {
      isCapturing: this.isCapturing,
      frameCount: this.analyzedFrames.length,
      rtspUrl: this.rtspUrl,
      deploymentName: this.deploymentName,
      failedCaptureCount: this.failedCaptureCount,
      maxFailedCaptures: this.maxFailedCaptures
    };
  }
}

module.exports = new FrameAnalysisService();
