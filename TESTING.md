# Testing Guide - AI Eye Hub Lobby Live Stream Agent v2

This guide helps you test the application functionality.

## Prerequisites for Testing

Since this application requires an actual RTSP stream and an AI backend, here are options for testing:

### AI Backend Options

**Edge Mode (vLLM)**:
- Requires NVIDIA GPU with ≥15 GB VRAM
- vLLM running with Phi-4-multimodal-instruct
- Set `MODEL_MODE=edge` in `.env`
- See [VLLM_DEPLOYMENT.md](VLLM_DEPLOYMENT.md) for setup

**Cloud Mode (Azure OpenAI)**:
- Requires Azure OpenAI account with GPT-4o deployment
- Set `MODEL_MODE=cloud` in `.env`
- Configure Azure credentials in `.env`

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

2. **Verify UI Elements**:
   - ✅ Eye-themed "AI Eye" logo with gradient text
   - ✅ Pulsing green indicator (AI active)
   - ✅ RTSP URL input field
   - ✅ Start/Stop buttons
   - ✅ Video player area
   - ✅ Prominent amber countdown timer banner

3. **Enter RTSP URL**: Use one of the test streams above

4. **Start Stream**: Click "Start Stream" button
   - ✅ Live video should start playing within 3-5 seconds
   - ✅ Status should change to "Streaming"
   - ✅ Countdown timer starts at 60 seconds
   - ✅ Model name appears in header (e.g., "Phi-4-multimodal" or "gpt-4o-mini")

5. **Wait for Frame Capture**: After 60 seconds, test:
   - ✅ First frame appears in gallery below
   - ✅ Frame shows thumbnail, timestamp, and AI caption
   - ✅ Countdown resets to 60 seconds
   - ✅ Frame gallery auto-refreshes

6. **Test Frame Modal**:
   - ✅ Click on captured frame
   - ✅ Modal opens with large image
   - ✅ Full scene description visible
   - ✅ People count breakdown shown (doors, reception, other)
   - ✅ Witty AI summary displayed
   - ✅ Close modal with X or background click

7. **Test Status Sync**:
   - ✅ Stop backend server (Ctrl+C in backend terminal)
   - ✅ Wait 5 seconds
   - ✅ UI should update to show "Not Streaming"
   - ✅ Video should stop
   - ✅ Restart backend and verify sync

8. **Test Memory Management**:
   - ✅ Let stream run for 10+ captures (10 minutes)
   - ✅ Verify only 10 frames shown in gallery
   - ✅ Check `backend/captures/` has max 10 files
   - ✅ Confirm old frames deleted

9. **Test HLS Stability**:
   - ✅ Start stream
   - ✅ Watch for 2-3 minutes continuously
   - ✅ Video should NOT blank out or restart
   - ✅ Status polling (every 5s) should not affect playback

10. **Stop Stream**: Click "Stop Stream" button
    - ✅ Video should stop
    - ✅ Status should change to "Stopped"
    - ✅ Captured frames remain visible

## Testing Without AI

If you don't have Azure OpenAI credentials or a GPU for vLLM, the application will still work but frame analysis will show an error message. The core streaming functionality will work perfectly.

To test streaming without AI analysis:

1. Don't configure AI settings in `.env` (leave `MODEL_MODE`, Azure fields, and vLLM fields empty)
2. Start the application
3. Stream will work normally
4. Frames will be captured but analysis will show: "AI is not configured"

## Testing Edge Mode (vLLM)

1. Verify vLLM is running:
   ```bash
   curl http://localhost:8000/health
   ```
2. Set `MODEL_MODE=edge` in `.env`
3. Start the application and stream
4. After 60 seconds, verify:
   - ✅ Frame is analyzed (not a refusal message)
   - ✅ Model name shows "microsoft/Phi-4-multimodal-instruct"
   - ✅ Response format matches scenario (markdown for default, JSON for banking)
5. Test scenario switching:
   - Change `PROMPT_PROFILE=ai-first-bank` in `.env`, restart backend
   - Verify JSON output with people counts, alerts, anomalies

## Testing Cloud Mode (Azure OpenAI)

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

### Azure OpenAI Errors (Cloud Mode)
1. Verify `.env` file has `MODEL_MODE=cloud` and correct credentials
2. Check Azure OpenAI deployment is active
3. Verify deployment name matches in `.env`
4. Check API key has correct permissions

### vLLM Errors (Edge Mode)
1. Check vLLM health: `curl http://localhost:8000/health`
2. Check GPU: `nvidia-smi`
3. Restart vLLM: `systemctl --user restart vllm`
4. Check logs: `journalctl --user -u vllm -f`
5. If model refusals persist, check system prompt file exists

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
- vLLM GPU memory: ~8.8 GB (Phi-4-multimodal FP16)
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

**Note**: For complete testing with AI analysis, you must have either:
- **Edge mode**: vLLM running with Phi-4-multimodal-instruct on a supported GPU
- **Cloud mode**: Valid Azure OpenAI credentials and GPT-4o deployment

See [VLLM_DEPLOYMENT.md](VLLM_DEPLOYMENT.md) for edge setup or configure Azure credentials in `.env` for cloud mode.
