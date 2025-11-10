# Frontend - Lobby Live Stream Agent v2

Modern React-based frontend for live RTSP streaming and frame analysis visualization.

## Features

- Live HLS video streaming using HLS.js
- Intuitive stream controls
- Real-time display of AI-analyzed frames
- Responsive design for all devices
- Dark theme UI

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

## Components

### LiveStream
Displays the live HLS video stream with automatic retry and error handling.

### StreamControls
User interface for starting/stopping streams and entering RTSP URLs.

### AnalyzedFrames
Grid display of captured frames with AI-generated descriptions.

## Configuration

The frontend connects to the backend at `http://localhost:3001` by default. Update this in `src/services/api.js` if needed.

## Technologies

- **React 18**: UI framework
- **Vite**: Build tool and dev server with HMR
- **HLS.js**: HLS video playback
- **Axios**: HTTP client
- **CSS3**: Modern styling

## Development

- Hot module replacement (HMR) enabled
- ESLint configured for code quality
- Component-based architecture
- Service layer for API calls

---

## Original Vite Template Info

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

