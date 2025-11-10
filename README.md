# Lobby Live Stream Agent v2

A modern web application for real-time RTSP streaming with AI-powered frame analysis using Azure OpenAI GPT-4o.

## Overview

This project provides a comprehensive solution for monitoring lobby environments through live video streaming and intelligent frame analysis. The system captures frames at regular intervals and uses Azure OpenAI's GPT-4o model to provide detailed descriptions of the video content.

## Features

- **Live RTSP Streaming**: Real-time video streaming from RTSP cameras converted to HLS for browser compatibility
- **AI-Powered Frame Analysis**: Automatic frame capture every 60 seconds with GPT-4o analysis
- **Non-Interfering Architecture**: Frame capture happens independently on the backend without affecting the live stream
- **Modern Responsive UI**: Clean, professional interface built with React.js
- **Real-time Updates**: Analyzed frames appear automatically below the live stream
- **Easy Configuration**: Simple setup with environment variables

## Architecture

### Frontend (React.js)
- **Live Stream Component**: Displays HLS video stream using HLS.js
- **Stream Controls**: Interface for starting/stopping streams and configuring RTSP URLs
- **Analyzed Frames Grid**: Displays captured frames with AI-generated descriptions
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### Backend (Node.js + Express)
- **RTSP to HLS Conversion**: Uses FFmpeg to convert RTSP streams to browser-compatible HLS
- **Frame Capture Service**: Captures frames directly from RTSP source every 60 seconds
- **Azure OpenAI Integration**: Sends frames to GPT-4o for intelligent analysis
- **REST API**: Provides endpoints for stream control and frame retrieval

### Key Technical Decisions

1. **RTSP to HLS Conversion**: Browsers cannot play RTSP directly, so we use FFmpeg to convert to HLS
2. **Independent Frame Capture**: Backend captures frames directly from RTSP source, not from the browser stream
3. **Non-Blocking Architecture**: Frame analysis happens asynchronously without interrupting live streaming
4. **Polling Updates**: Frontend polls backend every 10 seconds for new analyzed frames

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **FFmpeg** (for RTSP to HLS conversion)
- **Azure OpenAI Account** with GPT-4o deployment

### Installing FFmpeg

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg
```

#### macOS
```bash
brew install ffmpeg
```

#### Windows
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH

Verify installation:
```bash
ffmpeg -version
```

## Installation

1. **Clone the repository**
```bash
git clone https://github.com/MSFT-Innovation-Hub-India/Lobby-Live-Stream-Agent-v2.git
cd Lobby-Live-Stream-Agent-v2
```

2. **Install Backend Dependencies**
```bash
cd backend
npm install
```

3. **Install Frontend Dependencies**
```bash
cd ../frontend
npm install
```

## Configuration

### Backend Configuration

1. **Create `.env` file** in the `backend` directory:
```bash
cd backend
cp .env.example .env
```

2. **Edit `.env` file** with your Azure OpenAI credentials:
```env
# Server Configuration
PORT=3001

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### Getting Azure OpenAI Credentials

1. Go to [Azure Portal](https://portal.azure.com)
2. Create an Azure OpenAI resource (if you don't have one)
3. Deploy a GPT-4o model
4. Get your endpoint and API key from the "Keys and Endpoint" section
5. Note your deployment name

## Usage

### Starting the Backend Server

```bash
cd backend
npm start
```

The backend server will start on `http://localhost:3001`

### Starting the Frontend Application

In a new terminal:

```bash
cd frontend
npm run dev
```

The frontend will start on `http://localhost:5173` (or another port if 5173 is busy)

### Using the Application

1. **Open your browser** and navigate to `http://localhost:5173`

2. **Enter RTSP URL**: 
   - Format: `rtsp://username:password@camera-ip:port/stream`
   - Example: `rtsp://admin:password@192.168.1.100:554/stream1`

3. **Start Stream**: Click the "Start Stream" button
   - Live video will begin playing
   - Frame capture will start automatically

4. **View Analyzed Frames**:
   - Scroll down to see captured frames
   - Each frame shows the timestamp and AI-generated description
   - New frames appear automatically every 60 seconds

5. **Stop Stream**: Click "Stop Stream" when done

## API Endpoints

### Stream Management

#### Start Stream
```http
POST /api/stream/start
Content-Type: application/json

{
  "rtspUrl": "rtsp://camera-ip:554/stream"
}
```

#### Stop Stream
```http
POST /api/stream/stop
```

#### Get Stream Status
```http
GET /api/stream/status
```

### Frame Analysis

#### Get All Analyzed Frames
```http
GET /api/analysis/frames
```

#### Get Specific Frame
```http
GET /api/analysis/frames/:id
```

## Project Structure

```
Lobby-Live-Stream-Agent-v2/
├── backend/
│   ├── routes/
│   │   ├── stream.js          # Stream control endpoints
│   │   └── analysis.js        # Frame analysis endpoints
│   ├── services/
│   │   ├── streamService.js   # RTSP to HLS conversion
│   │   └── frameAnalysisService.js  # Frame capture & AI analysis
│   ├── captures/              # Stored captured frames
│   ├── stream/                # HLS stream segments
│   ├── server.js              # Express server
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LiveStream.jsx       # HLS video player
│   │   │   ├── StreamControls.jsx   # Control interface
│   │   │   └── AnalyzedFrames.jsx   # Frame display grid
│   │   ├── services/
│   │   │   └── api.js               # API client
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## Technology Stack

### Frontend
- **React.js**: UI framework
- **Vite**: Build tool and dev server
- **HLS.js**: HLS video playback
- **Axios**: HTTP client
- **CSS3**: Styling with modern features

### Backend
- **Node.js**: Runtime environment
- **Express**: Web framework
- **FFmpeg**: Video processing and conversion
- **Azure OpenAI SDK**: AI integration
- **Sharp**: Image processing
- **CORS**: Cross-origin resource sharing

## Troubleshooting

### Common Issues

#### 1. FFmpeg not found
**Error**: `FFmpeg spawn error`
**Solution**: Install FFmpeg and ensure it's in your system PATH

#### 2. Stream not loading
**Possible causes**:
- Incorrect RTSP URL
- Camera not accessible from server
- Firewall blocking RTSP port (usually 554)
- RTSP credentials incorrect

**Solutions**:
- Test RTSP URL with VLC media player
- Check network connectivity
- Verify firewall settings
- Confirm camera credentials

#### 3. Azure OpenAI errors
**Error**: "Azure OpenAI is not configured"
**Solution**: 
- Verify `.env` file exists with correct credentials
- Restart backend server after updating `.env`
- Check Azure OpenAI deployment is active

#### 4. CORS errors
**Solution**: Backend is configured for CORS. Ensure backend is running on port 3001

#### 5. Video not playing
**Solutions**:
- Check browser console for errors
- Try clicking the video to play (some browsers require user interaction)
- Ensure HLS stream is being generated (check `backend/stream/` directory)

## Performance Optimization

### Recommendations

1. **Frame Quality**: Adjust FFmpeg quality settings in `streamService.js` if needed
2. **Capture Interval**: Modify the 60-second interval in `frameAnalysisService.js`
3. **Frame Storage**: System keeps last 20 frames; adjust in `frameAnalysisService.js`
4. **HLS Settings**: Tune segment size and count for your network conditions

## Security Considerations

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use HTTPS in production** - Secure your endpoints
3. **Implement authentication** - Add user authentication for production use
4. **Restrict CORS** - Configure CORS for specific domains in production
5. **Secure RTSP credentials** - Use environment variables or secure vaults

## Future Enhancements

- [ ] WebSocket support for real-time frame updates
- [ ] Multiple camera support
- [ ] User authentication and authorization
- [ ] Recording and playback functionality
- [ ] Advanced AI analysis features (motion detection, alerts)
- [ ] Cloud deployment templates (Azure, AWS)
- [ ] Mobile app version
- [ ] Historical frame search and filtering

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is maintained by the Microsoft Innovation Hub India team.

## Support

For questions or support, please open an issue in this repository.

## Acknowledgments

- Microsoft Innovation Hub India
- Azure OpenAI Team
- Open source community for HLS.js and other libraries

---

*Powered by Azure OpenAI GPT-4o*
