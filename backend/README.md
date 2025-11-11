# Backend - AI Eye Hub Lobby Live Stream Agent v2

Backend server for RTSP streaming and AI-powered frame analysis with Azure OpenAI GPT-4o Vision.

## Features

- **RTSP to HLS conversion** using FFmpeg with optimized settings
- **Independent frame capture** every 60 seconds (doesn't affect live stream)
- **Azure OpenAI GPT-4o Vision integration** for intelligent frame analysis
- **Enhanced AI prompts** for accurate people counting and witty captions
- **Memory management** with automatic cleanup (max 10 frames)
- **RESTful API** for stream control and frame retrieval
- **Status endpoint** with model name exposure
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

3. Configure your Azure OpenAI credentials in `.env`:
```env
PORT=3001
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-02-15-preview
MAX_ANALYZED_FRAMES=10
```

4. Start the server:
```bash
npm start
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME`: Your GPT-4o or GPT-4o-mini deployment name
- `AZURE_OPENAI_API_VERSION`: API version (default: 2024-02-15-preview)
- `MAX_ANALYZED_FRAMES`: Maximum frames to store (default: 10)

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
        "deploymentName": "gpt-4o-mini"
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
- Sends to Azure OpenAI GPT-4o Vision with enhanced prompts
- Stores analysis results with people counts and witty captions
- Manages memory (max 10 frames)
- Deletes old frame files from disk
- Exposes deployment model name to frontend

## Enhanced AI Features

- **Accurate People Counting**: Explicit instructions prevent false 0 counts
- **Witty Captions**: Dynamic, context-specific observations
- **Multi-step Scanning**: Systematic image analysis
- **Temperature 0.3**: Consistent results
- **Negative Instructions**: Tells AI what NOT to do

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **@azure/openai**: Azure OpenAI SDK
- **fluent-ffmpeg**: FFmpeg wrapper
- **sharp**: Image processing
- **fs**: File system operations (frame cleanup)

## Directory Structure

- `routes/`: API route handlers (stream.js, analysis.js)
- `services/`: Business logic (streamService.js, frameAnalysisService.js)
- `stream/`: HLS stream segments (generated at runtime, auto-cleanup during streaming)
  - Contains `.ts` video segment files (2-second chunks)
  - Contains `stream.m3u8` playlist file
  - FFmpeg auto-deletes old segments (max 10-15 files during streaming)
  - Segments remain after stream stops (reused on next start)
- `captures/`: Captured frame images (generated at runtime, max 10 files)
- `server.js`: Application entry point

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
'-hls_flags', 'delete_segments+append_list'  // Auto-delete old segments
```

**After Stopping Stream:**
- Segments remain in folder (not automatically deleted)
- Folder is reused when stream starts again
- To manually clean: delete all `.ts` and `.m3u8` files from `stream/` folder

### Storage Impact
- Each segment: ~200KB-500KB (depends on video quality)
- Max 10-15 segments = ~2-7MB total during streaming
- Minimal disk space usage
