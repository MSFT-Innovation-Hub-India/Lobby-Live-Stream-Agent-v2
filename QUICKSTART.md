# Quick Start Guide

Get up and running with Lobby Live Stream Agent v2 in minutes!

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
```

**Note:** The app works without Azure OpenAI, but frame analysis will be disabled.

## Running the Application

### Terminal 1: Start Backend
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

### Terminal 2: Start Frontend
```bash
cd frontend
npm run dev
```

Expected output:
```
➜  Local:   http://localhost:5173/
```

### Step 3: Open in Browser
Navigate to: **http://localhost:5173**

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

### 3. View Analyzed Frames
- First frame appears after 60 seconds
- New frames appear every 60 seconds
- Scroll down to see all captured frames with AI descriptions

### 4. Stop Streaming
- Click **"⏹️ Stop Stream"** button when done

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
- Up to 20 frames kept (older ones auto-deleted)

✅ **Performance:**
- Backend: ~100-200 MB RAM
- Frontend: ~50-100 MB RAM
- CPU: 5-20% for one stream

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
