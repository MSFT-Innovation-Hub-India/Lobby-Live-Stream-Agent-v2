# Testing Guide - Lobby Live Stream Agent v2

This guide helps you test the application functionality.

## Prerequisites for Testing

Since this application requires an actual RTSP stream and Azure OpenAI credentials, here are options for testing:

### Option 1: Use a Test RTSP Stream

You can use free public RTSP test streams for testing:

1. **Big Buck Bunny Test Stream**:
   ```
   rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4
   ```

2. **Public RTSP Test Server**:
   ```
   rtsp://rtsp.stream/pattern
   ```

Note: Public test streams may not always be available. For production testing, use your own RTSP camera.

### Option 2: Create a Local Test RTSP Stream

If you have FFmpeg installed, you can create a test RTSP stream from a video file:

```bash
# Install ffmpeg if not already installed
sudo apt install ffmpeg  # Ubuntu/Debian
brew install ffmpeg      # macOS

# Create test RTSP stream from a video file
ffmpeg -re -stream_loop -1 -i your-video.mp4 -c copy -f rtsp rtsp://localhost:8554/test
```

### Option 3: Use IP Camera Simulator

Use tools like IP Camera Viewer or VLC to create a simulated RTSP stream.

## Testing Steps

### 1. Backend Testing

Start the backend server:

```bash
cd backend
npm start
```

Expected output:
```
Server is running on port 3001
Stream endpoint: http://localhost:3001/api/stream
Analysis endpoint: http://localhost:3001/api/analysis
```

Test the health endpoint:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","message":"Server is running"}
```

### 2. Frontend Testing

In a new terminal, start the frontend:

```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 3. Integration Testing

1. **Open Browser**: Navigate to `http://localhost:5173`

2. **Enter RTSP URL**: Use one of the test streams above

3. **Start Stream**: Click "Start Stream" button
   - You should see the live video start playing
   - The status should change to "Streaming"

4. **Wait for Frame Capture**: After 60 seconds, the first frame should appear in the "Analyzed Frames" section below

5. **Verify Frame Analysis**:
   - Check that the captured frame image is displayed
   - Verify the timestamp is correct
   - Read the AI-generated description

6. **Stop Stream**: Click "Stop Stream" button
   - Video should stop
   - Status should change to "Stopped"

## Testing Without Azure OpenAI

If you don't have Azure OpenAI credentials configured, the application will still work but frame analysis will show an error message. The core streaming functionality will work perfectly.

To test streaming without AI analysis:

1. Don't configure the `.env` file (or leave Azure fields empty)
2. Start the application
3. Stream will work normally
4. Frames will be captured but analysis will show: "Azure OpenAI is not configured"

## Manual API Testing

### Test Stream Status
```bash
curl http://localhost:3001/api/stream/status
```

### Start Stream (API)
```bash
curl -X POST http://localhost:3001/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4"}'
```

### Get Analyzed Frames
```bash
curl http://localhost:3001/api/analysis/frames
```

### Stop Stream (API)
```bash
curl -X POST http://localhost:3001/api/stream/stop
```

## Expected Behavior

### Live Stream
- Should display within 3-5 seconds of starting
- Video controls should work (play, pause, volume, fullscreen)
- Should auto-restart if connection is lost
- Should display error message if stream fails

### Frame Capture
- First frame captured immediately when stream starts
- Subsequent frames every 60 seconds
- Frames stored in `backend/captures/` directory
- Old frames deleted when more than 20 exist

### Analyzed Frames Display
- New frames appear at the top of the grid
- Each frame shows: image, timestamp, AI analysis
- Grid is responsive (adapts to screen size)
- Refresh button manually updates the display

## Troubleshooting Tests

### Stream Not Loading
1. Check backend console for FFmpeg errors
2. Test RTSP URL in VLC media player first
3. Verify FFmpeg is installed: `ffmpeg -version`
4. Check network/firewall settings

### No Frames Appearing
1. Check `backend/captures/` directory for captured images
2. Review backend console for capture errors
3. Verify 60 seconds have passed since stream start
4. Check frontend console for API errors

### Azure OpenAI Errors
1. Verify `.env` file exists and has correct credentials
2. Check Azure OpenAI deployment is active
3. Verify deployment name matches in `.env`
4. Check API key has correct permissions

## Performance Testing

### Expected Performance
- Stream latency: 2-5 seconds
- Frame capture time: 1-2 seconds
- AI analysis time: 3-10 seconds (depending on Azure OpenAI)
- Frontend responsiveness: Instant

### Resource Usage
- Backend memory: ~100-200 MB
- Frontend memory: ~50-100 MB
- FFmpeg CPU: 5-20% (one stream)
- Network: Depends on stream quality

## Test Checklist

- [ ] Backend starts without errors
- [ ] Frontend builds successfully
- [ ] Frontend dev server starts
- [ ] Health endpoint returns OK
- [ ] Can enter RTSP URL
- [ ] Stream starts successfully
- [ ] Video plays in browser
- [ ] Video controls work
- [ ] Status indicator shows "Streaming"
- [ ] First frame captured within 60 seconds
- [ ] Frame appears in analyzed frames section
- [ ] Frame has timestamp
- [ ] Frame has analysis text (if Azure OpenAI configured)
- [ ] Multiple frames appear over time
- [ ] Can refresh frames manually
- [ ] Can stop stream
- [ ] Status indicator shows "Stopped"
- [ ] UI is responsive on mobile
- [ ] No console errors (except expected Azure OpenAI warnings if not configured)

## Demo Video/Screenshots

For demonstration purposes, you can:

1. Take screenshots of the UI at different stages
2. Record a short video showing the streaming and frame analysis
3. Document the setup process with screenshots

This will help users understand the application before setting it up themselves.

---

**Note**: For complete testing with AI analysis, you must have:
- Valid Azure OpenAI credentials
- GPT-4o deployment in Azure
- Configured `.env` file in backend directory
