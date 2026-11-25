# Lobby Live Stream Agent v2

Watches an RTSP camera, shows it live in a browser dashboard, and periodically asks a vision-language model to describe what it sees. The model's answer is turned into scenario-specific metrics, scene descriptions and on-screen alerts.

- **Live video**: Node.js/Express runs FFmpeg to convert RTSP into HLS; the React/Vite dashboard plays it with hls.js.
- **Analysis**: a separate FFmpeg process grabs one still from the RTSP source every `FRAME_CAPTURE_INTERVAL` ms (default 60 s) and sends it to either **Azure OpenAI** (cloud) or a **local vLLM server** (edge).
- **Scenarios**: three switchable profiles - Innovation Hub Lobby, AI First Bank, Government Service Center - each defined by a folder of prompts and JSON under `backend/system-prompts/`.
- **Agent**: `/agent` is a chat page that answers questions about recently retained observations using the edge vLLM server.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, hls.js, axios |
| Backend | Node.js 18+, Express 5, FFmpeg (spawned as child processes) |
| Cloud inference | Azure OpenAI (default deployment name in code: `gpt-4o`; `.env.example` uses `gpt-4o-mini`) |
| Edge inference | vLLM serving an OpenAI-compatible API (documented deployment: `Qwen/Qwen2.5-VL-7B-Instruct-AWQ` on a Tesla T4) |

## Documentation map

| I want to... | Read |
|---|---|
| Understand data flow, trade-offs, scenarios, inference modes, API routes | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Deploy on Azure Stack Edge with vLLM and verify it | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Check health, read logs, restart, recover, roll back, run the smoke test | [OPERATIONS.md](OPERATIONS.md) |
| Contribute code | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Prerequisites

- Node.js 18+ and npm
- FFmpeg on `PATH` (`ffmpeg -version`). The backend spawns it directly.
- An RTSP camera URL reachable from the machine running the backend.
- One inference backend:
  - **Cloud**: an Azure OpenAI resource with a vision-capable chat deployment, plus either an API key or an identity that `DefaultAzureCredential` can use.
  - **Edge**: an OpenAI-compatible vLLM server with a vision model. See [DEPLOYMENT.md](DEPLOYMENT.md) for the documented Azure Stack Edge / Tesla T4 setup.

## Quickstart (local development)

```bash
git clone https://github.com/MSFT-Innovation-Hub-India/Lobby-Live-Stream-Agent-v2.git
cd Lobby-Live-Stream-Agent-v2

cd backend && npm install && cd ..
cd frontend && npm install && cd ..

cp .env.example .env     # one .env at the repo root, read by backend and Vite
```

Edit `.env`. `.env.example` contains sample addresses and credentials from the original environment; replace every value:

```env
# Cloud mode
MODEL_MODE=cloud
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com/
AZURE_OPENAI_API_KEY=<optional - omit to use DefaultAzureCredential>
AZURE_OPENAI_DEPLOYMENT_NAME=<your-deployment>

# ...or edge mode
MODEL_MODE=edge
SLM_URL=http://<vllm-host>:8000
VLLM_MODEL=<model name exactly as served by vLLM>

RTSP_URL=rtsp://<user>:<password>@<camera-host>:554/<path>
VITE_API_BASE_URL=http://<backend-host>:3001
VITE_DEFAULT_RTSP_URL=rtsp://<user>:<password>@<camera-host>:554/<path>
```

Notes:

- `MODEL_MODE` defaults to `cloud` in code, while `.env.example` sets `edge`. In edge mode, set `VLLM_MODEL` explicitly: the code default is `microsoft/Phi-4-multimodal-instruct`, not the Qwen model used in the documented deployment.
- `VITE_API_BASE_URL` is read by the browser. Use an address the browser can reach; avoid `localhost` if you open the dashboard from another machine.
- Backend variables are read once at startup. Restart the backend after editing `.env`.
- `RTSP_URL` is not read by `backend/server.js`. The stream is started from the dashboard (the RTSP input is pre-filled from `VITE_DEFAULT_RTSP_URL`) via `POST /api/stream/start`.

Run:

```bash
# terminal 1
cd backend && npm start        # http://localhost:3001
# terminal 2
cd frontend && npm run dev     # http://localhost:5173
```

Open the dashboard, enter the RTSP URL, and click Start. Then run the [smoke test](OPERATIONS.md#smoke-test-checklist).

## Configuration reference

Source of truth: `.env.example` and `backend/services/frameAnalysisService.js`.

| Variable | Default in code | Purpose |
|---|---|---|
| `PORT` | `3001` | Backend port |
| `MODEL_MODE` | `cloud` | `cloud` (Azure OpenAI) or `edge` (vLLM). Can also be switched at runtime from the dashboard |
| `SLM_URL` | `http://localhost:8000` | vLLM base URL (edge) |
| `VLLM_MODEL` | `microsoft/Phi-4-multimodal-instruct` | Model name sent to vLLM; must match what vLLM serves |
| `AZURE_OPENAI_ENDPOINT` | none | Enables the cloud client when set |
| `AZURE_OPENAI_API_KEY` | none | Optional; otherwise `DefaultAzureCredential` |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | `gpt-4o` | Cloud deployment |
| `AZURE_OPENAI_API_VERSION` | not read by the code | Listed in `.env.example` only |
| `FRAME_CAPTURE_INTERVAL` | `60000` | Milliseconds between analysed stills |
| `MAX_ANALYZED_FRAMES` | `10` | Observations kept in memory (and their JPEGs on disk) |
| `PROMPT_PROFILE` | `hub-lobby-default` | Scenario at first start; a persisted selection takes precedence |
| `GOV_QUEUE_THRESHOLD` | `5` | Government scenario: queue count above which the crowding alert fires |
| `RTSP_URL` | not read by the backend | Listed in `.env.example` only |
| `VITE_API_BASE_URL` | none | Backend URL used by the browser |
| `VITE_DEFAULT_RTSP_URL` | none | RTSP URL pre-filled in the UI |

## Repository layout

```
backend/
  server.js                      Express app, /stream and /captures static routes, /health
  routes/                        stream.js, analysis.js, agent.js
  services/streamService.js      RTSP -> HLS FFmpeg process with auto-restart
  services/frameAnalysisService.js  still capture, inference, scenario state
  system-prompts/<scenario>/     scenario-config.json, analysis-prompt*.txt, optional one-shot-*
frontend/src/
  components/LobbyDashboard.jsx  main dashboard
  components/AgentChat.jsx       /agent chat page
  services/api.js                axios client for the backend API
```

## Security note

The API has no authentication and CORS is open. Keep it on a trusted network or put it behind a reverse proxy that adds access control. Never commit `.env`; it is git-ignored.
