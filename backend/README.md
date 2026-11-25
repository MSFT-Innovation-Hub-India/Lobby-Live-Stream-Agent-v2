# Backend

Express 5 API that converts RTSP to HLS with FFmpeg, captures stills for analysis, and calls Azure OpenAI or a vLLM server.

```bash
npm install
npm start     # reads ../.env, listens on PORT (default 3001)
```

Configuration, layout and the API are documented once, in the root pages:

- [Configuration reference](../README.md#configuration-reference)
- [Architecture, scenarios and API routes](../ARCHITECTURE.md)
- [Operations and troubleshooting](../OPERATIONS.md)
