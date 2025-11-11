# Quick Start Guide

Get up and running with **AI Eye - Hub Lobby Live Stream Agent v2** in minutes!

## What You'll Get

✅ **Live RTSP video streaming** in your browser  
✅ **AI-powered frame analysis** with GPT-4o Vision  
✅ **Eye-themed professional UI** with prominent countdown timer  
✅ **Accurate people counting** and witty scene descriptions  
✅ **Click-to-expand frame details** with full analysis  
✅ **Real-time status sync** and memory management

## Prerequisites

1. **Node.js** (v18+) and **npm** installed
2. **FFmpeg** installed (required for video streaming)
3. **Azure OpenAI** account with GPT-4o deployment (optional for AI features)

### Install FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install ffmpeg -y
```

**macOS:**
```bash
brew install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

## Installation (5 minutes)

### Step 1: Clone Repository
```bash
git clone https://github.com/MSFT-Innovation-Hub-India/Lobby-Live-Stream-Agent-v2.git
cd Lobby-Live-Stream-Agent-v2
```

### Step 2: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 3: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### Step 4: Configure Backend (Optional)
If you want AI frame analysis, configure Azure OpenAI:

```bash
cd ../backend
cp .env.example .env
# Edit .env with your Azure OpenAI credentials
```

Required variables in `.env`:
```env
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
RTSP_URL=rtsp://your-camera-url
```

**Note:** The app works without Azure OpenAI, but AI frame analysis will be disabled. You'll still get live streaming!

### Step 5: Configure Frontend
Set the backend URL for the frontend:

```bash
cd ../frontend
cp .env.example .env
```

The `.env` file contains:
```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:3001

# Default RTSP Stream URL
VITE_DEFAULT_RTSP_URL=rtsp://admin:%3FW%21ndows%4010@10.11.70.10:554
```

**Note:** 
- For local development, the default `http://localhost:3001` works perfectly
- The RTSP URL will be pre-filled in the UI settings - you can change it there
- Change these values only when deploying to production

## Running the Application

### Terminal 1: Start Backend
```bash
cd backend
npm start
```

Expected output:
```
✓ Server is running on port 3001
✓ Stream endpoint: http://localhost:3001/api/stream
✓ Analysis endpoint: http://localhost:3001/api/analysis
✓ Azure OpenAI configured: gpt-4o-mini
```

### Terminal 2: Start Frontend
```bash
cd frontend
npm run dev
```

Expected output:
```
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Step 3: Open in Browser
Navigate to: **http://localhost:5173**

You should see:
- 🎨 **Eye-themed "AI Eye" logo** with gradient text
- 🟢 **Pulsing green indicator** (AI is active)
- 📹 **Video player area** 
- ⏱️ **Prominent countdown timer banner** (amber colored)
- 🖼️ **Frame gallery** below (will populate after captures)

## Using the Application

### 1. Test with Public RTSP Stream

Use this free test stream to get started:
```
rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4
```

### 2. Start Streaming
1. Enter the RTSP URL in the input field
2. Click **"▶️ Start Stream"** button
3. Video will start playing within 3-5 seconds
4. **Countdown timer** starts showing "Next capture in: 60 seconds"

### 3. View Analyzed Frames
- First frame appears after **60 seconds**
- New frames appear automatically every 60 seconds
- Scroll down to frame gallery
- **Click any frame** to open full detail modal with:
  - Large frame image
  - Complete scene description
  - People count breakdown (doors, reception, other areas)
  - Witty AI summary
  - Timestamp

### 4. Monitor Status
- **Green indicator** pulsing = AI is active
- **Countdown timer** shows seconds until next capture
- **Model name** displayed in header (from your .env file)
- Status syncs with backend every 5 seconds

### 5. Stop Streaming
- Click **"⏹️ Stop Stream"** button when done
- All frames remain visible
- Can restart stream anytime

## What to Expect

### After Starting Stream:
✅ Video plays immediately  
✅ Countdown timer starts at 60 seconds  
✅ Status shows "Streaming"  
✅ Model name appears (e.g., "gpt-4o-mini")  

### After 60 Seconds:
✅ First frame captured and analyzed  
✅ Frame appears in gallery with AI caption  
✅ People count displayed  
✅ Countdown resets to 60  

### Clicking a Frame:
✅ Modal opens with large image  
✅ Full analysis details shown  
✅ People count breakdown visible  
✅ Close with X or click outside  

## Features to Try

1. **Frame Modal**: Click any captured frame to see full analysis
2. **Countdown Timer**: Highly visible amber banner with large font
3. **Eye Branding**: Notice the gradient "AI Eye" logo with pulsing indicator
4. **Status Sync**: Stop backend server and watch UI update automatically
5. **Memory Management**: Let it run - only keeps last 10 frames
6. **Witty Captions**: AI generates creative, context-specific descriptions

## Troubleshooting

### Issue: "FFmpeg not found"
**Solution:** Install FFmpeg (see Prerequisites above)

### Issue: Stream not loading
**Solutions:**
- Verify RTSP URL is correct
- Test URL in VLC media player first
- Check firewall settings

### Issue: No frames appearing
**Wait:** First frame takes 60 seconds to appear
**Check:** Look in `backend/captures/` for captured images

### Issue: Many .ts files in backend/stream/ folder
**This is normal!** These are HLS video segments (2-second chunks)
**Auto-cleanup:** FFmpeg automatically deletes old segments during streaming (max 10-15 files)
**After stopping:** Segments remain until next stream starts (reuses folder)
**Storage:** Each segment is ~200KB-500KB, total ~2-7MB maximum
**Manual cleanup:** Can safely delete all `.ts` and `.m3u8` files from `stream/` folder when not streaming

### Issue: Azure OpenAI errors
**If not configured:** App will work but show "Azure OpenAI is not configured" message
**If configured:** Verify credentials in `.env` file

## What to Expect

✅ **Streaming:**
- Live video displays within 3-5 seconds
- Low latency (~2-5 seconds behind real-time)
- Video controls work (play, pause, volume, fullscreen)

✅ **Frame Analysis:**
- First frame captured immediately when stream starts
- Then every 60 seconds automatically
- AI analyzes and describes what's in the frame
- Up to 10 frames kept (older ones auto-deleted from disk)

✅ **Performance:**
- Backend: ~100-200 MB RAM
- Frontend: ~50-100 MB RAM
- CPU: 5-20% for one stream
- Disk: ~2-7MB for video segments (auto-managed), <5MB for frame images

✅ **Storage:**
- `backend/stream/` folder: 10-15 `.ts` files during streaming (auto-deleted)
- `backend/captures/` folder: Max 10 frame images (old ones auto-deleted)

## Next Steps

📖 **Read Full Documentation:** See [README.md](README.md) for complete details

🏗️ **Understand Architecture:** Check [ARCHITECTURE.md](ARCHITECTURE.md) for design details

🧪 **Testing Guide:** See [TESTING.md](TESTING.md) for comprehensive testing

🔐 **Production Setup:** Review security considerations in README.md

## Common Use Cases

### Use Case 1: Lobby Monitoring
Monitor building lobbies with automatic AI analysis of foot traffic and activities.

### Use Case 2: Security Surveillance
Real-time streaming with intelligent frame analysis for security purposes.

### Use Case 3: Retail Analytics
Analyze customer behavior and store activity patterns.

### Use Case 4: Smart Building
Monitor and analyze building usage and occupancy.

## Getting Azure OpenAI Access

1. Go to [Azure Portal](https://portal.azure.com)
2. Create Azure OpenAI resource
3. Deploy GPT-4o model
4. Get credentials from "Keys and Endpoint" section
5. Add to backend `.env` file

## Support

- 📝 **Issues:** Open an issue on GitHub
- 📧 **Contact:** See README.md for contact information
- 💬 **Discussions:** Use GitHub Discussions for questions

## Quick Reference

**Backend API:**
- Health: `http://localhost:3001/health`
- Stream Status: `http://localhost:3001/api/stream/status`
- Analyzed Frames: `http://localhost:3001/api/analysis/frames`

**Frontend:**
- Development: `http://localhost:5173`
- Build: `npm run build` (creates `dist/` folder)

**Directories:**
- Stream segments: `backend/stream/` (auto-generated)
- Captured frames: `backend/captures/` (auto-generated)

---

🎉 **Congratulations!** You now have a working RTSP live stream application with AI-powered frame analysis!
