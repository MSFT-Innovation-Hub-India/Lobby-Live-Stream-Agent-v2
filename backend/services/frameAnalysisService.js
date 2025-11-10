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
  startCapture(rtspUrl) {
    if (this.isCapturing) {
      console.log('Frame capture is already running');
      return { success: true, message: 'Frame capture is already running' };
    }

    this.rtspUrl = rtspUrl;
    this.isCapturing = true;

    // Capture immediately, then every minute
    this.captureAndAnalyzeFrame();
    
    // Set interval for 1 minute (60000 ms)
    this.captureInterval = setInterval(() => {
      this.captureAndAnalyzeFrame();
    }, 60000);

    console.log('Frame capture started - capturing every 60 seconds');
    return { success: true, message: 'Frame capture started' };
  }

  // Stop capturing frames
  stopCapture() {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
      this.isCapturing = false;
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
    });

    ffmpeg.on('close', async (code) => {
      if (code === 0 && fs.existsSync(filepath)) {
        console.log(`Frame captured successfully: ${filename}`);
        
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
        console.error(`Failed to capture frame. Exit code: ${code}`);
        console.error('FFmpeg error:', errorOutput.substring(0, 500));
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
      const response = await this.openaiClient.getChatCompletions(
        this.deploymentName,
        [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please analyze this frame from a lobby surveillance camera. Describe what you see, including people, activities, objects, and any notable events or situations. Be specific and detailed.'
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
        { maxTokens: 500 }
      );

      const analysis = response.choices[0]?.message?.content || 'No analysis available';
      return analysis;
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
      rtspUrl: this.rtspUrl
    };
  }
}

module.exports = new FrameAnalysisService();
