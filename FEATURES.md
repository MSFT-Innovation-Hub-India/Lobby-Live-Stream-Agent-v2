# Features Overview

Complete feature list and technical capabilities of **AI Eye - Hub Lobby Live Stream Agent v2**.

## Core Features

### 1. Live RTSP Streaming ✅
**Description**: Real-time video streaming from RTSP cameras to web browsers

**Technical Details**:
- RTSP to HLS conversion using FFmpeg
- Browser-compatible streaming (HLS.js)
- Native HLS support for Safari
- Low-latency mode enabled
- Automatic reconnection on errors
- Functional setState to prevent unnecessary HLS player re-initialization

**User Benefits**:
- Watch live camera feeds from any device
- No special plugins required
- Works on desktop and mobile
- Smooth playback with minimal latency (2-5 seconds)
- Stable streaming without random disconnections

---

### 2. AI-Powered Frame Analysis ✅
**Description**: Automatic capture and intelligent analysis of video frames using Azure OpenAI GPT-4o Vision

**Technical Details**:
- Captures one frame every 60 seconds
- Independent capture (doesn't affect live stream)
- Base64 image encoding
- Azure OpenAI vision API integration
- GPT-4o or GPT-4o-mini model support
- Enhanced AI prompt for accurate person counting
- Temperature set to 0.3 for consistent results
- Dynamic model name display from backend .env

**User Benefits**:
- Automatic description of what's happening in the video
- Intelligent understanding of scenes and activities
- **Accurate people counting** (near doors, at reception, in other areas)
- No manual monitoring required
- Detailed text descriptions with **witty, dynamic captions**

**Sample Analysis Output**:
```json
{
  "peopleCount": {
    "nearDoors": 1,
    "atReception": 2,
    "otherAreas": 3,
    "total": 6
  },
  "sceneDescription": "Reception desk is buzzing with activity as 
  two visitors check in while one person approaches the door. The 
  lighting is bright and professional.",
  "wittySummary": "The lobby is getting cozy with 6 people—reception 
  is doing brisk business while someone makes their grand entrance!"
}
```

---

### 3. Modern Responsive UI with Eye-Themed Branding ✅
**Description**: Beautiful, professional interface with distinctive "AI Eye" branding

**Technical Details**:
- React.js with hooks (JSX, not TypeScript)
- Tailwind CSS with responsive design
- Dark theme optimized for monitoring
- Component-based architecture
- Eye-themed logo with pulsing indicator
- Gradient text effects

**Features**:
- Clean, intuitive layout
- **Eye-themed branding** with gradient "AI Eye" logo
- Mobile-responsive grid
- Smooth animations
- Professional color scheme
- Accessible design
- **Pulsing green indicator** showing active AI monitoring

**Supported Devices**:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Tablets (iPad, Android tablets)
- Mobile phones (iOS, Android)

---

### 4. Non-Interfering Architecture ✅
**Description**: Frame capture happens independently without affecting live stream quality

**How It Works**:
```
RTSP Camera
    ├─→ FFmpeg Stream → HLS → Browser (Live Video)
    └─→ FFmpeg Capture → Frame → Azure OpenAI → Analysis
```

**Benefits**:
- Live stream quality never affected by capture
- Capture failures don't stop streaming
- Parallel processing for better performance
- Can capture frames even if browser is closed

---

### 5. Real-Time Status Synchronization ✅
**Description**: UI automatically reflects actual backend streaming state

**Technical Details**:
- Frontend polls backend status every 5 seconds
- Functional setState prevents unnecessary re-renders
- Handles backend server unavailability gracefully
- Updates streaming status, model name, and capture status

**User Experience**:
- See accurate streaming status at all times
- UI syncs with backend even when servers restart
- No false "streaming" indicators
- Real-time capture countdown updates

---

### 6. Prominent Countdown Timer ✅
**Description**: Large, visible countdown showing time until next frame capture

**Features**:
- **5XL font size** for visibility from across the lobby
- Amber gradient background with animations
- Clock icon animations
- Sticky banner always visible
- 60-second countdown resets after each capture

**User Benefits**:
- Easy to see from far away in lobby
- Know exactly when next analysis will occur
- Visual feedback that system is active

---

### 7. Frame Detail Modal ✅
**Description**: Click any frame to see full-size image and complete analysis

**Features**:
- Full-screen modal overlay
- Large frame display
- Complete scene description
- People count breakdown (near doors, at reception, other areas)
- Timestamp details
- Close with X button or background click

**User Benefits**:
- Deep dive into any captured moment
- Better understanding of AI analysis
- Professional presentation of data

---

### 8. Memory Management ✅
**Description**: Automatic cleanup of old frames to prevent memory issues

**Technical Details**:
- Backend stores maximum 10 frames in memory
- Old frames automatically deleted from disk (fs.unlinkSync)
- Frontend displays maximum 10 frames
- React garbage collection handles removed frames

**HLS Segment Management**:
- FFmpeg auto-deletes old video segments during streaming
- Maximum 10-15 `.ts` segment files exist at any time
- Each segment is 2 seconds (~200KB-500KB)
- Configured with `-hls_flags delete_segments` and `-hls_list_size 10`
- Segments in `backend/stream/` folder are temporary and automatically managed

**Benefits**:
- Application runs indefinitely without memory issues
- No manual cleanup needed for frames or video segments
- Optimal performance maintained
- Minimal disk space usage (~2-7MB for video segments, <5MB for frame images)

---

### 9. Stream Control ✅
**Description**: Easy-to-use controls for managing video streams

**Features**:
- RTSP URL input with validation
- Start/Stop stream buttons
- Status indicators
- Error messages
- Loading states

**Supported RTSP URLs**:
```
rtsp://username:password@ip:port/stream
rtsp://ip:port/stream
rtsp://domain.com/stream
```

---

## Technical Capabilities

### Backend (Node.js/Express)

**Stream Management**:
- FFmpeg process management
- HLS playlist generation
- Segment cleanup
- Error recovery

**Frame Processing**:
- Timer-based capture
- Image encoding
- AI analysis integration
- Frame storage management

**API Endpoints**:
- `POST /api/stream/start` - Start streaming
- `POST /api/stream/stop` - Stop streaming
- `GET /api/stream/status` - Get stream status
- `GET /api/analysis/frames` - Get analyzed frames
- `GET /api/analysis/frames/:id` - Get specific frame
- `GET /health` - Health check

**Services**:
- Stream Service (RTSP to HLS)
- Frame Analysis Service (Capture + AI)

---

### Frontend (React.js with JSX)

**Main Component: LobbyDashboard**
- Unified dashboard with all features integrated
- Eye-themed header with gradient logo
- HLS.js video player with stability improvements
- Frame gallery with click-to-expand modal
- Prominent countdown timer banner
- Real-time status synchronization
- State management with React hooks

**Key Functions**:
- `handleStreamToggle()` - Start/stop streaming
- `fetchAnalyzedFrames()` - Get latest frames (every 10s)
- `fetchStreamStatus()` - Sync backend state (every 5s)
- `setSelectedFrame()` - Open frame detail modal

**Sub-Components**:

1. **Video Player Section**
   - HLS.js integration
   - Video controls (play/pause, volume, fullscreen)
   - Error recovery
   - Loading states
   - Prevents re-initialization on status updates

2. **Countdown Timer Banner**
   - Large 5XL font size
   - Amber gradient styling
   - Animated clock icons
   - Sticky positioning

3. **Frame Gallery**
   - Responsive grid layout
   - Frame thumbnails with hover effects
   - AI captions preview
   - Click to open modal
   - Auto-refresh every 10s
   - Manual refresh button

4. **Frame Detail Modal**
   - Full-screen overlay
   - Large image display
   - Complete analysis breakdown
   - People count sections
   - Close button and background dismiss

**Services**:
- API client (Axios)
- Stream service
- Analysis service

---

## Performance Characteristics

### Speed
- Stream start: 3-5 seconds
- Frame capture: 1-2 seconds
- AI analysis: 3-10 seconds
- UI update: 1-10 seconds

### Resource Usage
- Backend memory: ~100-200 MB
- Frontend memory: ~50-100 MB
- CPU: 5-20% per stream
- Network: Depends on stream quality

### Scalability
- Current: 1 stream per instance
- Supports: Multiple backend instances
- Future: Multiple concurrent streams

---

## Data Management

### Frame Storage
- Location: `backend/captures/`
- Format: JPEG images
- Retention: Last 20 frames
- Auto-cleanup: Yes
- Size: ~2-5 MB per frame

### Stream Segments
- Location: `backend/stream/`
- Format: HLS (.ts segments, .m3u8 playlist)
- Duration: 2 seconds per segment
- Retention: Last 3 segments
- Auto-cleanup: Yes

---

## Security Features

### Current Implementation
- CORS enabled (configurable)
- Environment variables for secrets
- HTTPS support (production)
- Input validation

### Recommended for Production
- JWT authentication
- API rate limiting
- HTTPS only
- CORS whitelist
- Security headers
- Azure Key Vault for secrets

---

## Error Handling

### Stream Errors
- FFmpeg failure detection
- Automatic retry logic
- User-friendly error messages
- Graceful degradation

### Network Errors
- Connection timeout handling
- Retry with exponential backoff
- Offline mode support

### AI Analysis Errors
- Azure OpenAI timeout handling
- Fallback error messages
- Continues streaming on AI failure

---

## Configuration Options

### Backend (.env)
```env
PORT=3001
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### Frontend (api.js)
```javascript
const API_BASE_URL = 'http://localhost:3001/api';
```

### FFmpeg Settings (streamService.js)
- Transport: TCP
- Video codec: Copy (no re-encoding)
- Audio codec: AAC
- HLS segment time: 2 seconds
- HLS list size: 3 segments

---

## Browser Compatibility

### Fully Supported
✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ iOS Safari 14+
✅ Chrome Android 90+

### Partially Supported
⚠️ Internet Explorer: Not supported
⚠️ Older browsers: May not support HLS.js

---

## Monitoring & Logging

### Backend Logs
- Server startup messages
- FFmpeg output
- Frame capture events
- AI analysis results
- Error messages

### Frontend Console
- HLS.js events
- API calls
- Component lifecycle
- Error tracking

---

## Future Features (Roadmap)

### High Priority
- [ ] WebSocket for real-time updates
- [ ] Multiple camera support
- [ ] User authentication
- [ ] Recording functionality
- [ ] Docker containers

### Medium Priority
- [ ] Motion detection alerts
- [ ] Email notifications
- [ ] Historical playback
- [ ] Advanced analytics dashboard
- [ ] Mobile app

### Low Priority
- [ ] Face detection
- [ ] Object tracking
- [ ] Heat maps
- [ ] Custom AI prompts
- [ ] Multi-language support

---

## Use Cases

### 1. Lobby Monitoring
Monitor building lobbies with automatic activity analysis.

### 2. Security Surveillance
Real-time surveillance with intelligent event detection.

### 3. Retail Analytics
Analyze customer behavior and store traffic patterns.

### 4. Smart Buildings
Monitor building usage and occupancy patterns.

### 5. Event Monitoring
Track events and gatherings with AI analysis.

---

## Integration Possibilities

### Current Integrations
- Azure OpenAI (GPT-4o)
- RTSP cameras
- HLS players

### Potential Integrations
- Microsoft Teams (notifications)
- Azure Blob Storage (recording)
- Power BI (analytics)
- Microsoft Sentinel (security)
- Azure Event Grid (events)

---

## Limitations

### Current Version
- Single stream at a time
- No user authentication
- No recording
- No playback controls
- In-memory frame storage

### Hardware Requirements
- FFmpeg must be installed
- Internet connection required
- RTSP camera access needed

### Network Requirements
- Backend must reach RTSP camera
- Frontend must reach backend
- Sufficient bandwidth for streaming

---

## License & Support

**Project**: Open source contribution
**Maintainer**: Microsoft Innovation Hub India
**Support**: GitHub Issues
**Documentation**: Comprehensive guides included

---

## Quick Stats

📊 **Project Statistics**:
- Lines of code: ~3,500+
- Components: 3 React components
- Backend services: 2
- API endpoints: 6
- Documentation pages: 6
- Setup time: ~5 minutes
- Dependencies: ~20 npm packages

🎯 **Quality Metrics**:
- Security vulnerabilities: 0 (CodeQL scan)
- Build status: ✅ Passing
- Test coverage: Manual testing
- Code quality: Production-ready

---

**Built with ❤️ by Microsoft Innovation Hub India**
