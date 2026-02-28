# Frontend - AI Eye Hub Lobby Live Stream Agent v2

Modern React-based frontend (JSX) for live RTSP streaming and AI-powered frame analysis visualization with eye-themed branding. Supports **dual-mode** operation: **cloud** (Azure OpenAI GPT-4o) and **edge** (vLLM with Phi-4-multimodal-instruct on local GPU).

## Features

- **Live HLS video streaming** using HLS.js with stability improvements
- **Dual-mode AI support** — displays edge (Phi-4-multimodal) or cloud (GPT-4o) model status
- **Scenario switching** — select prompt profiles (Innovation Hub, AI-First Bank) from UI
- **Eye-themed branding** with gradient logo and pulsing indicator
- **Prominent countdown timer** (5XL font) visible from across the lobby
- **Frame gallery** with click-to-expand modal showing full analysis
- **Banking scenario alerts** — visual alert badges for anomalies and security events
- **Real-time status synchronization** (polls backend every 5s)
- **Frame polling** (every 10s) for automatic updates
- **Responsive design** for all devices (mobile, tablet, desktop)
- **Dark theme UI** optimized for monitoring environments

## Why JSX (not TypeScript)?

This project uses **JavaScript with JSX** instead of TypeScript (.tsx) for:
- **Simplicity**: Easier to understand and modify
- **Speed**: No type definitions needed
- **Flexibility**: More forgiving for rapid development
- **Learning**: Better for developers new to React

TypeScript is great for large teams and complex apps, but JSX is perfect for getting things done quickly!

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Main Component: LobbyDashboard

### Responsibilities
- Manage all streaming and frame analysis state
- Display eye-themed header with pulsing AI indicator
- Integrate HLS video player
- Show prominent countdown timer (60s intervals)
- Display frame gallery with modal
- Synchronize with backend (status + frames)

### Key State
- `isStreaming`: Current streaming status
- `streamUrl`: HLS playlist URL  
- `analyzedFrames`: Array of AI frames (max 10)
- `seconds`: Countdown to next capture
- `modelName`: AI model name from backend (e.g. `microsoft/Phi-4-multimodal-instruct` or `gpt-4o-mini`)
- `modelMode`: Current inference mode (`edge` or `cloud`)
- `slmHealthy`: Health status of the edge vLLM server
- `scenarios`: Available prompt profiles fetched from backend
- `scenarioConfig`: Currently active scenario configuration
- `selectedFrame`: Frame selected for modal view

### Key Features

#### 1. Eye-Themed Branding
- Gradient "AI Eye" logo with Eye icon from lucide-react
- Pulsing green indicator showing active AI monitoring
- Modern gradient text effects
- Professional dark theme

#### 2. HLS Video Player
- HLS.js integration for browser compatibility
- Fallback to native HLS for Safari
- **Low-latency disabled** for smooth, non-choppy playback
- **Functional setState prevents re-initialization**
  ```javascript
  setStreamUrl(prevUrl => prevUrl === newUrl ? prevUrl : newUrl)
  ```
- Tuned buffer settings: `maxBufferLength: 30`, `maxMaxBufferLength: 60`
- Video controls (play, pause, volume, fullscreen)
- Error recovery and loading states

#### 3. Prominent Countdown Timer
- **5XL font size** visible from far away
- Amber gradient background with animations
- Clock icon animations
- Sticky banner positioning
- Resets every 60 seconds

#### 4. Frame Gallery
- Responsive grid (2-4 columns)
- Frame thumbnails with AI captions
- Timestamp display
- Click to open detail modal
- Manual refresh button
- Auto-refresh every 10s

#### 5. Frame Detail Modal
- Full-screen overlay
- Large frame image
- Complete scene description
- People count breakdown
  - Near doors
  - At reception
  - Other areas
  - Total count
- Witty AI summary
- Close via X or background click

#### 6. Status Synchronization
- Polls backend every 5 seconds
- Updates streaming status, model name, countdown
- Handles backend server unavailability
- Prevents false "streaming" indicators

## Configuration

### Environment Variables

The frontend uses Vite environment variables to configure the backend URL. This allows easy switching between development and production environments.

1. **Create `.env` file**:
```bash
cp .env.example .env
```

2. **Configure backend URL** in `.env`:
```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:3001

# Default RTSP Stream URL
VITE_DEFAULT_RTSP_URL=rtsp://admin:%3FW%21ndows%4010@10.11.70.10:554
```

**Important Notes**:
- All Vite environment variables must start with `VITE_` prefix
- Changes to `.env` require restarting the dev server
- For production, update `VITE_API_BASE_URL` to your production backend URL
- `VITE_DEFAULT_RTSP_URL` is pre-filled in the UI - users can override it directly in the settings
- Never commit `.env` files with sensitive credentials (use `.env.example` instead)

**How it works**:
- `src/services/api.js` reads `import.meta.env.VITE_API_BASE_URL`
- All components use this centralized configuration
- No hardcoded URLs in the codebase
- Easy to change for different environments (dev/staging/prod)

## Technologies

- **React 18**: UI framework with hooks (functional components)
- **JSX**: JavaScript XML syntax (not TypeScript)
- **Vite**: Build tool and dev server with HMR
- **HLS.js**: HLS video playback for browsers
- **Axios**: HTTP client for API calls
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library (Eye, Clock, Users, etc.)

## Development

- **Hot Module Replacement (HMR)** enabled for fast development
- **ESLint** configured for code quality
- **Component-based architecture** with single main component
- **Service layer** for API calls (`services/api.js`)
- **Functional setState** to prevent unnecessary re-renders

## Project Structure

```
frontend/
├── .env                          # Environment variables (not in git)
├── .env.example                  # Environment template
├── src/
│   ├── components/
│   │   └── LobbyDashboard.jsx    # Main unified component
│   ├── services/
│   │   └── api.js                # API client (axios)
│   ├── App.jsx                   # Root component
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Tailwind imports
├── public/                       # Static assets
├── index.html                    # HTML template (title: AI Eye)
├── package.json
├── vite.config.js                # Vite configuration
├── tailwind.config.js            # Tailwind configuration
└── eslint.config.js              # ESLint rules
```

## Key Improvements in v2

✅ **JSX over TypeScript** - Simpler, faster development  
✅ **Unified Dashboard** - Single component instead of multiple  
✅ **Dual-Mode AI** - Edge (vLLM + Phi-4) and Cloud (Azure OpenAI GPT-4o)  
✅ **Scenario Switching** - Select prompt profiles from UI  
✅ **Eye Branding** - Distinctive visual identity  
✅ **Prominent Countdown** - Visible from across lobby  
✅ **Frame Modal** - Click to expand analysis details  
✅ **Banking Alerts** - Visual alert badges for anomalies  
✅ **Status Sync** - Real-time backend synchronization  
✅ **HLS Stability** - Functional setState, tuned buffers, no low-latency mode  
✅ **Memory Management** - Max 10 frames displayed  
✅ **Dynamic Captions** - Context-specific AI observations

---

## Original Vite Template Info

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

