# AI Eye - Hub Lobby Live Stream Agent v2

<div align="center">

**Real-time Intelligent Stream Analysis & Monitoring**

*Powered by Azure OpenAI GPT-4o Vision*

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [What's New in v2](#whats-new-in-v2)
- [Understanding the Technology Stack](#understanding-the-technology-stack)
- [Architecture Deep Dive](#architecture-deep-dive)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Performance & Memory Management](#performance--memory-management)
- [Security Best Practices](#security-best-practices)

---

## 🎯 Overview

**AI Eye - Hub Lobby Live** is a sophisticated web application that combines real-time video streaming with artificial intelligence-powered scene analysis. It monitors lobby environments through live RTSP camera feeds and provides intelligent, witty insights about what's happening in the space.

### What Does It Do?

1. **Streams Live Video**: Displays real-time footage from RTSP cameras (like IP security cameras) in your web browser
2. **Captures Frames**: Automatically takes snapshots every 60 seconds
3. **AI Analysis**: Uses Azure OpenAI's GPT-4o Vision model to analyze each frame
4. **Provides Insights**: Generates creative, witty descriptions and counts people in different areas
5. **Displays Results**: Shows analyzed frames with detailed information in a beautiful, modern interface

### Key Features

- ✅ **Live RTSP Streaming** with HLS conversion for browser compatibility
- ✅ **AI-Powered Frame Analysis** with people counting and scene description
- ✅ **Dynamic Witty Captions** that comment on actual activities
- ✅ **Real-time People Counting** (near doors, at reception, other areas)
- ✅ **Modal Frame Details** with expandable views
- ✅ **Streaming Status Sync** - UI reflects actual backend state
- ✅ **Memory Management** - automatically cleans up old frames
- ✅ **Prominent Countdown Timer** for visibility from across the lobby
- ✅ **Modern, Responsive UI** built with React and Tailwind CSS

---

## 🆕 What's New in v2

### The .tsx to .jsx Migration

**Q: What's the difference between .tsx and .jsx?**

- **TypeScript (.tsx)**: A programming language that adds type checking to JavaScript. You must define what type of data each variable holds (string, number, object, etc.). This catches errors before running the code but requires more setup and learning.

- **JavaScript (.jsx)**: Standard JavaScript with React syntax. More flexible, easier to get started, and no type definitions needed. This is what we're using now.

**Why We Switched:**
1. **Simplicity**: JSX is easier to understand and modify without TypeScript knowledge
2. **Faster Development**: No need to write type definitions for everything
3. **Flexibility**: JavaScript is more forgiving and easier to prototype with
4. **Community**: More examples and tutorials available in JSX format
5. **No Build Errors**: TypeScript can be strict and cause build errors that take time to fix

**Note**: Both are valid choices. TypeScript is great for large teams and complex apps, but JSX is perfect for getting things done quickly and learning React.

### Design & UX Improvements

- **Eye-Themed Branding**: New "AI Eye" logo with pulsing indicator showing AI is actively watching
- **Gradient Text Styling**: Modern gradient effects on the title
- **Prominent Countdown**: Large, amber-colored countdown banner visible from far away
- **Better Frame Details**: Click any frame to see full analysis in a modal
- **Status Synchronization**: UI automatically reflects actual streaming state
- **Dynamic Captions**: AI generates varied, context-specific witty observations

---

## 🧩 Understanding the Technology Stack

### What is Node.js?

**Node.js** is a runtime that lets you run JavaScript on a server (backend), not just in browsers. Think of it as the "engine" that powers your backend server.

- **Why we use it**: Fast, efficient, great for handling multiple connections (like video streaming)
- **What it does here**: Runs our backend server that handles video conversion and AI analysis

### What is Express?

**Express** is a web framework for Node.js that makes it easy to build web servers and APIs.

- **Why we use it**: Simple way to create REST API endpoints
- **What it does here**: Handles HTTP requests (like "start stream", "get frames", etc.)

### What is React?

**React** is a JavaScript library for building user interfaces (frontends). It breaks your UI into reusable "components."

- **Why we use it**: Makes complex UIs easier to build and maintain
- **What it does here**: Powers our entire frontend dashboard with video player, controls, and frame gallery

### What is Vite?

**Vite** is a modern build tool and development server for frontend projects.

- **Why we use it**: Super fast hot-reload during development, optimized production builds
- **What it does here**: Runs our frontend development server and builds the production version

### What is RTSP (Real-Time Streaming Protocol)?

**RTSP** is a network protocol used by IP cameras and security cameras to stream live video.

- **Why cameras use it**: Designed for real-time video delivery with low latency
- **The problem**: Web browsers cannot play RTSP streams directly (only specialized software like VLC can)
- **Format**: `rtsp://username:password@camera-ip:port/stream`
- **What it does here**: Your IP camera broadcasts video using RTSP, which our backend receives

**Think of it like**: A TV broadcast signal that only special receivers can understand - browsers aren't one of them!

### What is HLS (HTTP Live Streaming)?

**HLS** is a video streaming protocol invented by Apple that breaks video into small chunks and delivers them over HTTP.

- **How it works**: 
  1. Video is split into small segments (2-second chunks)
  2. Each segment is saved as a `.ts` file
  3. A playlist file (`.m3u8`) tells browsers which segments to play in order
  4. Browser downloads and plays segments one after another
- **Why browsers love it**: Uses standard HTTP, works everywhere (phones, tablets, computers)
- **Why we use it**: Browsers can play HLS, but can't play RTSP (which cameras use)
- **What it does here**: Allows your browser to play the camera's video feed smoothly

**Think of it like**: Breaking a movie into small clips, then watching them in sequence - each clip loads just before you need it!

### What is FFmpeg?

**FFmpeg** is a powerful, free, open-source command-line tool for video/audio processing. It's like the "Swiss Army knife" of video conversion.

- **What it can do**: 
  - Convert video formats (MP4, AVI, MOV, etc.)
  - Change video codecs (H.264, H.265, VP9, etc.)
  - Extract audio from video
  - Resize, crop, and rotate videos
  - Stream video in real-time
  - Capture screenshots from video
- **Why we use it**: Converts RTSP streams from cameras into HLS format for browsers
- **What it does here**: 
  1. **For Live Streaming**: Acts as the "translator" between your camera (RTSP) and web browser (HLS)
  2. **For Frame Capture**: Grabs still images from the video stream every 60 seconds
- **How it works in our app**:
  ```
  Camera (RTSP) → FFmpeg → Browser-friendly video (HLS) → Your Browser
  Camera (RTSP) → FFmpeg → Still Image (JPEG) → AI Analysis
  ```

**Think of it like**: A universal translator that speaks both "camera language" (RTSP) and "browser language" (HLS)!

### How RTSP + FFmpeg + HLS Work Together

Here's the complete flow of how video gets from your camera to your browser:

1. **IP Camera**: Broadcasts live video using RTSP protocol (like a radio station broadcasting)
2. **Backend Server**: Receives RTSP stream using FFmpeg
3. **FFmpeg Conversion**: 
   - Decodes RTSP video
   - Encodes to H.264 (browser-compatible codec)
   - Splits into 2-second segments
   - Creates `.ts` files and `.m3u8` playlist
   - Saves to `backend/stream/` folder
4. **Backend Web Server**: Makes the `stream.m3u8` file available at `http://localhost:3001/stream/stream.m3u8`
5. **Frontend React App**: Uses HLS.js library to read the playlist
6. **HLS.js Library**: 
   - Fetches `.m3u8` playlist
   - Downloads `.ts` segments in order
   - Feeds video data to browser's video player
7. **Your Browser**: Displays smooth, continuous live video!

**Visual Flow:**
```
┌──────────────┐
│  IP Camera   │
│ (RTSP Stream)│
└──────┬───────┘
       │ rtsp://camera-ip/stream
       │
       ▼
┌──────────────────────────────────────┐
│  Backend Server (Node.js + FFmpeg)  │
│                                      │
│  FFmpeg Process:                     │
│  1. Receive RTSP                     │
│  2. Decode video                     │
│  3. Encode to H.264                  │
│  4. Split into 2-sec segments        │
│  5. Create .ts files                 │
│  6. Generate .m3u8 playlist          │
└──────┬───────────────────────────────┘
       │ HTTP: /stream/stream.m3u8
       │
       ▼
┌──────────────────────────────────────┐
│  Frontend (React + HLS.js)          │
│                                      │
│  1. Fetch .m3u8 playlist            │
│  2. Download .ts segments            │
│  3. Decode video                     │
│  4. Display in <video> element       │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────┐
│ Your Browser │
│ (Live Video) │
└──────────────┘
```

**Why This Complexity?**
- **Camera speaks RTSP**: Efficient for streaming, but browsers don't support it
- **Browser speaks HLS**: Universally supported, but cameras don't output it
- **FFmpeg is the bridge**: Translates in real-time with minimal delay (2-5 seconds)

**Benefits:**
✅ Works with any RTSP camera (no special hardware needed)  
✅ Plays in any modern browser (no plugins required)  
✅ Low latency (~2-5 seconds behind real-time)  
✅ Adaptive streaming (quality adjusts to network speed)  
✅ Works on desktop, mobile, and tablets

### What is Tailwind CSS?

**Tailwind** is a utility-first CSS framework with pre-built styling classes.

- **Why we use it**: Fast styling with consistent design, no need to write custom CSS
- **What it does here**: Makes our UI look professional with minimal effort

---

## 🏗️ Architecture Deep Dive

### The Big Picture

```
┌─────────────┐         ┌─────────────┐         ┌──────────────┐
│  RTSP       │  RTSP   │  Backend    │  HTTP   │   Frontend   │
│  Camera     │────────▶│  (Node.js)  │◀─────▶│   (React)    │
│             │         │             │         │              │
└─────────────┘         └─────────────┘         └──────────────┘
                              │
                              │ HTTP
                              ▼
                        ┌──────────────┐
                        │ Azure OpenAI │
                        │   GPT-4o     │
                        └──────────────┘
```

### Backend Architecture (Node.js + Express)

The backend is the "server" that does the heavy lifting:

#### 1. **Server Entry Point** (`server.js`)
- Creates an Express web server
- Listens on port 3001
- Serves static files (HLS video segments and captured frame images)
- Registers API routes

#### 2. **Stream Service** (`services/streamService.js`)

**Purpose**: Converts RTSP video from camera to HLS format that browsers can play

**How it works**:
1. Receives RTSP URL from frontend
2. Spawns FFmpeg process that:
   - Connects to RTSP camera
   - Converts to H.264 codec (browser-compatible)
   - Splits video into 2-second segments (.ts files)
   - Creates playlist file (.m3u8)
3. Browser fetches playlist and plays segments sequentially

#### 3. **Frame Analysis Service** (`services/frameAnalysisService.js`)

**Purpose**: Captures frames from the camera and analyzes them with AI

**How it works**:
- **Frame Capture** (every 60 seconds): Uses FFmpeg to grab single frame, saves as JPEG
- **AI Analysis**: Sends image to Azure OpenAI GPT-4o Vision for analysis
- **Store Results**: Keeps last 10 frames in memory, deletes old files

### Frontend Architecture (React + Vite)

The frontend is the "client" that users see in their browser:

#### Main Component (`LobbyDashboard.jsx`)

**State Management**:
- `isStreaming`: Is video playing?
- `streamUrl`: HLS playlist URL
- `analyzedFrames`: Array of AI-analyzed frames
- `seconds`: Countdown timer
- `modelName`: AI model name from backend

**Key Functions**:
- `handleStreamToggle()`: Start/stop streaming
- `fetchAnalyzedFrames()`: Get latest frames from backend (every 10s)
- `fetchStreamStatus()`: Sync with backend state (every 5s)

### Data Flow Example

**When you click "Start Stream":**

1. Frontend sends RTSP URL to backend
2. Backend starts FFmpeg to convert RTSP → HLS
3. Backend starts frame capture timer (60s intervals)
4. Frontend gets HLS URL, initializes video player
5. HLS player fetches segments and plays video
6. After 60s, backend captures frame, sends to AI
7. AI analyzes and returns JSON with counts + description
8. Backend stores frame + analysis
9. Frontend polls every 10s, gets new frames, displays them

---

## 📋 Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version` and `npm --version`

2. **FFmpeg** (latest version)
   - **Windows**: Download from https://ffmpeg.org/download.html, add to PATH
   - **macOS**: `brew install ffmpeg`
   - **Linux**: `sudo apt install ffmpeg`
   - Verify: `ffmpeg -version`

3. **Azure OpenAI Account**
   - Sign up at https://azure.microsoft.com/
   - Create Azure OpenAI resource
   - Deploy GPT-4o or GPT-4o-mini model
   - Get endpoint URL and API key

---

## 🚀 Installation

### Step 1: Clone the Repository

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

---

## ⚙️ Configuration

### Backend Configuration

1. **Copy the example environment file**:
```bash
cd backend
cp .env.example .env
```

2. **Edit `.env` file** with your settings:

```env
# Server Configuration
PORT=3001

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o-mini
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Frame Analysis Configuration
MAX_ANALYZED_FRAMES=10

# RTSP Stream Configuration
RTSP_URL=rtsp://admin:%3FW%21ndows%4010@10.11.70.10:554
```

**How to get Azure OpenAI credentials**:
1. Go to https://portal.azure.com
2. Create Azure OpenAI resource
3. Deploy a GPT-4o or GPT-4o-mini model
4. Copy endpoint URL and API key from "Keys and Endpoint"

### Frontend Configuration

1. **Copy the example environment file**:
```bash
cd frontend
cp .env.example .env
```

2. **Edit `.env` file** with your backend URL and default RTSP stream:

```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:3001

# Default RTSP Stream URL
VITE_DEFAULT_RTSP_URL=rtsp://admin:%3FW%21ndows%4010@10.11.70.10:554
```

**Important Notes**:
- Change `VITE_API_BASE_URL` to your production backend URL when deploying
- For local development, use `http://localhost:3001`
- For production, use your actual backend domain (e.g., `https://api.yourdomain.com`)
- `VITE_DEFAULT_RTSP_URL` will be pre-filled in the UI settings input field
- Users can override the RTSP URL directly in the UI without changing the `.env` file
- All Vite environment variables must start with `VITE_` to be exposed to the frontend

---

## 🎮 Usage

### Starting the Application

#### Terminal 1: Start Backend

```bash
cd backend
npm start
```

#### Terminal 2: Start Frontend

```bash
cd frontend
npm run dev
```

---

## 🖥️ VM Deployment (Current Setup)

The application is deployed on the GPU VM (`10.11.70.24`) using **tmux** sessions so that the backend and frontend survive SSH disconnects. The Phi-4 model server runs as a **systemd** service that auto-starts on boot.

### 🌐 Open the App

From any machine on the same network, open this URL in your browser:

```
http://10.11.70.24:5173
```

### Current Running Services

| Service              | How it runs       | URL                           | Port |
|----------------------|-------------------|-------------------------------|------|
| Phi-4 Model Server   | systemd service (`phi4-server`) | `http://localhost:8000` | 8000 |
| Backend (Node.js)    | tmux session (`backend`)        | `http://localhost:3001` | 3001 |
| Frontend (React)     | tmux session (`frontend`)       | `http://10.11.70.24:5173` | 5173 |

---

### 🔧 Troubleshooting: Step-by-Step

If the app isn't working (no scene analysis, stream not loading, etc.), follow these steps.

#### Step 1: SSH into the VM

From your Windows machine, open a terminal (PowerShell, Windows Terminal, or VS Code terminal) and run:

```bash
ssh azureuser@10.11.70.24
```

Enter your password when prompted. You are now on the VM.

#### Step 2: Check if everything is running

```bash
# Check tmux sessions (backend & frontend)
tmux ls

# Check model server
sudo systemctl status phi4-server
```

You should see:
- Two tmux sessions: `backend` and `frontend`
- phi4-server showing `active (running)`

#### Step 3: Check health of each service

```bash
# Model server health (should return JSON with "status":"ok")
curl -m 10 http://localhost:8000/health

# Backend health (should return HTML)
curl -m 5 http://localhost:3001/ | head -1

# Frontend health (should return HTML)
curl -m 5 http://localhost:5173/ | head -1
```

---

### 🧠 Fix: Model Server Stuck (Most Common Issue)

**Symptom:** The app shows "Scene analysis in progress" but no results appear, or analysis keeps timing out.

**Cause:** The Phi-4 model server gets stuck processing a request and stops responding.

**Fix — restart the model server:**

```bash
# Step 1: SSH into the VM
ssh azureuser@10.11.70.24

# Step 2: Restart the model server
sudo systemctl restart phi4-server

# Step 3: Wait ~30 seconds for the model to load into GPU memory, then verify
sleep 30
curl -m 10 http://localhost:8000/health
# Should return: {"status":"ok","model":"/storage/models/phi-4-multimodal"}

# Step 4: Restart the backend (to clear timeout state)
tmux kill-session -t backend
tmux new-session -d -s backend -c /home/azureuser/Lobby-Live-Stream-Agent-v2/backend 'npm start'

# Step 5: Verify everything is running
tmux ls
```

Then refresh the app in your browser (`http://10.11.70.24:5173`) and click "Start Stream" again.

---

### 🌐 Fix: App Breaks When VS Code SSH Session is Closed

**Symptom:** Everything works while VS Code Remote SSH is open, but the moment you close VS Code, the app stops showing the stream, scene analysis disappears, the UI switches to "Cloud LLM" mode, and the phi-4-multimodal option is disabled.

**Cause:** `VITE_API_BASE_URL` in the `.env` file is set to `http://localhost:3001`. When you access the app from a browser on a different machine (e.g., your Windows laptop), the browser tries to reach `localhost:3001` — which is **your laptop**, not the VM. It only works while VS Code is open because VS Code automatically port-forwards port 3001 from the VM to your laptop. When VS Code closes, the port forward dies and the frontend loses connection to the backend.

**Fix:** The `.env` file must use the **VM's actual IP address**, not `localhost`:

```bash
# WRONG - breaks when VS Code is closed:
VITE_API_BASE_URL=http://localhost:3001

# CORRECT - works independently of VS Code:
VITE_API_BASE_URL=http://10.11.70.24:3001
```

After changing the `.env` file, restart the frontend:

```bash
ssh azureuser@10.11.70.24
tmux kill-session -t frontend 2>/dev/null
tmux new-session -d -s frontend -c /home/azureuser/Lobby-Live-Stream-Agent-v2/frontend 'npm run dev -- --host 0.0.0.0'
```

> **⚠️ IMPORTANT:** Never use `localhost` in `VITE_API_BASE_URL` or `VITE_DEFAULT_RTSP_URL` when the app is accessed from a different machine than the VM. Always use the VM's IP address (`10.11.70.24`). The `.env.example` file already reflects this.

---

### 🔄 Fix: Backend or Frontend Stopped

**Symptom:** The web page doesn't load, or the stream doesn't start.

```bash
# Step 1: SSH into the VM
ssh azureuser@10.11.70.24

# Step 2: Check which sessions are running
tmux ls

# Step 3: Restart whatever is missing

# Restart backend:
tmux kill-session -t backend 2>/dev/null
tmux new-session -d -s backend -c /home/azureuser/Lobby-Live-Stream-Agent-v2/backend 'npm start'

# Restart frontend:
tmux kill-session -t frontend 2>/dev/null
tmux new-session -d -s frontend -c /home/azureuser/Lobby-Live-Stream-Agent-v2/frontend 'npm run dev -- --host 0.0.0.0'

# Step 4: Verify
tmux ls
```

---

### 📋 Viewing Console Logs

To troubleshoot issues by looking at live logs:

```bash
# SSH into the VM
ssh azureuser@10.11.70.24

# View backend logs (live)
tmux attach -t backend

# View frontend logs (live)
tmux attach -t frontend

# View model server logs
sudo journalctl -u phi4-server -f

# IMPORTANT: To exit a tmux session WITHOUT stopping it:
#   Press Ctrl+B, then press D
#
# To scroll up through log history inside tmux:
#   Press Ctrl+B, then press [
#   Use arrow keys or Page Up/Down to scroll
#   Press q to exit scroll mode
```

---

### 🔁 Restarting Everything After a VM Reboot

```bash
# SSH into the VM
ssh azureuser@10.11.70.24

# The model server auto-starts on boot (systemd), verify it's running:
sudo systemctl status phi4-server
# Wait until it shows "active (running)" — may take ~30 seconds after boot

# Start backend
tmux new-session -d -s backend -c /home/azureuser/Lobby-Live-Stream-Agent-v2/backend 'npm start'

# Start frontend
tmux new-session -d -s frontend -c /home/azureuser/Lobby-Live-Stream-Agent-v2/frontend 'npm run dev -- --host 0.0.0.0'

# Verify all three services
tmux ls
curl -m 10 http://localhost:8000/health
curl -m 5 http://localhost:3001/ | head -1
curl -m 5 http://localhost:5173/ | head -1
```

---

### Using the Application

1. Open browser → **http://10.11.70.24:5173**
2. Configure RTSP URL (format: `rtsp://username:password@camera-ip:port/stream`)
3. Click "Start Stream"
4. Watch live video and AI analysis appear every 60 seconds
5. Click frames to see detailed analysis
6. Click "Stop Stream" when done

---

## 🔍 How It Works

### Complete End-to-End Flow

Let me walk you through exactly what happens when you use the application:

#### Step 1: You Start the Stream
- You enter an RTSP URL (e.g., `rtsp://admin:password@192.168.1.100:554/stream`)
- You click "Start Stream" button
- Frontend sends this URL to backend via HTTP POST request

#### Step 2: Backend Starts FFmpeg (Two Separate Processes)

**Process 1: Live Streaming (Continuous)**
- Backend spawns FFmpeg process #1 with command:
  ```bash
  ffmpeg -rtsp_transport tcp -i rtsp://camera-ip/stream \
         -c:v libx264 -preset ultrafast -tune zerolatency \
         -f hls -hls_time 2 -hls_list_size 10 \
         -hls_flags delete_segments+append_list \
         backend/stream/stream.m3u8
  ```
- FFmpeg connects to your camera's RTSP stream
- Receives video data in real-time
- Encodes to H.264 (browser-friendly codec)
- Splits into 2-second segments (`segment0.ts`, `segment1.ts`, etc.)
- Writes segments to `backend/stream/` folder
- Creates/updates `stream.m3u8` playlist file
- Auto-deletes old segments (keeps last 10)

**Process 2: Frame Capture (Every 60 Seconds)**
- Backend starts a timer that triggers every 60 seconds
- Each trigger spawns FFmpeg process #2 with command:
  ```bash
  ffmpeg -rtsp_transport tcp -i rtsp://camera-ip/stream \
         -vframes 1 -f image2 \
         backend/captures/frame_timestamp.jpg
  ```
- FFmpeg connects to camera (separate connection)
- Grabs single frame
- Saves as JPEG image
- Process terminates (doesn't stay running)

#### Step 3: Frontend Displays Live Video
- Backend responds with stream URL: `/stream/stream.m3u8`
- Frontend initializes HLS.js player
- HLS.js fetches `stream.m3u8` playlist
- Playlist contains list of `.ts` segments to play
- HLS.js downloads segments one by one
- Feeds video data to `<video>` HTML element
- Browser plays smooth, continuous video

**What You See:**
- Live video appears within 3-5 seconds
- Countdown timer shows "Next capture in: 60 seconds"
- Video plays continuously with ~2-5 second latency

#### Step 4: AI Analyzes Captured Frame
- Backend reads the JPEG file created by FFmpeg
- Converts image to Base64 encoding
- Sends to Azure OpenAI API with this prompt:
  ```
  "Analyze this lobby surveillance frame. Count people in different areas
  (near doors, at reception, other areas). Generate a witty, context-specific
  caption describing what's actually happening. Be specific and creative."
  ```
- Azure OpenAI GPT-4o Vision analyzes the image
- Returns JSON response:
  ```json
  {
    "peopleCount": {
      "nearDoors": 2,
      "atReception": 1,
      "otherAreas": 3,
      "total": 6
    },
    "sceneDescription": "The lobby is moderately busy...",
    "wittySummary": "Six people making the lobby feel alive!"
  }
  ```

#### Step 5: Backend Stores Frame + Analysis
- Stores frame metadata in memory array:
  ```javascript
  {
    id: 1,
    timestamp: '2025-11-11T10:30:00Z',
    filepath: '/captures/frame_1731320400.jpg',
    analysis: { peopleCount: {...}, sceneDescription: "...", ... }
  }
  ```
- Keeps maximum 10 frames
- When 11th frame arrives, deletes oldest frame from memory AND disk

#### Step 6: Frontend Polls and Updates
**Every 5 seconds** (Status Polling):
- Frontend calls `GET /api/stream/status`
- Gets: streaming status, model name, capture status
- Updates UI indicators (green pulsing dot, model name)
- Updates countdown timer
- Uses functional setState to prevent HLS player reset

**Every 10 seconds** (Frame Polling):
- Frontend calls `GET /api/analysis/frames`
- Receives array of analyzed frames
- Updates frame gallery
- Countdown resets to 60 after new frame appears

#### Step 7: You Interact with UI
- **Click a frame** → Modal opens with full image and detailed analysis
- **Video controls** → Play/pause, volume, fullscreen work normally
- **Stop stream** → Backend kills FFmpeg processes, frontend clears video

### Video Streaming Pipeline

```
RTSP Camera → FFmpeg Conversion → HLS Segments → HLS.js Player → Browser
```

**Detailed breakdown:**
```
Camera broadcasts     FFmpeg receives and      Creates .ts files     HLS.js downloads      Browser displays
RTSP video stream  →  converts to H.264     →  and .m3u8 playlist → and decodes video  →  smooth live video
(continuous)          (real-time encoding)     (every 2 seconds)     (HTTP requests)       (<video> element)
```

### AI Analysis Pipeline

```
RTSP Camera → FFmpeg Capture → JPEG → Base64 → Azure AI → JSON → Display
```

**Detailed breakdown:**
```
Camera broadcasts    FFmpeg grabs          Saves as JPEG      Encodes to        Sends to Azure      AI returns        Frontend displays
RTSP video stream → single frame (60s) →  image file      →  Base64 string  → OpenAI GPT-4o  →  JSON analysis  →  in gallery + modal
(continuous)         (separate process)     (on disk)          (in memory)       (vision API)        (with counts)     (with timestamps)
```

### Why Two Separate FFmpeg Processes?

**Live Streaming Process (Continuous):**
- Runs constantly while streaming
- High priority - any interruption breaks video
- Handles continuous video encoding

**Frame Capture Process (Periodic):**
- Runs only for 1-2 seconds every 60 seconds
- Independent - if it fails, streaming continues
- Low priority - doesn't affect user experience

**Benefit:** If AI analysis crashes or takes too long, your live video keeps playing without interruption!

### Data Flow Timeline (First 2 Minutes)

```
Time  | What Happens
------|----------------------------------------------------------
0:00  | User clicks "Start Stream"
0:01  | Backend starts FFmpeg for HLS conversion
0:02  | Frontend receives stream URL, initializes HLS.js
0:03  | First video segments created (segment0.ts, segment1.ts)
0:04  | Browser starts playing video
0:05  | Live video visible to user
0:05  | Backend also triggers first frame capture immediately
0:06  | Frame sent to Azure OpenAI for analysis
0:08  | AI response received, frame stored
0:10  | Frontend polls and displays first analyzed frame
0:60  | Timer triggers second frame capture
1:00  | Backend spawns FFmpeg, captures frame #2
1:02  | AI analyzes frame #2
1:10  | Frontend polls, displays frame #2 in gallery
1:20  | User clicks frame #1 → Modal opens with details
2:00  | Third frame capture begins...
```

Every 60 seconds:
1. Backend captures frame (FFmpeg grab single image)
2. Backend analyzes frame (Azure OpenAI API call)
3. Backend stores frame (memory + disk)
4. Frontend polls and retrieves frame (HTTP GET)
5. Frontend displays frame (gallery update)
6. User can click to open modal (detailed view)

---

## 📡 API Reference

### Stream Management

- `POST /api/stream/start` - Start streaming
- `POST /api/stream/stop` - Stop streaming
- `GET /api/stream/status` - Get status

### Frame Analysis

- `GET /api/analysis/frames` - Get all frames
- `GET /api/analysis/frames/:id` - Get specific frame

---

## 📁 Project Structure

```
Lobby-Live-Stream-Agent-v2/
├── backend/
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   ├── captures/         # Frame images
│   ├── stream/           # HLS segments
│   └── server.js         # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   └── services/     # API client
│   ├── index.html
│   └── package.json
│
└── README.md
```

---

## 🐛 Troubleshooting

### FFmpeg Issues
- **Error**: "FFmpeg not found"
- **Solution**: Install FFmpeg and add to PATH

### Streaming Issues
- **Problem**: Video not loading
- **Solutions**: Check RTSP URL, test in VLC, verify network

### Azure OpenAI Issues
- **Error**: "Not configured"
- **Solution**: Check `.env` file, restart backend

---

## ⚡ Performance & Memory Management

### Frame Storage (captures/ folder)
- **Backend**: Max 10 frames in memory, old files deleted with `fs.unlinkSync()`
- **Frontend**: Max 10 frames displayed, React garbage collection
- **Disk Cleanup**: When 11th frame is captured, oldest frame file is deleted from disk

### HLS Segments (stream/ folder)
- **Auto-Cleanup During Streaming**: FFmpeg automatically deletes old `.ts` segments
- **Configuration**: 
  - `-hls_list_size 10`: Keep only 10 segments in playlist (~20 seconds of video)
  - `-hls_flags delete_segments`: Auto-delete segments when they fall out of playlist
  - `-hls_time 2`: Each segment is 2 seconds
- **Result**: Maximum 10-15 `.ts` files exist at any time while streaming
- **After Stop**: Segments remain until next stream starts (reuses same folder)
- **Storage Impact**: Minimal - each segment is ~200KB-500KB depending on video quality

**Note**: The `backend/stream/` folder will contain `.ts` video segment files during streaming. These are necessary for the browser to play the live video and are automatically managed by FFmpeg.

---

## 🔒 Security Best Practices

- Never commit `.env` file
- Use HTTPS in production
- Implement authentication
- Restrict CORS
- Monitor Azure costs

---

## 🤝 Contributing

Contributions welcome! Open issues or pull requests on GitHub.

---

## 📄 License

Maintained by Microsoft Innovation Hub India.

---

## 🙏 Acknowledgments

- Microsoft Innovation Hub India team
- Azure OpenAI for GPT-4o Vision
- Open source community (HLS.js, Lucide, Tailwind, FFmpeg)

---

<div align="center">

**Made with ❤️ by Microsoft Innovation Hub India**

*Powered by Azure OpenAI GPT-4o Vision*

</div>
