# Deployment

Primary path: **Azure Stack Edge VM with an NVIDIA Tesla T4**, running vLLM, the Node.js backend and the Vite frontend as systemd user services. This is the documented deployment. Everything under [Alternatives](#alternatives-not-shipped-as-artifacts) is guidance only: the repository ships no Dockerfile, compose file, PM2 config or reverse-proxy config.

Related: [ARCHITECTURE.md](ARCHITECTURE.md) (why it is built this way), [OPERATIONS.md](OPERATIONS.md) (health checks, restarts, rollback, smoke test).

Placeholders used below: `<vm-user>` (Linux user that owns the services), `<vm-ip>` (address browsers use to reach the VM), `<camera-host>`, `<user>`, `<password>`. Do not commit real values.

## Cloud vs edge at a glance

| | Azure OpenAI (cloud) | vLLM on Azure Stack Edge (edge) |
|---|---|---|
| Inference | Managed service, no GPU | Local GPU serving |
| Frames leave the site | Yes | No |
| Setup | Endpoint + key or managed identity | This guide |
| Needed for `/agent` | vLLM still required | Yes |

The backend can run either mode; `MODEL_MODE` selects it and there is no automatic failover (see [ARCHITECTURE.md](ARCHITECTURE.md#inference-modes)). Cloud mode needs only Node.js, FFmpeg and the `.env` values in the [README](README.md#quickstart-local-development); the rest of this page is the edge setup.

## Why this model

- **Qwen/Qwen2.5-VL-7B-Instruct-AWQ** is Qwen2.5-VL (7.6B parameters) quantized to 4-bit AWQ, published on Hugging Face. vLLM loads it directly with `--quantization awq`.
- It needs about 6.6 GB of the T4's 15 GB, leaving room for the KV cache (about 4.3 GB reported by vLLM at `--gpu-memory-utilization 0.90`).
- It replaced Microsoft Phi-4-multimodal-instruct (float16, about 8.8 GB VRAM) because on this camera footage Phi-4 repeated titles, reported mobility aids that were floor markings or furniture, and drifted from the required JSON format. Qwen2.5-VL follows the format more reliably and needs no `--trust-remote-code`.
- **The code default is different**: `VLLM_MODEL` defaults to `microsoft/Phi-4-multimodal-instruct` in `frameAnalysisService.js`. You must set `VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct-AWQ` in `.env` and the value must equal the `--model` passed to vLLM.
- vLLM was chosen over Ollama after Ollama failed on the candidate vision models on this GPU (repetition loops, a crash on the T4, or the model being unavailable). vLLM gives an OpenAI-compatible API, native Hugging Face loading and AWQ support.

## Requirements

| Item | Value used |
|---|---|
| GPU | NVIDIA Tesla T4, 15 GB VRAM |
| CPU / RAM | 4 vCPU, 27 GB |
| OS | Ubuntu 20.04 LTS (system Python is 3.8, too old for vLLM) |
| NVIDIA driver | 555.42.06, preinstalled on the VM |
| CUDA toolkit | 12.5 (`cuda-nvcc-12-5`, `cuda-cudart-dev-12-5`), matching the driver; vLLM needs `nvcc` |
| Python | 3.11 in a Conda environment |
| vLLM | 0.16.0 or newer |
| Node.js / FFmpeg | Node 18+, FFmpeg on `PATH` |
| `/storage` | Large data disk (1 TB mount here). The root disk is only 29 GB |

**Keep large files off the root disk.** Everything below installs to `/storage`: Miniconda (about 2 GB), the Conda env (about 11 GB), model weights in the Hugging Face cache (about 7 GB for Qwen; about 11 GB more if the older Phi-4 weights are retained), and a temp directory. Plan for roughly 20 GB for the Qwen setup alone.

## 1. Install Miniconda and the Python environment

```bash
cd /storage
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh
bash Miniconda3-latest-Linux-x86_64.sh -b -p /storage/miniconda3
/storage/miniconda3/bin/conda init bash && source ~/.bashrc
rm Miniconda3-latest-Linux-x86_64.sh

conda create -p /storage/vllm-env python=3.11 -y
conda activate /storage/vllm-env
python --version    # 3.11.x
```

## 2. Install the CUDA toolkit

The driver is preinstalled; the toolkit is not.

```bash
sudo apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/3bf863cc.pub
echo "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64 /" | sudo tee /etc/apt/sources.list.d/cuda.list
sudo apt-get update
sudo apt-get install -y cuda-nvcc-12-5 cuda-cudart-dev-12-5

echo 'export CUDA_HOME=/usr/local/cuda' >> ~/.bashrc && export CUDA_HOME=/usr/local/cuda
/usr/local/cuda/bin/nvcc --version    # release 12.5
nvidia-smi                            # shows the T4
```

## 3. Install vLLM

```bash
conda activate /storage/vllm-env
export TMPDIR=/storage/tmp && mkdir -p /storage/tmp
pip install --cache-dir /storage/pip-cache vllm     # ~10-15 min, ~8 GB
python -c "import vllm; print(vllm.__version__)"    # 0.16.0 or newer
```

If the install fails: `nvcc not found` means `CUDA_HOME`/`PATH` is not set; `ninja not found` means `/storage/vllm-env/bin` is not on `PATH`.

## 4. Download the model to `/storage`

Weights are downloaded once and cached outside the repository, so `git` operations never touch them.

```bash
export HF_HOME=/storage/huggingface
echo 'export HF_HOME=/storage/huggingface' >> ~/.bashrc
mkdir -p /storage/huggingface

conda activate /storage/vllm-env
python -c "
from huggingface_hub import snapshot_download
snapshot_download('Qwen/Qwen2.5-VL-7B-Instruct-AWQ', cache_dir='/storage/huggingface/hub')
"
sudo chown -R <vm-user>:<vm-user> /storage/huggingface     # only if downloaded as another user
```

The cache lives at `/storage/huggingface/hub/models--Qwen--Qwen2.5-VL-7B-Instruct-AWQ/`.

## 5. Test vLLM by hand

```bash
conda activate /storage/vllm-env
export CUDA_HOME=/usr/local/cuda HF_HOME=/storage/huggingface TMPDIR=/storage/tmp

python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-VL-7B-Instruct-AWQ \
  --quantization awq \
  --dtype float16 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --port 8000 \
  --host 0.0.0.0
```

When it prints `Uvicorn running on http://0.0.0.0:8000`, from another terminal:

```bash
curl -s http://localhost:8000/health
curl -s http://localhost:8000/v1/models        # id must be Qwen/Qwen2.5-VL-7B-Instruct-AWQ
```

Stop it with Ctrl+C before installing the service. `--host 0.0.0.0` exposes the unauthenticated API on the network; restrict port 8000 to the backend host if other machines can reach the VM.

If you hit CUDA out-of-memory, lower `--gpu-memory-utilization` to 0.85 and/or `--max-model-len` to 2048.

## 6. Install the systemd user services

User-level units keep running after SSH or VS Code sessions close, but only with **linger** enabled:

```bash
sudo loginctl enable-linger <vm-user>
mkdir -p ~/.config/systemd/user
```

`%h` in a unit file expands to the user's home directory. Adjust the repository path if you cloned elsewhere, and `/usr/bin/node` to `which node`.

**`~/.config/systemd/user/vllm.service`**

```ini
[Unit]
Description=vLLM Server - Qwen2.5-VL-7B-Instruct-AWQ
After=network.target

[Service]
Type=simple
Environment=CUDA_HOME=/usr/local/cuda
Environment=HF_HOME=/storage/huggingface
Environment=TMPDIR=/storage/tmp
Environment=PATH=/storage/vllm-env/bin:/usr/local/cuda/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/storage/vllm-env/bin/python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-VL-7B-Instruct-AWQ \
  --quantization awq \
  --dtype float16 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --port 8000 \
  --host 0.0.0.0
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

**`~/.config/systemd/user/lobby-backend.service`**

```ini
[Unit]
Description=Lobby Live Stream Agent - Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/Lobby-Live-Stream-Agent-v2/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

**`~/.config/systemd/user/lobby-frontend.service`**

```ini
[Unit]
Description=Lobby Live Stream Agent - Frontend
After=network.target lobby-backend.service

[Service]
Type=simple
WorkingDirectory=%h/Lobby-Live-Stream-Agent-v2/frontend
ExecStart=%h/Lobby-Live-Stream-Agent-v2/frontend/node_modules/.bin/vite --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

The frontend runs the Vite dev server on port 5173; there is no separate production build step in this setup.

## 7. Configure the application

Clone the repository, install dependencies, then create `.env` in the repository root:

```bash
cd ~ && git clone https://github.com/MSFT-Innovation-Hub-India/Lobby-Live-Stream-Agent-v2.git
cd Lobby-Live-Stream-Agent-v2
(cd backend && npm install) && (cd frontend && npm install)
cp .env.example .env
```

```env
MODEL_MODE=edge
SLM_URL=http://localhost:8000
VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct-AWQ
FRAME_CAPTURE_INTERVAL=60000
VITE_API_BASE_URL=http://<vm-ip>:3001
VITE_DEFAULT_RTSP_URL=rtsp://<user>:<password>@<camera-host>:554/<path>
```

`SLM_URL` can be `localhost` because vLLM and the backend share the VM. `VITE_API_BASE_URL` is used by the browser and must be the VM address, not `localhost`: with `localhost` the dashboard only works while a VS Code port-forward is open. Full variable list: [README](README.md#configuration-reference). Replace the sample values from `.env.example`.

## 8. Enable and start

```bash
systemctl --user daemon-reload
systemctl --user enable vllm lobby-backend lobby-frontend

systemctl --user start vllm
journalctl --user -u vllm -f        # wait for "Uvicorn running" (about 1-2 minutes); Ctrl+C
systemctl --user start lobby-backend lobby-frontend
```

Start vLLM first so the backend's first health check passes.

## 9. Verify the deployment

Deployment-specific checks:

```bash
loginctl show-user <vm-user> | grep Linger          # Linger=yes
systemctl --user is-enabled vllm lobby-backend lobby-frontend   # enabled x3
nvidia-smi                                          # python process using ~6-7 GB (about 13 GB with the 0.90 reservation)
curl -s http://localhost:8000/v1/models             # lists Qwen/Qwen2.5-VL-7B-Instruct-AWQ
ls /storage/huggingface/hub                         # model cache present, outside the repo
curl -s http://localhost:3001/api/analysis/model-mode   # "mode":"edge", slmUrl set
```

Then run the generic health checks and the smoke test in [OPERATIONS.md](OPERATIONS.md#health-checks) and [OPERATIONS.md](OPERATIONS.md#smoke-test-checklist), and open `http://<vm-ip>:5173`. As a final persistence check, reboot the VM and confirm all three services return without logging in.

## Alternatives (not shipped as artifacts)

These are not tested deployment paths and nothing in the repository automates them. The constraints below follow from how the application works.

- **Generic Linux VM or bare metal**: same steps without Stack Edge specifics. Run `node server.js` under any supervisor (systemd, PM2) and serve the frontend either with Vite or as the static output of `npm run build` from `frontend/` (set `VITE_API_BASE_URL` at build time).
- **Containers**: you would need an image that contains both Node.js and FFmpeg, writable volumes for `backend/stream` and `backend/captures`, and a persistent `backend/.active-scenario.json` if scenario choice should survive restarts. vLLM, if used, needs the NVIDIA container runtime.
- **Cloud (for example a VM or App Service in Azure)**: run in `MODEL_MODE=cloud` with Azure OpenAI; no GPU is needed. The host must reach the camera over RTSP/TCP, which usually means a VPN or a camera that is internet-reachable.

Constraints for any alternative: one backend instance only (observations, stream and capture state are in process memory); a reverse proxy must not buffer or cache `/stream`; open ports 3001 (API/HLS) and 5173 (Vite) or the proxy equivalents; and the API has no authentication, so add access control before exposing it.
