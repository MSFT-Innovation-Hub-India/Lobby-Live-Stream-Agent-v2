# Architecture Documentation

## System Architecture Overview

This document describes the architecture of the Lobby Live Stream Agent v2 application.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              React Frontend (Port 5173)                   │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  Stream    │  │   Stream    │  │    Analyzed     │   │  │
│  │  │  Controls  │  │    Video    │  │     Frames      │   │  │
│  │  │ Component  │  │  Component  │  │   Component     │   │  │
│  │  └────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ HTTP/REST API
                 │ (axios)
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js/Express Backend (Port 3001)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     API Routes                            │  │
│  │  ┌────────────────┐         ┌──────────────────┐        │  │
│  │  │ /api/stream    │         │ /api/analysis    │        │  │
│  │  │  - start       │         │  - frames        │        │  │
│  │  │  - stop        │         │  - frames/:id    │        │  │
│  │  │  - status      │         │                  │        │  │
│  │  └────────────────┘         └──────────────────┘        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Services Layer                         │  │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐   │  │
│  │  │  Stream Service     │  │ Frame Analysis Service  │   │  │
│  │  │  - RTSP to HLS      │  │ - Frame Capture         │   │  │
│  │  │  - FFmpeg Process   │  │ - Azure OpenAI Call     │   │  │
│  │  │  - HLS Segments     │  │ - Frame Storage         │   │  │
│  │  └─────────────────────┘  └─────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└────┬────────────────────────────────────┬───────────────────────┘
     │                                    │
     │ FFmpeg                             │ Azure OpenAI API
     │                                    │
     ▼                                    ▼
┌──────────────┐                  ┌──────────────────┐
│ RTSP Camera  │                  │  Azure OpenAI    │
│   Source     │                  │    GPT-4o        │
└──────────────┘                  └──────────────────┘
```

## Component Details

### Frontend Components

#### 1. StreamControls Component
**Responsibilities:**
- Accept RTSP URL input
- Start/Stop stream buttons
- Display current status
- Error handling and display

**Key Features:**
- Input validation (must start with rtsp://)
- Disabled state during operations
- Visual feedback for loading states

#### 2. LiveStream Component
**Responsibilities:**
- Display HLS video stream
- Initialize HLS.js player
- Handle playback errors
- Video controls (play, pause, volume, fullscreen)

**Technical Details:**
- Uses HLS.js for HLS playback in browsers
- Fallback to native HLS for Safari
- Automatic error recovery
- Low latency mode enabled

#### 3. AnalyzedFrames Component
**Responsibilities:**
- Fetch analyzed frames from backend
- Display frames in responsive grid
- Show timestamps and AI analysis
- Auto-refresh every 10 seconds

**Features:**
- Manual refresh button
- Responsive grid layout
- Loading states
- Error handling

### Backend Services

#### 1. Stream Service (streamService.js)
**Responsibilities:**
- Convert RTSP to HLS using FFmpeg
- Manage FFmpeg process lifecycle
- Generate HLS playlist and segments
- Stream status tracking

**FFmpeg Configuration:**
```javascript
ffmpeg [
  '-rtsp_transport', 'tcp',      // TCP transport for reliability
  '-i', rtspUrl,                 // Input RTSP stream
  '-c:v', 'copy',                // Copy video codec (no re-encoding)
  '-c:a', 'aac',                 // Convert audio to AAC
  '-f', 'hls',                   // HLS output format
  '-hls_time', '2',              // 2-second segments
  '-hls_list_size', '3',         // Keep 3 segments
  '-hls_flags', 'delete_segments' // Auto-delete old segments
]
```

#### 2. Frame Analysis Service (frameAnalysisService.js)
**Responsibilities:**
- Capture frames from RTSP stream
- Send frames to Azure OpenAI
- Store analyzed frames
- Manage frame retention (keep last 20)

**Frame Capture Process:**
1. Every 60 seconds, spawn FFmpeg to capture one frame
2. Save frame as JPEG in captures directory
3. Read frame and encode to base64
4. Send to Azure OpenAI GPT-4o with vision prompt
5. Store frame metadata and analysis
6. Clean up old frames (keep max 20)

**Azure OpenAI Integration:**
```javascript
{
  model: 'gpt-4o',
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'Analyze this surveillance frame...' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' }}
    ]
  }],
  max_tokens: 500
}
```

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
6. Sent to Azure OpenAI with vision prompt
7. AI analysis received
8. Frame metadata + analysis stored in memory
9. Old frames cleaned up (keep last 20)
10. Frontend polls and retrieves new frame
11. AnalyzedFrames component displays frame + analysis
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

### 1. Non-Interfering Architecture
**Problem**: Frame capture shouldn't affect live stream quality
**Solution**: Backend captures directly from RTSP source, independent of browser stream
**Benefit**: Live stream and frame capture are completely decoupled

### 2. RTSP to HLS Conversion
**Problem**: Browsers cannot play RTSP directly
**Solution**: Use FFmpeg to convert RTSP to HLS on-the-fly
**Benefit**: Browser-compatible streaming with broad device support

### 3. Server-Side Frame Analysis
**Problem**: Can't send video frames from browser to Azure OpenAI
**Solution**: Backend captures and analyzes frames directly
**Benefit**: Security, reliability, and no browser limitations

### 4. Polling for Frame Updates
**Problem**: Need to display new analyzed frames
**Solution**: Frontend polls backend every 10 seconds
**Alternative Considered**: WebSocket (more complex, not needed for 60s intervals)
**Benefit**: Simple, reliable, sufficient for 60-second capture intervals

### 5. In-Memory Frame Storage
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
- **AI Analysis**: 3-10 seconds (Azure OpenAI API call)
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
       └─────► Azure OpenAI
```

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
