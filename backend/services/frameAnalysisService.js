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

    // Model mode: 'cloud' (Azure OpenAI) or 'edge' (local SLM via Ollama)
    this.modelMode = process.env.MODEL_MODE || 'cloud';
    this.slmUrl = process.env.SLM_URL || 'http://localhost:8000';
    this.vllmModel = process.env.VLLM_MODEL || 'microsoft/Phi-4-multimodal-instruct';
    this._lastSLMHealthy = null;
    this._lastSLMTimeouts = 0;
    // Load edge-specific prompt if starting in edge mode
    if (this.modelMode === 'edge') {
      this.edgePrompt = this.loadPrompt(this.promptProfile, 'edge');
    }

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
  loadPrompt(profile, variant) {
    const suffix = variant ? `-${variant}` : '';
    const promptPath = path.join(__dirname, '..', 'system-prompts', profile, `analysis-prompt${suffix}.txt`);
    try {
      if (fs.existsSync(promptPath)) {
        const prompt = fs.readFileSync(promptPath, 'utf8');
        console.log(`Loaded prompt profile: ${profile}${suffix}`);
        return prompt;
      } else if (variant) {
        // Fall back to the default prompt if variant not found
        console.log(`Edge prompt not found for ${profile}, falling back to default prompt`);
        return this.loadPrompt(profile);
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
    // Also reload edge prompt if we're in edge mode
    if (this.modelMode === 'edge') {
      this.edgePrompt = this.loadPrompt(scenarioId, 'edge');
    }
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
          
          // Skip storing frames where analysis returned an error string
          // (e.g. SLM unavailable, timeout). This prevents the frontend from
          // showing stale "Scene Analysis in Progress" entries.
          if (typeof analysis === 'string' && analysis.startsWith('Error')) {
            console.warn('Skipping frame storage — analysis returned error:', analysis.substring(0, 120));
            return;
          }
          if (typeof analysis === 'string' && analysis.includes('unavailable')) {
            console.warn('Skipping frame storage — SLM unavailable:', analysis.substring(0, 120));
            return;
          }

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

  // Get current model mode
  getModelMode() {
    return {
      mode: this.modelMode,
      slmUrl: this.slmUrl,
      cloudDeployment: this.deploymentName
    };
  }

  // Set model mode
  setModelMode(mode, slmUrl) {
    if (mode !== 'cloud' && mode !== 'edge') {
      return { success: false, message: 'Invalid mode. Use "cloud" or "edge".' };
    }
    this.modelMode = mode;
    if (slmUrl) {
      this.slmUrl = slmUrl;
    }
    // Reload prompt — use edge variant if available when in edge mode
    if (mode === 'edge') {
      this.edgePrompt = this.loadPrompt(this.promptProfile, 'edge');
    }
    console.log(`Model mode switched to: ${mode}${mode === 'edge' ? ` (${this.slmUrl})` : ` (${this.deploymentName})`}`);
    return { success: true, mode: this.modelMode, slmUrl: this.slmUrl };
  }

  // Analyze frame — dispatch to cloud or edge
  async analyzeFrame(imagePath) {
    if (this.modelMode === 'edge') {
      return this.analyzeFrameWithSLM(imagePath);
    }
    return this.analyzeFrameWithCloud(imagePath);
  }

  // Check if vLLM is healthy and the model is available
  async checkSLMHealth() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${this.slmUrl}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) return false;
      return true;
    } catch (error) {
      console.error('vLLM health check error:', error.message);
      return false;
    }
  }

  // Analyze frame using local SLM via vLLM (OpenAI-compatible API)
  async analyzeFrameWithSLM(imagePath) {
    try {
      // Pre-flight health check — skip inference if vLLM is down
      const healthy = await this.checkSLMHealth();
      if (!healthy) {
        console.warn('vLLM health check failed — skipping this frame analysis');
        return 'Edge SLM is currently unavailable (health check failed). Will retry next cycle.';
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');

      // Use edge-specific prompt if available, otherwise fall back to default
      const prompt = this.edgePrompt || this.analysisPrompt;

      // Timeout after 120 seconds
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);

      let response;
      try {
        response = await fetch(`${this.slmUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model: this.vllmModel,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
                  { type: 'text', text: prompt }
                ]
              }
            ],
            max_tokens: 300,
            temperature: 0.4
          })
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json();
      const rawAnalysis = data.choices?.[0]?.message?.content || JSON.stringify(data);
      console.log('SLM raw response (first 800 chars):', rawAnalysis.substring(0, 800));

      // Detect model refusal — the model sometimes claims it cannot see images
      if (this.isModelRefusal(rawAnalysis)) {
        console.warn('SLM returned a refusal response — image may not have been processed. Retrying once...');
        // Retry the request once
        const retryResponse = await fetch(`${this.slmUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.vllmModel,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
                  { type: 'text', text: prompt }
                ]
              }
            ],
            max_tokens: 300,
            temperature: 0.4
          })
        });
        const retryData = await retryResponse.json();
        const retryAnalysis = retryData.choices?.[0]?.message?.content || '';
        console.log('SLM retry response (first 800 chars):', retryAnalysis.substring(0, 800));
        if (this.isModelRefusal(retryAnalysis)) {
          console.error('SLM retry also returned refusal — skipping this frame');
          return 'Error: Model refused to analyze image';
        }
        const retryResult = this.buildResponseFromSLM(retryAnalysis);
        console.log('SLM retry caption:', (retryResult.scene_description || '').substring(0, 150));
        return retryResult;
      }

      // Build structured response — detect JSON vs plain markdown output
      const result = this.buildResponseFromSLM(rawAnalysis);
      console.log('SLM caption:', (result.scene_description || '').substring(0, 150));
      return result;
    } catch (error) {
      const msg = error.name === 'AbortError' ? 'vLLM request timed out after 120s' : error.message;
      console.error('Error in vLLM analysis:', msg);
      return `Error analyzing frame with edge SLM: ${msg}`;
    }
  }

  // Route SLM output to the correct parser based on format (JSON vs markdown)
  buildResponseFromSLM(rawText) {
    const text = rawText.trim();

    // Detect JSON output (from prompts like ai-first-bank that request JSON)
    // The model may wrap it in ```json ... ``` fences
    const jsonBody = text.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (jsonBody.startsWith('{')) {
      try {
        const parsed = JSON.parse(jsonBody);
        if (parsed.title && parsed.scene) {
          // New format: { title, scene, alerts }
          const result = this.buildResponseFromTitleSceneJSON(parsed);
          return result;
        }
        if (parsed.scene_description) {
          const result = this.buildResponseFromJSON(parsed);
          return this.postProcessSLMResponse(result, text);
        }
      } catch {
        // JSON parse failed — may be truncated. Try regex extraction.
        // Try new { title, scene } format first
        const titleMatch = jsonBody.match(/"title"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
        const sceneMatch = jsonBody.match(/"scene"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
        if (titleMatch && sceneMatch) {
          const title = titleMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          const scene = sceneMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          return this.buildResponseFromTitleSceneJSON({ title, scene, alerts: {} });
        }
        const partialResult = this.buildResponseFromPartialJSON(jsonBody);
        if (partialResult) return this.postProcessSLMResponse(partialResult, text);
      }
    }

    // Fall back to plain markdown parser
    return this.buildResponseFromMarkdown(text);
  }

  // Detect model refusal responses where it claims it cannot see images
  isModelRefusal(text) {
    const lower = text.toLowerCase();
    return (
      lower.includes("i'm unable to view images") ||
      lower.includes("i cannot view images") ||
      lower.includes("i'm unable to see images") ||
      lower.includes("i cannot see images") ||
      lower.includes("as an ai text-based model") ||
      lower.includes("as a text-based ai") ||
      lower.includes("i don't have the ability to view") ||
      lower.includes("i cannot directly view") ||
      lower.includes("i'm not able to view images")
    );
  }

  // Build structured response from the new { title, scene, alerts } JSON format
  buildResponseFromTitleSceneJSON(parsed) {
    const title = parsed.title || 'Bank Lobby Scene';
    const scene = parsed.scene || '';
    const alerts = parsed.alerts || {};

    // Build alert message from alerts object
    const alertParts = [];
    if (alerts.wheelchair_or_walking_stick) alertParts.push('Person with wheelchair or walking stick detected');
    if (alerts.child_visible) alertParts.push('Child detected in the lobby');
    const alertMessage = alertParts.length > 0 ? alertParts.join('; ') : null;

    const htmlCaption = `<span class="ai-caption">${title}</span>`;
    const sceneSection = `**🎬 Scene Analysis:**\n${scene}`;
    const sceneDescription = `${htmlCaption}\n\n${sceneSection}`;

    return {
      timestamp: new Date().toISOString(),
      total_persons: 0,
      persons_near_doors: 0,
      persons_at_reception: 0,
      persons_in_other_areas: 0,
      children_detected: alerts.child_visible ? 1 : 0,
      persons_needing_assistance: alerts.wheelchair_or_walking_stick ? 1 : 0,
      scene_description: sceneDescription,
      alert_message: alertMessage,
      _edgeMode: true
    };
  }

  // Build structured response from a fully-parsed JSON object
  buildResponseFromJSON(parsed) {
    return {
      timestamp: new Date().toISOString(),
      total_persons: parsed.total_persons || 0,
      persons_near_doors: parsed.persons_near_doors || 0,
      persons_at_reception: parsed.persons_at_reception || 0,
      persons_in_other_areas: parsed.persons_in_other_areas || 0,
      scene_description: parsed.scene_description,
      alert_message: parsed.alert_required ? (parsed.alert_message || null) : null,
      _edgeMode: true
    };
  }

  // Extract fields from truncated/partial JSON using regex
  buildResponseFromPartialJSON(text) {
    // Try to extract scene_description
    const descMatch = text.match(/"scene_description"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
    if (!descMatch) return null;

    const sceneDesc = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const alertMatch = text.match(/"alert_required"\s*:\s*(true|false)/i);
    const alertMsgMatch = text.match(/"alert_message"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/);

    return {
      timestamp: new Date().toISOString(),
      total_persons: 0,
      persons_near_doors: 0,
      persons_at_reception: 0,
      persons_in_other_areas: 0,
      scene_description: sceneDesc,
      alert_message: (alertMatch && alertMatch[1] === 'true' && alertMsgMatch) ? alertMsgMatch[1] : null,
      _edgeMode: true
    };
  }

  // Build the structured response object from the model's plain markdown output.
  // This avoids requiring the SLM to produce valid JSON — much more reliable.
  buildResponseFromMarkdown(rawText) {
    const text = rawText.trim();

    // Extract caption from "CAPTION: ..." line
    let caption = '';
    const captionMatch = text.match(/^CAPTION:\s*(.+)$/m);
    if (captionMatch) {
      caption = captionMatch[1].trim();
    } else {
      // Fallback: use the first non-empty line that isn't a section header
      const firstLine = text.split('\n').find(l => l.trim().length > 10 && !l.startsWith('ENVIRONMENT') && !l.startsWith('PEOPLE') && !l.startsWith('SCENE'));
      if (firstLine) caption = firstLine.trim();
    }

    // Extract people count from "PEOPLE COUNT: N" line
    let totalPersons = 0;
    const countMatch = text.match(/PEOPLE COUNT:\s*(\d+)/i);
    if (countMatch) {
      totalPersons = parseInt(countMatch[1], 10);
    }

    // Extract sections and reformat with emojis for the frontend
    const sections = [];
    const sectionMap = [
      { key: 'ENVIRONMENT:', emoji: '🏢', title: 'Location & Environment' },
      { key: 'PEOPLE:', emoji: '👥', title: 'People & Activities' },
      { key: 'DETAILS:', emoji: '🔍', title: 'Notable Elements' },
      { key: 'STATUS:', emoji: '📊', title: 'Overall Status' },
      { key: 'SCENE:', emoji: '🎬', title: 'Scene Analysis' }
    ];

    for (const sec of sectionMap) {
      const regex = new RegExp(`^${sec.key}\\s*(.+?)(?=^(?:ENVIRONMENT:|PEOPLE:|DETAILS:|STATUS:|SCENE:|PEOPLE COUNT:)|$)`, 'ms');
      const match = text.match(regex);
      if (match && match[1].trim()) {
        sections.push(`**${sec.emoji} ${sec.title}:**\n${match[1].trim()}`);
      }
    }

    // Build scene_description: HTML caption + formatted sections
    const htmlCaption = caption
      ? `<span class="ai-caption">${caption}</span>`
      : '<span class="ai-caption">Analyzing the lobby scene...</span>';

    const body = sections.length > 0
      ? sections.join('\n\n')
      : text.replace(/^CAPTION:.*$/m, '').replace(/^SCENE:.*$/m, '').replace(/PEOPLE COUNT:.*$/im, '').trim();

    const sceneDescription = `${htmlCaption}\n\n${body}`;

    return {
      timestamp: new Date().toISOString(),
      total_persons: totalPersons,
      persons_near_doors: 0,
      persons_at_reception: 0,
      persons_in_other_areas: 0,
      scene_description: sceneDescription,
      alert_message: null,
      _edgeMode: true
    };
  }

  // Extract numeric counts and scene text from a truncated/invalid JSON response
  extractCountsFromRawText(rawText) {
    const extract = (key) => {
      const match = rawText.match(new RegExp(`"${key}"\\s*:\\s*(\\d+)`));
      return match ? parseInt(match[1], 10) : 0;
    };

    // Extract scene_description even from broken JSON
    let sceneDesc = '';
    const descMatch = rawText.match(/"scene_description"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|$)/);
    if (descMatch) {
      // Unescape JSON string escapes
      sceneDesc = descMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    // Extract alert_message (string or null)
    let alertMsg = null;
    const alertMatch = rawText.match(/"alert_message"\s*:\s*"([\s\S]*?)(?:"\s*[,}])/);
    if (alertMatch) {
      alertMsg = alertMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    return {
      timestamp: new Date().toISOString(),
      persons_near_doors: extract('persons_near_doors'),
      persons_at_reception: extract('persons_at_reception'),
      persons_in_other_areas: extract('persons_in_other_areas'),
      children_detected: extract('children_detected'),
      persons_needing_assistance: extract('persons_needing_assistance'),
      waiting_customers: extract('waiting_customers'),
      total_persons: extract('total_persons'),
      alert_message: alertMsg,
      scene_description: sceneDesc || rawText
    };
  }

  // Post-process SLM response to match the format the frontend expects.
  // The SLM often follows the prompt well but may not wrap the caption in HTML.
  // This method only adds the HTML caption if missing — it preserves the SLM's
  // own scene_description content (markdown sections, details, etc.).
  postProcessSLMResponse(parsed, rawAnalysis) {
    if (!parsed || typeof parsed !== 'object') return parsed;

    const desc = parsed.scene_description || '';

    // If the SLM already produced the HTML caption, nothing to do
    if (desc.includes('<span class="ai-caption">') || desc.includes("<span class='ai-caption'>")) {
      return parsed;
    }

    // Check if the SLM returned structured markdown (section headers like **🏢 ...**)
    const hasMarkdownSections = /\*\*[🏢🏦👥🎯🔍📊]/.test(desc);

    const total = parsed.total_persons ?? 0;

    // Build an HTML caption from the SLM's text
    let caption;
    if (hasMarkdownSections) {
      // SLM followed the prompt — extract caption from text before the first section header
      // The prompt asks for a title line like "### A bustling lobby scene..." before sections
      const preHeader = desc.split(/\*\*/)[0].trim();
      const cleanPre = preHeader.replace(/^#+\s*/, '').replace(/#+\s*$/, '').trim();
      if (cleanPre.length > 10) {
        caption = cleanPre.replace(/[.\s]+$/, '');
        if (caption.length > 150) caption = caption.substring(0, 147) + '...';
      }
    }

    if (!caption) {
      // Try to extract from the first real sentence
      const cleanDesc = desc.replace(/\*\*[^*]*\*\*:?\s*/g, '').replace(/^#+\s*/gm, '');
      const sentences = cleanDesc.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
      if (sentences.length > 0) {
        caption = sentences[0].trim().replace(/[.\s]+$/, '');
        if (caption.length > 150) caption = caption.substring(0, 147) + '...';
      }
    }

    if (!caption) {
      // Fallback — synthesize from counts
      const metricParts = [];
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && v > 0 && k !== 'timestamp' && k !== 'total_persons') {
          metricParts.push(`${v} ${k.replace(/_/g, ' ')}`);
        }
      }
      caption = metricParts.length > 0
        ? `Edge SLM detects: ${metricParts.join(', ')} (${total} total)`
        : (total > 0
          ? `Edge SLM detects ${total} person${total !== 1 ? 's' : ''} in the scene`
          : 'Edge SLM reports a quiet scene — no people detected');
    }

    const htmlCaption = `<span class="ai-caption">${caption}.</span>`;

    if (hasMarkdownSections) {
      // SLM already produced good structured content — just prepend the HTML caption
      // Remove any leading ### title line since we replaced it with the HTML caption
      const withoutTitle = desc.replace(/^#+\s*[^\n]*\n*/, '').trim();
      parsed.scene_description = `${htmlCaption}\n\n${withoutTitle}`;
    } else if (desc.length > 20) {
      // SLM returned unstructured text — wrap it in sections using the active scenario
      const sections = this.scenarioConfig?.sceneSections;
      if (sections && sections.length > 0) {
        const sectionLines = sections.map(s =>
          `**${s.emoji} ${s.title}:**\n${desc}`
        );
        // Only use the description in the first content section, summarize rest
        const countSummary = [];
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && k !== 'timestamp') {
            countSummary.push(`- ${k.replace(/_/g, ' ')}: **${v}**`);
          }
        }
        const lastSection = sections[sections.length - 1];
        parsed.scene_description = [
          htmlCaption,
          '',
          `**${sections[0].emoji} ${sections[0].title}:**`,
          'Analyzed by Edge SLM',
          '',
          `**${sections.length > 1 ? sections[1].emoji + ' ' + sections[1].title : '👥 Details'}:**`,
          desc,
          '',
          `**${lastSection.emoji} ${lastSection.title}:**`,
          countSummary.join('\n') || `Total: ${total}`
        ].join('\n');
      } else {
        parsed.scene_description = `${htmlCaption}\n\n${desc}`;
      }
    } else {
      // Minimal/empty description — build from counts
      const countSummary = [];
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && k !== 'timestamp') {
          countSummary.push(`- ${k.replace(/_/g, ' ')}: **${v}**`);
        }
      }
      parsed.scene_description = `${htmlCaption}\n\n${countSummary.join('\n') || 'No detailed analysis available.'}`;
    }

    // Handle simplified edge prompt response (alert_required boolean instead of counts)
    // When the edge prompt returns alert_required: true, populate trigger keys so the
    // frontend alert logic (which checks analysisData[key] > 0) fires correctly.
    const alertConfig = this.scenarioConfig?.alerts;
    if (parsed.alert_required === true && alertConfig?.enabled) {
      const triggerKeys = alertConfig.triggerKeys || [];
      // Set at least one trigger key to 1 so frontend detects the alert
      for (const key of triggerKeys) {
        if ((parsed[key] ?? 0) === 0) {
          parsed[key] = 1;
        }
      }
      // Auto-generate alert_message if the SLM didn't provide one
      if (!parsed.alert_message) {
        parsed.alert_message = `Dear ${alertConfig.title?.replace(' Alert', '') || 'Manager'}, our monitoring system has detected a situation requiring attention in the lobby area. Please arrange for a team member to check and offer any needed assistance. An email notification has been sent to the Branch Manager for their attention.`;
        console.log('Auto-generated alert_message for edge SLM (alert_required=true)');
      }
    } else if (parsed.alert_required === false && alertConfig?.enabled) {
      // Explicitly no alert — ensure trigger keys are 0
      const triggerKeys = alertConfig.triggerKeys || [];
      for (const key of triggerKeys) {
        if (parsed[key] === undefined) parsed[key] = 0;
      }
    }

    // Fallback: if we have counts but no alert_message, check trigger keys
    if (alertConfig?.enabled && !parsed.alert_message && parsed.alert_required === undefined) {
      const triggerKeys = alertConfig.triggerKeys || [];
      const triggered = triggerKeys.filter(key => (parsed[key] ?? 0) > 0);
      if (triggered.length > 0) {
        const details = triggered.map(key => {
          const count = parsed[key];
          const label = key.replace(/_/g, ' ');
          return `${count} ${label}`;
        }).join(' and ');
        parsed.alert_message = `Dear ${alertConfig.title?.replace(' Alert', '') || 'Manager'}, our monitoring system has detected ${details} in the lobby area. Please arrange for a team member to check on them and offer any needed assistance.`;
        console.log('Auto-generated alert_message for edge SLM (trigger keys:', triggered.join(', '), ')');
      }
    }

    // Mark edge mode so frontend knows counts are not available
    parsed._edgeMode = true;

    return parsed;
  }

  // Analyze frame using Azure OpenAI GPT-4o (cloud)
  async analyzeFrameWithCloud(imagePath) {
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
      deploymentName: this.modelMode === 'edge' ? this.vllmModel : this.deploymentName,
      modelMode: this.modelMode,
      slmUrl: this.slmUrl,
      failedCaptureCount: this.failedCaptureCount,
      maxFailedCaptures: this.maxFailedCaptures,
      activeScenario: this.promptProfile,
      scenarioConfig: this.scenarioConfig,
      slmHealthy: this._lastSLMHealthy,
      slmConsecutiveTimeouts: this._lastSLMTimeouts ?? 0
    };
  }

  // Periodically refresh SLM health (called from status polling or on-demand)
  async refreshSLMHealth() {
    if (this.modelMode !== 'edge') {
      this._lastSLMHealthy = null;
      this._lastSLMTimeouts = 0;
      return;
    }
    try {
      this._lastSLMHealthy = await this.checkSLMHealth();
      this._lastSLMTimeouts = 0;
    } catch {
      this._lastSLMHealthy = false;
      this._lastSLMTimeouts = -1;
    }
  }
}

module.exports = new FrameAnalysisService();
