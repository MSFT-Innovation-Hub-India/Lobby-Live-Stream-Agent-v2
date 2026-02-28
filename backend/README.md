# Backend - AI Eye Hub Lobby Live Stream Agent v2

Backend server for RTSP streaming and AI-powered frame analysis. Supports **dual-mode** inference: **cloud** (Azure OpenAI GPT-4o) or **edge** (vLLM with Phi-4-multimodal-instruct on local GPU).

## Features

- **Dual-mode AI inference** — cloud (Azure OpenAI GPT-4o) or edge (vLLM + Phi-4-multimodal)
- **RTSP to HLS conversion** using FFmpeg with optimized settings (2s segments, CBR 2500k, GOP 60)
- **Independent frame capture** every 60 seconds (doesn't affect live stream)
- **Scenario-based prompt system** — switchable prompt profiles (`hub-lobby-default`, `ai-first-bank`)
- **Auto-detect response format** — parses JSON (banking scenario) or markdown (default scenario)
- **Model refusal detection** — detects text-mode refusals with automatic retry
- **Anti-hallucination guardrails** — 90% confidence threshold, false-positive warnings in prompts
- **Memory management** with automatic cleanup (max 10 frames)
- **RESTful API** for stream control and frame retrieval
- **Status endpoint** with model name exposure
- **No-cache HLS headers** to prevent stale playlist in browsers
- **Automatic frame storage** and disk cleanup with fs.unlinkSync

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Configure your environment in `.env`:

**For Edge Mode (vLLM — current deployment):**
```env
PORT=3001
MODEL_MODE=edge
SLM_URL=http://localhost:8000
VLLM_MODEL=microsoft/Phi-4-multimodal-instruct
MAX_ANALYZED_FRAMES=10
FRAME_CAPTURE_INTERVAL=60000
PROMPT_PROFILE=hub-lobby-default
```

**For Cloud Mode (Azure OpenAI):**
```env
PORT=3001
MODEL_MODE=cloud
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-02-15-preview
MAX_ANALYZED_FRAMES=10
FRAME_CAPTURE_INTERVAL=60000
PROMPT_PROFILE=hub-lobby-default
```

4. Start the server:
```bash
npm start
```

## Environment Variables

### Core
- `PORT`: Server port (default: 3001)
- `MODEL_MODE`: `edge` (vLLM) or `cloud` (Azure OpenAI)
- `MAX_ANALYZED_FRAMES`: Maximum frames to store (default: 10)
- `FRAME_CAPTURE_INTERVAL`: Milliseconds between frame captures (default: 60000)
- `PROMPT_PROFILE`: Active prompt scenario — `hub-lobby-default` or `ai-first-bank`

### Edge Mode (vLLM)
- `SLM_URL`: vLLM server URL (default: `http://localhost:8000`)
- `VLLM_MODEL`: Model name for vLLM (e.g. `microsoft/Phi-4-multimodal-instruct`)

### Cloud Mode (Azure OpenAI)
- `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key (optional if using Managed Identity)
- `AZURE_OPENAI_DEPLOYMENT_NAME`: Your GPT-4o or GPT-4o-mini deployment name
- `AZURE_OPENAI_API_VERSION`: API version (default: 2024-02-15-preview)

## API Documentation

### Stream Endpoints

- `POST /api/stream/start` - Start RTSP to HLS conversion
  - Body: `{ "rtspUrl": "rtsp://..." }`
  - Returns: `{ "message": "...", "streamUrl": "..." }`

- `POST /api/stream/stop` - Stop streaming
  - Returns: `{ "message": "Stream stopped" }`

- `GET /api/stream/status` - Get streaming and capture status
  - Returns: 
    ```json
    {
      "stream": { "isStreaming": true },
      "capture": { 
        "isCapturing": true, 
        "frameCount": 5,
        "deploymentName": "microsoft/Phi-4-multimodal-instruct",
        "modelMode": "edge"
      }
    }
    ```

### Analysis Endpoints

- `GET /api/analysis/frames` - Get all analyzed frames
  - Returns: Array of frame objects

- `GET /api/analysis/frames/:id` - Get specific frame
  - Returns: Single frame object with full analysis

See main README.md for complete API documentation.

## Key Services

### Stream Service (`services/streamService.js`)
- Converts RTSP streams to HLS format using FFmpeg
- Manages FFmpeg process lifecycle
- Generates HLS segments and playlists
- Auto-deletes old segments

### Frame Analysis Service (`services/frameAnalysisService.js`)
- Captures frames every 60 seconds independently from stream
- Encodes frames to Base64
- **Edge mode**: Sends to vLLM OpenAI-compatible API (`/v1/chat/completions`) with Phi-4-multimodal
- **Cloud mode**: Sends to Azure OpenAI GPT-4o Vision
- Loads scenario-specific system prompts from `system-prompts/` directory
- Auto-detects JSON vs markdown responses and parses accordingly
- **Model refusal detection** (`isModelRefusal()`): Detects when model returns text-mode refusals and auto-retries
- Stores analysis results with people counts, scene descriptions, and alerts
- Manages memory (max 10 frames)
- Deletes old frame files from disk
- Exposes model name and mode to frontend

## Prompt / Scenario System

The backend supports switchable prompt profiles via the `PROMPT_PROFILE` env var:

### `hub-lobby-default`
- **Output format**: Markdown
- **Use case**: General Innovation Hub lobby monitoring
- **Prompt file**: `system-prompts/hub-lobby-default/analysis-prompt-edge.txt`

### `ai-first-bank`
- **Output format**: JSON with structured fields (peopleCount, alerts, anomalies)
- **Use case**: Banking lobby with security-oriented analysis
- **Prompt file**: `system-prompts/ai-first-bank/analysis-prompt-edge.txt`
- **Anti-hallucination**: 90% confidence threshold, explicit false-positive warnings for common misidentifications (plant stems, furniture legs as walking sticks, etc.)

## Enhanced AI Features

- **Dual-Mode Inference**: Seamless switching between cloud (Azure OpenAI) and edge (vLLM)
- **Accurate People Counting**: Explicit instructions prevent false 0 counts
- **Scenario-Aware Prompts**: Different prompt profiles for different use cases
- **Model Refusal Handling**: Auto-detects and retries when model returns text-mode errors
- **Anti-Hallucination Guardrails**: Confidence thresholds and false-positive warnings
- **Temperature 0.7**: Balanced creativity and accuracy (edge mode)
- **Max Tokens 1024**: Sufficient for detailed analysis without repetition

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **axios**: HTTP client (used for vLLM API calls in edge mode)
- **@azure/openai**: Azure OpenAI SDK (cloud mode)
- **fluent-ffmpeg**: FFmpeg wrapper
- **sharp**: Image processing
- **fs**: File system operations (frame cleanup)

## Directory Structure

- `routes/`: API route handlers (stream.js, analysis.js)
- `services/`: Business logic (streamService.js, frameAnalysisService.js)
- `system-prompts/`: Scenario-specific AI prompt files
  - `hub-lobby-default/`: Innovation Hub lobby prompt (markdown output)
  - `ai-first-bank/`: Banking lobby prompt (JSON output, anti-hallucination)
- `stream/`: HLS stream segments (generated at runtime, auto-cleanup during streaming)
  - Contains `.ts` video segment files (2-second chunks)
  - Contains `stream.m3u8` playlist file
  - FFmpeg auto-deletes old segments (max 10-15 files during streaming)
  - Segments remain after stream stops (reused on next start)
- `captures/`: Captured frame images (generated at runtime, max 10 files)
- `server.js`: Application entry point (includes no-cache middleware for `/stream`)

## HLS Segment Management

### What are .ts files?
The `stream/` folder contains `.ts` (MPEG Transport Stream) files which are **HLS video segments**. These are small chunks of video (2 seconds each) that the browser downloads and plays sequentially to create the live streaming experience.

### Auto-Cleanup Process
**During Streaming:**
- FFmpeg creates segments: `segment0.ts`, `segment1.ts`, `segment2.ts`, etc.
- Playlist (`stream.m3u8`) keeps only last 10 segments
- When segment falls out of playlist, FFmpeg automatically deletes it
- Maximum 10-15 files exist at any time

**Configuration:**
```javascript
'-hls_time', '2',                        // 2-second segments
'-hls_list_size', '10',                  // Keep 10 segments
'-hls_flags', 'delete_segments+append_list',  // Auto-delete old segments
'-b:v', '2500k',                         // CBR for smooth playback
'-g', '60',                              // GOP size (keyframe every 2s at 30fps)
```

**After Stopping Stream:**
- Segments remain in folder (not automatically deleted)
- Folder is reused when stream starts again
- To manually clean: delete all `.ts` and `.m3u8` files from `stream/` folder

### Storage Impact
- Each segment: ~200KB-500KB (depends on video quality)
- Max 10-15 segments = ~2-7MB total during streaming
- Minimal disk space usage
