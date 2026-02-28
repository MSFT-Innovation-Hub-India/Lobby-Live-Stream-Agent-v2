# Architecture Documentation

## System Architecture Overview

This document describes the architecture of **AI Eye - Hub Lobby Live Stream Agent v2** application.

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         User Browser                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           React Frontend (Port 5173, JSX)                │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │         LobbyDashboard Component                   │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐    │  │  │
│  │  │  │ Eye-Themed  │  │ Live Video  │  │  Frame   │    │  │  │
│  │  │  │   Header    │  │  HLS Player │  │  Gallery │    │  │  │
│  │  │  └─────────────┘  └─────────────┘  └──────────┘    │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌──────────┐    │  │  │
│  │  │  │  Countdown  │  │   Status    │  │  Detail  │    │  │  │
│  │  │  │   Banner    │  │   Monitor   │  │  Modal   │    │  │  │
│  │  │  └─────────────┘  └─────────────┘  └──────────┘    │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬───────────────────┬───────────────────────────┘
                 │ HTTP/REST (10s)   │ HTTP/REST (5s)
                 │ Frame Polling     │ Status Polling
                 ▼                   ▼
┌───────────────────────────────────────────────────────────────┐
│              Node.js/Express Backend (Port 3001)              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                     API Routes                          │  │
│  │  ┌────────────────┐         ┌──────────────────┐        │  │
│  │  │ /api/stream    │         │ /api/analysis    │        │  │
│  │  │  - start       │         │  - frames        │        │  │
│  │  │  - stop        │         │  - frames/:id    │        │  │
│  │  │  - status      │         │                  │        │  │
│  │  │  (+ model name)│         │                  │        │  │
│  │  └────────────────┘         └──────────────────┘        │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                    Services Layer                       │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   │  │
│  │  │  Stream Service     │  │ Frame Analysis Service  │   │  │
│  │  │  - RTSP to HLS      │  │ - Frame Capture (60s)   │   │  │
│  │  │  - FFmpeg Process   │  │ - AI Call (edge/cloud)  │   │  │
│  │  │  - HLS Segments     │  │ - Scenario Prompts      │   │  │
│  │  │  - CBR 2500k        │  │ - Refusal Detection     │   │  │
│  │  │  - GOP 60           │  │ - Frame Storage (Max 10)│   │  │
│  │  │                     │  │ - Memory Cleanup        │   │  │
│  │  └─────────────────────┘  └─────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────┬─────────────────────────┘
     │ FFmpeg                    ┌────┴────┐
     │                           │         │
     ▼                           ▼         ▼
┌──────────────┐          ┌──────────┐  ┌──────────────────┐
│ RTSP Camera  │          │  vLLM    │  │  Azure OpenAI    │
│   Source     │          │ Phi-4    │  │   GPT-4o Vision  │
└──────────────┘          │(Edge GPU)│  │   (Cloud)        │
                          └──────────┘  └──────────────────┘
```

## Component Details

### Frontend Components

#### LobbyDashboard Component (Main Component)
**Responsibilities:**
- Manage all streaming and frame analysis state
- Display eye-themed header with gradient logo and pulsing indicator
- Integrate HLS video player with stability improvements
- Show prominent countdown timer banner (5XL font, visible from distance)
- Display frame gallery with modal details
- Synchronize with backend status every 5 seconds
- Poll for new frames every 10 seconds

**Key State:**
- `isStreaming`: Current streaming status
- `streamUrl`: HLS playlist URL
- `analyzedFrames`: Array of AI-analyzed frames (max 10)
- `seconds`: Countdown timer for next capture
- `modelName`: AI model name from backend (e.g. `microsoft/Phi-4-multimodal-instruct` or `gpt-4o-mini`)
- `modelMode`: Current inference mode (`edge` or `cloud`)
- `slmHealthy`: Health status of the edge vLLM server
- `scenarios`: Available prompt profiles fetched from backend
- `scenarioConfig`: Currently active scenario configuration
- `selectedFrame`: Currently selected frame for modal display

**Key Features:**
- Eye-themed branding with gradient text and pulsing green indicator
- Functional setState to prevent HLS player re-initialization
- Click-to-expand frame modal with full analysis
- Amber-styled countdown banner with clock animations
- Real-time status synchronization preventing false indicators
- RTSP URL input validation

#### HLS Video Player Integration
**Responsibilities:**
- Display live HLS video stream
- Initialize HLS.js player
- Handle playback errors
- Video controls (play, pause, volume, fullscreen)

**Technical Details:**
- Uses HLS.js for HLS playback in browsers
- Fallback to native HLS for Safari
- Automatic error recovery
- Low latency mode disabled for smooth playback
- Tuned buffer settings: `maxBufferLength: 30`, `maxMaxBufferLength: 60`
- **Functional setState prevents unnecessary re-initialization on status polls**

**Stability Fix:**
```javascript
// Prevents HLS player re-init when streamUrl hasn't changed
setStreamUrl(prevUrl => prevUrl === newUrl ? prevUrl : newUrl)
```

#### Frame Gallery with Modal
**Responsibilities:**
- Display analyzed frames in responsive grid
- Show timestamps and AI captions
- Open modal on frame click
- Auto-refresh every 10 seconds

**Features:**
- Responsive grid layout (2-4 columns based on screen size)
- Manual refresh button
- Loading states
- Error handling
- **Click to open full frame detail modal**

**Modal Details:**
- Full-screen overlay with backdrop
- Large frame image display
- Complete scene description
- People count breakdown (near doors, at reception, other areas)
- Witty AI summary
- Timestamp with full formatting
- Close via X button or background click

### Backend Services

#### 1. Stream Service (streamService.js)
**Responsibilities:**
- Convert RTSP to HLS using FFmpeg
- Manage FFmpeg process lifecycle
- Generate HLS playlist and segments
- Auto-cleanup old segments during streaming
- Stream status tracking

**FFmpeg Configuration:**
```javascript
ffmpeg [
  '-rtsp_transport', 'tcp',      // TCP transport for reliability
  '-i', rtspUrl,                 // Input RTSP stream
  '-c:v', 'libx264',             // H.264 codec for browser compatibility
  '-preset', 'ultrafast',        // Fast encoding
  '-tune', 'zerolatency',        // Minimize latency
  '-b:v', '2500k',               // CBR for smooth playback
  '-maxrate', '2500k',           // Cap bitrate
  '-bufsize', '5000k',           // Buffer size
  '-g', '60',                    // GOP size (keyframe every 2s at 30fps)
  '-c:a', 'aac',                 // Convert audio to AAC
  '-f', 'hls',                   // HLS output format
  '-hls_time', '2',              // 2-second segments
  '-hls_list_size', '10',        // Keep 10 segments (~20 seconds)
  '-hls_flags', 'delete_segments+append_list', // Auto-delete old segments
  '-hls_allow_cache', '0',       // Disable caching for live streaming
  '-hls_segment_filename', 'segment%d.ts'
]
```

**HLS Segment Management:**
- Creates `.ts` video segment files in `backend/stream/` directory
- Each segment is ~2 seconds of video (~200KB-500KB depending on quality)
- Keeps only last 10 segments in playlist (rolling buffer)
- When segment #11 is created, segment #1 is automatically deleted
- Maximum 10-15 `.ts` files exist at any time during active streaming
- Segments remain after stream stops (reused on next start)
- Browser plays segments sequentially by reading `stream.m3u8` playlist

#### 2. Frame Analysis Service (frameAnalysisService.js)
**Responsibilities:**
- Capture frames from RTSP stream every 60 seconds
- Send frames to AI (vLLM edge or Azure OpenAI cloud, based on `MODEL_MODE`)
- Load scenario-specific prompts from `system-prompts/` directory
- Auto-detect JSON vs markdown responses and parse accordingly
- Detect and retry model refusal errors (edge mode)
- Store analyzed frames with memory management
- Manage frame retention (keep last 10 frames)
- Provide model name and mode to frontend

**Frame Capture Process:**
1. Every 60 seconds, spawn FFmpeg to capture one frame
2. Save frame as JPEG in captures directory
3. Read frame and encode to base64
4. Load system prompt from `system-prompts/{PROMPT_PROFILE}/analysis-prompt-edge.txt`
5. **Edge mode**: Send to vLLM API at `SLM_URL/v1/chat/completions`
6. **Cloud mode**: Send to Azure OpenAI GPT-4o Vision
7. Auto-detect response format (JSON for banking, markdown for default)
8. If model returns a refusal, retry once automatically
9. Store frame metadata and analysis
10. Clean up old frames (keep max 10, delete from disk with fs.unlinkSync)

**Edge Mode (vLLM) Integration:**
```javascript
// Uses OpenAI-compatible API provided by vLLM
const response = await axios.post(`${SLM_URL}/v1/chat/completions`, {
  model: 'microsoft/Phi-4-multimodal-instruct',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: [
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
      { type: 'text', text: 'Analyze this frame.' }
    ]}
  ],
  max_tokens: 1024,
  temperature: 0.7
});
```

**Cloud Mode (Azure OpenAI) Integration:**
```javascript
{
  model: 'gpt-4o-mini', // Or gpt-4o from .env
  messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', ... }] }],
  max_tokens: 500,
  temperature: 0.3
}
```

**Scenario / Prompt System:**
- `hub-lobby-default`: General lobby monitoring, expects markdown output
- `ai-first-bank`: Banking security scenario, expects JSON with people counts, alerts, anomalies
- Anti-hallucination guardrails: 90% confidence threshold, false-positive warnings for common misidentifications

**Model Refusal Detection:**
- `isModelRefusal()` checks if response contains patterns like "I'm sorry, as an AI text-based model..."
- On refusal, automatically retries the frame analysis once
- Skips frame on double-refusal to avoid infinite loops

## Data Flow

### Stream Start Flow
```
1. User enters RTSP URL → StreamControls
2. StreamControls calls API → POST /api/stream/start
3. Backend receives request → streamRoutes
4. Start stream service → streamService.startStream()
5. Start frame capture → frameAnalysisService.startCapture()
6. FFmpeg spawns for HLS conversion
7. HLS segments generated → stream/ directory
8. Response sent to frontend with stream URL
9. LiveStream component loads HLS stream
10. Video begins playing
```

### Frame Capture Flow
```
1. Timer triggers (every 60 seconds)
2. frameAnalysisService.captureAndAnalyzeFrame()
3. FFmpeg captures single frame from RTSP
4. Frame saved to captures/ directory
5. Frame encoded to base64
6. Sent to AI (vLLM or Azure OpenAI) with scenario-specific prompt
7. AI analysis received (parsed as JSON or markdown based on scenario)
8. Frame metadata + analysis stored in memory
9. Old frames cleaned up (keep last 10, delete from disk)
10. Frontend polls and retrieves new frame (every 10s)
11. LobbyDashboard displays frame in gallery
12. User can click frame to open detail modal
```

### Status Synchronization Flow
```
1. Frontend timer triggers (every 5 seconds)
2. fetchStreamStatus() calls GET /api/stream/status
3. Backend returns: streaming status, capture status, model name
4. Frontend updates state using functional setState
5. Prevents HLS player re-initialization (streamUrl comparison)
6. Updates countdown timer, model name display
7. If backend unreachable, sets isStreaming to false
8. UI reflects accurate backend state at all times
```

### Stream Stop Flow
```
1. User clicks Stop → StreamControls
2. API called → POST /api/stream/stop
3. FFmpeg process killed (SIGTERM)
4. Frame capture timer cleared
5. Response sent to frontend
6. LiveStream component clears video
7. Status updated to "Stopped"
```

## Key Design Decisions

### 1. JSX over TypeScript (.tsx)
**Problem**: Need balance between type safety and development speed
**Solution**: Use JavaScript with JSX instead of TypeScript
**Benefits**: 
- Faster development without type definitions
- Easier for beginners to understand and modify
- More flexibility during prototyping
- Fewer build errors to debug
**Trade-off**: Less type checking (acceptable for this project size)

### 2. Non-Interfering Architecture
**Problem**: Frame capture shouldn't affect live stream quality
**Solution**: Backend captures directly from RTSP source, independent of browser stream
**Benefit**: Live stream and frame capture are completely decoupled

### 3. RTSP to HLS Conversion
**Problem**: Browsers cannot play RTSP directly
**Solution**: Use FFmpeg to convert RTSP to HLS on-the-fly
**Benefit**: Browser-compatible streaming with broad device support

### 4. Server-Side Frame Analysis
**Problem**: Can't send video frames from browser to Azure OpenAI
**Solution**: Backend captures and analyzes frames directly
**Benefit**: Security, reliability, and no browser limitations

### 5. Polling for Frame Updates (10s intervals)
**Problem**: Need to display new analyzed frames
**Solution**: Frontend polls backend every 10 seconds for new frames
**Alternative Considered**: WebSocket (more complex, not needed for 60s intervals)
**Benefit**: Simple, reliable, sufficient for 60-second capture intervals

### 6. Status Synchronization (5s intervals)
**Problem**: UI needs to reflect actual backend streaming state
**Solution**: Poll backend status every 5 seconds, use functional setState
**Benefit**: 
- Prevents false "streaming" indicators
- Syncs after backend restarts
- Prevents HLS player re-initialization
- Accurate countdown timer

### 7. Functional setState for HLS Stability
**Problem**: Status polling was triggering HLS player re-initialization every 5s
**Solution**: Use functional setState with URL comparison
```javascript
setStreamUrl(prevUrl => prevUrl === newUrl ? prevUrl : newUrl)
```
**Benefit**: 
- Prevents unnecessary state changes
- HLS player remains stable
- Video doesn't disappear after 1 second

### 8. Memory Management (Max 10 Frames)
**Problem**: Unlimited frame storage causes memory issues
**Solution**: Store maximum 10 frames, delete old files from disk
**Implementation**:
- Backend: Array pop() + fs.unlinkSync() for file deletion
- Frontend: Slice to 10 frames on fetch
**Benefit**: Application runs indefinitely without memory issues

### 9. HLS Segment Auto-Cleanup
**Problem**: Video segments could fill up disk space
**Solution**: FFmpeg configured to auto-delete old segments during streaming
**Configuration**:
```javascript
'-hls_time', '2',                        // 2-second segments
'-hls_list_size', '10',                  // Keep 10 segments in playlist
'-hls_flags', 'delete_segments+append_list', // Auto-delete old segments
```
**How It Works**:
- FFmpeg creates segments (segment0.ts, segment1.ts, etc.)
- Playlist keeps only last 10 segments (~20 seconds of video)
- When segment falls out of playlist, FFmpeg deletes the .ts file
- Maximum 10-15 files exist at any time during streaming
**Benefit**: Streaming can run indefinitely without filling disk
**Note**: After stopping stream, segments remain until next stream (reuses folder)

### 9. Scenario-Based Prompt System
**Problem**: Different deployment environments need different analysis outputs
**Solution**: Switchable prompt profiles loaded from `system-prompts/` directory
**Profiles**:
- `hub-lobby-default`: General lobby monitoring (markdown output)
- `ai-first-bank`: Banking security with structured JSON output, alerts, anti-hallucination
**Benefit**: Single codebase supports multiple use cases

### 10. Model Refusal Detection
**Problem**: Edge model (Phi-4) sometimes returns text-mode refusal instead of image analysis
**Solution**: `isModelRefusal()` detects refusal patterns and auto-retries
**Benefit**: Robust edge inference without manual intervention

### 11. Anti-Hallucination Guardrails
**Problem**: Edge model hallucinated objects (e.g. walking sticks from plant stems)
**Solution**: 90% confidence threshold, explicit false-positive warnings in prompts
**Benefit**: Higher accuracy for security-sensitive scenarios

### 10. Unified Dashboard Component
**Problem**: Managing multiple separate components adds complexity
**Solution**: Single LobbyDashboard component with integrated features
**Benefit**: 
- Easier state management
- Better component communication
- Simpler codebase
- Consistent UI/UX

### 11. In-Memory Frame Storage
**Problem**: Need to store analyzed frames
**Solution**: Store in service memory (array), persist images to disk
**Benefit**: Fast access, automatic cleanup, simple implementation
**Trade-off**: Lost on server restart (acceptable for this use case)

## Security Considerations

### Current Implementation
1. **CORS**: Enabled for all origins (development)
2. **Environment Variables**: Sensitive data in .env (gitignored)
3. **No Authentication**: Open API endpoints
4. **No HTTPS**: HTTP only

### Production Recommendations
1. **Enable HTTPS**: Use TLS certificates
2. **Restrict CORS**: Whitelist specific origins
3. **Add Authentication**: JWT or OAuth2
4. **Rate Limiting**: Prevent abuse
5. **Input Validation**: Sanitize RTSP URLs
6. **API Keys**: Protect API endpoints
7. **Secure Azure Keys**: Use Azure Key Vault

## Scalability Considerations

### Current Limitations
- Single RTSP stream at a time
- In-memory frame storage
- Single server instance
- No load balancing

### Scaling Options
1. **Multiple Streams**: Modify services to handle array of streams
2. **Database Storage**: Store frames in database instead of memory
3. **Distributed Processing**: Separate frame capture workers
4. **CDN for HLS**: Serve HLS segments via CDN
5. **Message Queue**: Queue frame analysis jobs
6. **Microservices**: Split into stream and analysis services

## Performance Characteristics

### Latency
- **RTSP to Browser**: 3-5 seconds (HLS segments + network)
- **Frame Capture**: 1-2 seconds (FFmpeg operation)
- **AI Analysis (Edge/vLLM)**: 5-15 seconds (local GPU inference)
- **AI Analysis (Cloud/Azure)**: 3-10 seconds (Azure OpenAI API call)
- **Frontend Update**: 1-10 seconds (polling interval)

### Resource Usage
- **CPU**: 5-20% per stream (FFmpeg transcoding)
- **Memory**: 100-200 MB backend, 50-100 MB frontend
- **Disk**: ~2-5 MB per frame (temporary)
- **Network**: Depends on stream bitrate

## Technology Choices

### Why React?
- Component-based architecture
- Large ecosystem and community
- Fast development with Vite
- Modern hooks API

### Why Node.js/Express?
- JavaScript on backend and frontend
- Great for I/O operations (streaming)
- Easy FFmpeg integration
- Fast development

### Why HLS over WebRTC?
- Simpler implementation
- Better browser compatibility
- No peer connection complexity
- Acceptable latency for surveillance

### Why FFmpeg?
- Industry standard for video processing
- Reliable RTSP to HLS conversion
- Frame extraction capabilities
- Well-documented and mature

## Deployment Architecture

### Development
```
Frontend: localhost:5173 (Vite dev server)
Backend: localhost:3001 (Node.js)
```

### Production Recommendations
```
Frontend: Static hosting (Nginx, Vercel, Netlify)
Backend: Container (Docker) on VM or App Service
FFmpeg: Installed in container
Azure OpenAI: Managed service
```

### Example Production Stack
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│   Nginx     │ (Reverse Proxy, SSL Termination)
│   + Static  │
│   Frontend  │
└──────┬──────┘
       │ HTTP
       ▼
┌─────────────┐
│   Node.js   │
│   Backend   │
│  (Docker)   │
└──────┬──────┘
       │
       ├─────► RTSP Camera
       │
       ├─────► vLLM + Phi-4 (Edge, local GPU)
       │
       └─────► Azure OpenAI (Cloud)
```

### Current Edge Deployment (Azure Stack Edge)
```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTP
       ▼
┌───────────────────────────────────────────────┐
│  Azure Stack Edge VM (Tesla T4 GPU)           │
│                                               │
│  systemd user services:                       │
│  ┌─────────────┐  ┌────────────┐  ┌────────┐  │
│  │ vLLM :8000  │  │ Backend    │  │Frontend│  │
│  │ Phi-4-multi │  │ :3001      │  │ :5173  │  │
│  └─────────────┘  └────────────┘  └────────┘  │
└───────────────────────────────────────────────┘
```
See [VLLM_DEPLOYMENT.md](VLLM_DEPLOYMENT.md) for full edge setup guide.

## Error Handling

### Stream Errors
- FFmpeg spawn failures
- RTSP connection timeout
- HLS segment generation errors
- Network interruptions

**Handling**: Automatic retry, graceful degradation, error messages to user

### Frame Analysis Errors
- Frame capture failures
- Azure OpenAI API errors
- Network timeouts
- Invalid API credentials

**Handling**: Log errors, continue streaming, show error in analysis text

### Frontend Errors
- HLS loading failures
- API connection errors
- Timeout errors

**Handling**: Error boundaries, retry logic, user-friendly messages

## Future Enhancements

1. **Multi-Camera Support**: Handle multiple RTSP streams simultaneously
2. **WebSocket Updates**: Real-time frame updates instead of polling
3. **Advanced Analytics**: Object detection, people counting, motion tracking
4. **Alert System**: Notifications for specific events detected by AI
5. **Recording**: Save streams to disk for later playback
6. **Playback Controls**: View historical footage and frames
7. **User Management**: Authentication and role-based access
8. **Dashboard**: Statistics and monitoring metrics
9. **Mobile App**: Native iOS/Android applications
10. **Cloud Native**: Kubernetes deployment, auto-scaling

---

This architecture provides a solid foundation for RTSP streaming with AI analysis while maintaining simplicity and reliability.
