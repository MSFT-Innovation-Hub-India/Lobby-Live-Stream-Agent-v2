const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { OpenAIClient, AzureKeyCredential } = require('@azure/openai');
const { DefaultAzureCredential } = require('@azure/identity');

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

    // Load system prompt and scenario config
    this.promptsDir = path.join(__dirname, '..', 'system-prompts');
    this.promptProfile = process.env.PROMPT_PROFILE || 'hub-lobby-default';
    this.analysisPrompt = this.loadPrompt(this.promptProfile);
    this.scenarioConfig = this.loadScenarioConfig(this.promptProfile);

    // Initialize Azure OpenAI client
    this.openaiClient = null;
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';
    if (process.env.AZURE_OPENAI_ENDPOINT) {
      if (process.env.AZURE_OPENAI_API_KEY) {
        // Use API key if provided
        this.openaiClient = new OpenAIClient(
          process.env.AZURE_OPENAI_ENDPOINT,
          new AzureKeyCredential(process.env.AZURE_OPENAI_API_KEY)
        );
        console.log('Azure OpenAI initialized with API key');
      } else {
        // Fall back to DefaultAzureCredential (Managed Identity, Azure CLI, etc.)
        this.openaiClient = new OpenAIClient(
          process.env.AZURE_OPENAI_ENDPOINT,
          new DefaultAzureCredential()
        );
        console.log('Azure OpenAI initialized with DefaultAzureCredential');
      }
    }
  }

  // Load prompt from external file
  loadPrompt(profile) {
    const promptPath = path.join(__dirname, '..', 'system-prompts', profile, 'analysis-prompt.txt');
    try {
      if (fs.existsSync(promptPath)) {
        const prompt = fs.readFileSync(promptPath, 'utf8');
        console.log(`Loaded prompt profile: ${profile}`);
        return prompt;
      } else {
        console.warn(`Prompt file not found at ${promptPath}, using default`);
        return this.getDefaultPrompt();
      }
    } catch (error) {
      console.error(`Error loading prompt file: ${error.message}`);
      return this.getDefaultPrompt();
    }
  }

  // Load scenario config from JSON file
  loadScenarioConfig(profile) {
    const configPath = path.join(this.promptsDir, profile, 'scenario-config.json');
    try {
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log(`Loaded scenario config: ${config.name}`);
        return config;
      }
    } catch (error) {
      console.error(`Error loading scenario config: ${error.message}`);
    }
    return null;
  }

  // List all available scenarios
  getAvailableScenarios() {
    const scenarios = [];
    try {
      const dirs = fs.readdirSync(this.promptsDir, { withFileTypes: true });
      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const config = this.loadScenarioConfig(dir.name);
          if (config) {
            scenarios.push({
              id: config.id,
              name: config.name,
              description: config.description,
              active: dir.name === this.promptProfile
            });
          }
        }
      }
    } catch (error) {
      console.error('Error listing scenarios:', error.message);
    }
    return scenarios;
  }

  // Get active scenario config
  getActiveScenarioConfig() {
    return this.scenarioConfig;
  }

  // Switch active scenario
  switchScenario(scenarioId) {
    const configPath = path.join(this.promptsDir, scenarioId, 'scenario-config.json');
    if (!fs.existsSync(configPath)) {
      return { success: false, message: `Scenario '${scenarioId}' not found` };
    }

    this.promptProfile = scenarioId;
    this.analysisPrompt = this.loadPrompt(scenarioId);
    this.scenarioConfig = this.loadScenarioConfig(scenarioId);
    this.analyzedFrames = []; // Clear frames from previous scenario
    console.log(`Switched to scenario: ${this.scenarioConfig?.name || scenarioId}`);
    return { success: true, message: `Switched to ${this.scenarioConfig?.name || scenarioId}`, config: this.scenarioConfig };
  }

  // Fallback default prompt
  getDefaultPrompt() {
    return `You are an AI security analyst monitoring a lobby/reception area. Analyze this frame and provide a JSON response with person counts and scene description.`;
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
      return 'Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT (and optionally AZURE_OPENAI_API_KEY) environment variables.';
    }

    try {
      // Read and encode image to base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Call Azure OpenAI with vision capabilities using externalized prompt
      const response = await this.openaiClient.getChatCompletions(
        this.deploymentName,
        [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.analysisPrompt
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
      maxFailedCaptures: this.maxFailedCaptures,
      activeScenario: this.promptProfile,
      scenarioConfig: this.scenarioConfig
    };
  }
}

module.exports = new FrameAnalysisService();
