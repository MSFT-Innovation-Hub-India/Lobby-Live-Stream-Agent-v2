# Backend - Lobby Live Stream Agent v2

Backend server for RTSP streaming and AI-powered frame analysis.

## Features

- RTSP to HLS stream conversion using FFmpeg
- Independent frame capture every 60 seconds
- Azure OpenAI GPT-4o integration for frame analysis
- RESTful API for stream control and frame retrieval
- Automatic frame storage and cleanup

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from example:
```bash
cp .env.example .env
```

3. Configure your Azure OpenAI credentials in `.env`

4. Start the server:
```bash
npm start
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `AZURE_OPENAI_ENDPOINT`: Your Azure OpenAI endpoint URL
- `AZURE_OPENAI_API_KEY`: Your Azure OpenAI API key
- `AZURE_OPENAI_DEPLOYMENT_NAME`: Your GPT-4o deployment name
- `AZURE_OPENAI_API_VERSION`: API version (default: 2024-02-15-preview)

## API Documentation

See main README.md for complete API documentation.

## Dependencies

- **express**: Web framework
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management
- **@azure/openai**: Azure OpenAI SDK
- **fluent-ffmpeg**: FFmpeg wrapper
- **sharp**: Image processing
- **node-rtsp-stream**: RTSP stream handling

## Directory Structure

- `routes/`: API route handlers
- `services/`: Business logic services
- `stream/`: HLS stream segments (generated at runtime)
- `captures/`: Captured frames (generated at runtime)
