# vLLM Deployment Guide — Azure Stack Edge with Phi-4 Multimodal

Complete guide for deploying **vLLM** with **Microsoft Phi-4-multimodal-instruct** on an Azure Stack Edge appliance with a Tesla T4 GPU. This document covers the full journey from initial Ollama experiments to the final production-grade vLLM setup.

---

## Table of Contents

1. [Background — Why vLLM](#background--why-vllm)
2. [Hardware & Software Prerequisites](#hardware--software-prerequisites)
3. [Step 1 — Install Miniconda](#step-1--install-miniconda)
4. [Step 2 — Create Python Environment](#step-2--create-python-environment)
5. [Step 3 — Install CUDA Toolkit](#step-3--install-cuda-toolkit)
6. [Step 4 — Install vLLM](#step-4--install-vllm)
7. [Step 5 — Download the Phi-4 Model](#step-5--download-the-phi-4-model)
8. [Step 6 — Test vLLM Manually](#step-6--test-vllm-manually)
9. [Step 7 — Create systemd Services](#step-7--create-systemd-services)
10. [Step 8 — Configure the Backend](#step-8--configure-the-backend)
11. [Step 9 — Verify End-to-End](#step-9--verify-end-to-end)
12. [Storage Layout](#storage-layout)
13. [Troubleshooting](#troubleshooting)
14. [Key Configuration Tweaks](#key-configuration-tweaks)

---

## Background — Why vLLM

### Initial Approach: Ollama

We initially tried **Ollama** as the local inference runtime because of its simple setup. However, we encountered critical issues with every multimodal model we tested:

| Model | Issue |
|---|---|
| **llama3.2-vision** | Severe repetition bugs — the model would loop the same sentence endlessly, producing unusable output. |
| **minicpm-v** (OpenBMB) | Crashed with **SIGABRT** during inference on the Tesla T4. The model was incompatible with the GPU's memory architecture and CUDA driver combination. |
| **Phi-4-multimodal-instruct** | **Not available in Ollama's model registry** at the time. Ollama does not support arbitrary HuggingFace models without explicit GGUF conversion and registration. |

### Why vLLM is the Right Choice

**vLLM** (v0.16.0) was selected for the following reasons:

1. **Native HuggingFace support** — Loads any HuggingFace model directly without format conversion. This means Phi-4-multimodal-instruct works out of the box with `--trust-remote-code`.
2. **OpenAI-compatible API** — Exposes `/v1/chat/completions` endpoint, making it a drop-in replacement with minimal backend code changes.
3. **Efficient GPU memory management** — PagedAttention allows precise control via `--gpu-memory-utilization 0.90`, maximizing the Tesla T4's 15 GB VRAM.
4. **Async request handling** — Unlike our initial custom `serve.py` (which used synchronous `model.generate()` causing CUDA deadlocks), vLLM handles concurrent requests natively.
5. **FP16 support** — Runs Phi-4 in float16 (~8.8 GB VRAM), leaving headroom for KV cache and concurrent requests.
6. **Production-grade** — Handles model loading, batching, health checks, and graceful shutdown without custom code.

---

## Hardware & Software Prerequisites

### Azure Stack Edge Appliance

| Component | Specification |
|---|---|
| CPU | Intel Xeon Silver 4214 (4 cores allocated to VM) |
| RAM | 27 GB |
| GPU | NVIDIA Tesla T4 (15 GB VRAM) |
| OS | Ubuntu 20.04.6 LTS (Focal Fossa) |
| NVIDIA Driver | 555.42.06 |
| Storage | `/storage` mount — 1 TB data disk (~260 GB free after setup) |
| Root disk | 29 GB (limited — do NOT install large packages here) |

### Important: Storage Strategy

The root disk (`/`) is only 29 GB. **All large installations must go on `/storage`** (the 1 TB data disk):
- Miniconda: `/storage/miniconda3` (~2.1 GB)
- Python venv: `/storage/vllm-env` (~11 GB)
- Model weights: `/storage/huggingface` (~11 GB)
- Temp files: `/storage/tmp`

---

## Step 1 — Install Miniconda

Miniconda provides an isolated Python 3.11 environment (Ubuntu 20.04 ships with Python 3.8, which is too old for vLLM).

```bash
# Download Miniconda installer
cd /storage
wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh

# Install to /storage/miniconda3
bash Miniconda3-latest-Linux-x86_64.sh -b -p /storage/miniconda3

# Initialize conda (adds to ~/.bashrc)
/storage/miniconda3/bin/conda init bash
source ~/.bashrc

# Clean up installer
rm Miniconda3-latest-Linux-x86_64.sh
```

---

## Step 2 — Create Python Environment

vLLM requires Python 3.11+. Create a dedicated conda environment:

```bash
# Create Python 3.11 environment at /storage/vllm-env
conda create -p /storage/vllm-env python=3.11 -y

# Activate it
conda activate /storage/vllm-env

# Verify
python --version
# Should output: Python 3.11.x
```

---

## Step 3 — Install CUDA Toolkit

vLLM needs `nvcc` (the CUDA compiler) and CUDA development headers to compile custom kernels. The NVIDIA driver is pre-installed on the Azure Stack Edge VM, but the toolkit is not.

```bash
# Add NVIDIA CUDA repository
sudo apt-key adv --fetch-keys https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/3bf863cc.pub
echo "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64 /" | sudo tee /etc/apt/sources.list.d/cuda.list
sudo apt-get update

# Install CUDA 12.5 toolkit (matches the driver)
sudo apt-get install -y cuda-nvcc-12-5 cuda-cudart-dev-12-5

# Set CUDA_HOME (and add to ~/.bashrc for persistence)
export CUDA_HOME=/usr/local/cuda
echo 'export CUDA_HOME=/usr/local/cuda' >> ~/.bashrc

# Verify nvcc
/usr/local/cuda/bin/nvcc --version
# Should show: Build cuda_12.5.r12.5/compiler.xxxxx
```

---

## Step 4 — Install vLLM

With the Python environment active and CUDA toolkit installed:

```bash
# Activate the environment
conda activate /storage/vllm-env

# Install vLLM (this takes 10-15 minutes and downloads ~8 GB of dependencies)
pip install vllm

# Install additional required packages
pip install scipy

# Verify installation
python -c "import vllm; print(vllm.__version__)"
# Should output: 0.16.0 (or newer)
```

### Common Installation Issues

| Issue | Solution |
|---|---|
| `No module named 'scipy'` | `pip install scipy` — required by Phi-4's custom code |
| `nvcc not found` | Install `cuda-nvcc-12-5` and set `CUDA_HOME=/usr/local/cuda` |
| `ninja not found` | vLLM installs ninja, but ensure `/storage/vllm-env/bin` is in PATH |
| Disk space on `/` | Redirect pip cache: `pip install --cache-dir /storage/pip-cache vllm` |

---

## Step 5 — Download the Phi-4 Model

Download the model weights to `/storage/huggingface`:

```bash
# Set HuggingFace cache directory to the data disk
export HF_HOME=/storage/huggingface
echo 'export HF_HOME=/storage/huggingface' >> ~/.bashrc

# Create the directory
mkdir -p /storage/huggingface

# Download the model (~11 GB)
# This happens automatically on first vLLM launch, but you can pre-download:
conda activate /storage/vllm-env
python -c "
from huggingface_hub import snapshot_download
snapshot_download('microsoft/Phi-4-multimodal-instruct', cache_dir='/storage/huggingface')
"
```

### Fix Permissions (if needed)

If the download was done as root or another user:

```bash
sudo chown -R azureuser:azureuser /storage/huggingface
```

---

## Step 6 — Test vLLM Manually

Before setting up the systemd service, verify vLLM runs correctly:

```bash
conda activate /storage/vllm-env
export CUDA_HOME=/usr/local/cuda
export HF_HOME=/storage/huggingface
export TMPDIR=/storage/tmp
mkdir -p /storage/tmp

# Start vLLM server
python -m vllm.entrypoints.openai.api_server \
  --model microsoft/Phi-4-multimodal-instruct \
  --trust-remote-code \
  --dtype float16 \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.90 \
  --port 8000 \
  --host 0.0.0.0
```

Wait for the server to print `Uvicorn running on http://0.0.0.0:8000`. Then test from another terminal:

```bash
# Health check
curl http://localhost:8000/health
# Should return: {"status":"ok"}

# Test inference with a text-only request
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "microsoft/Phi-4-multimodal-instruct",
    "messages": [{"role": "user", "content": "Say hello in 5 words"}],
    "max_tokens": 50,
    "temperature": 0.7
  }' | python3 -m json.tool
```

Stop the manual server with `Ctrl+C` before proceeding to systemd setup.

---

## Step 7 — Create systemd Services

Services are created as **user-level systemd units** so they persist after SSH/VS Code sessions close, without requiring root access.

### Enable Linger (Critical)

By default, user services stop when the user logs out. **Linger** keeps them running:

```bash
sudo loginctl enable-linger azureuser
```

### Create Service Directory

```bash
mkdir -p ~/.config/systemd/user
```

### 7a. vLLM Service

```bash
cat > ~/.config/systemd/user/vllm.service << 'EOF'
[Unit]
Description=vLLM Server - Phi-4 Multimodal
After=network.target

[Service]
Type=simple
Environment=CUDA_HOME=/usr/local/cuda
Environment=HF_HOME=/storage/huggingface
Environment=TMPDIR=/storage/tmp
Environment=PATH=/storage/vllm-env/bin:/usr/local/cuda/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/storage/vllm-env/bin/python -m vllm.entrypoints.openai.api_server \
  --model microsoft/Phi-4-multimodal-instruct \
  --trust-remote-code \
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
EOF
```

### 7b. Backend Service

```bash
cat > ~/.config/systemd/user/lobby-backend.service << 'EOF'
[Unit]
Description=Lobby Live Stream Agent - Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/azureuser/Lobby-Live-Stream-Agent-v2/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
```

### 7c. Frontend Service

```bash
cat > ~/.config/systemd/user/lobby-frontend.service << 'EOF'
[Unit]
Description=Lobby Live Stream Agent - Frontend
After=network.target lobby-backend.service

[Service]
Type=simple
WorkingDirectory=/home/azureuser/Lobby-Live-Stream-Agent-v2/frontend
ExecStart=/home/azureuser/Lobby-Live-Stream-Agent-v2/frontend/node_modules/.bin/vite --host 0.0.0.0
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF
```

### Enable and Start All Services

```bash
# Reload systemd to pick up new service files
systemctl --user daemon-reload

# Enable services to start on boot
systemctl --user enable vllm lobby-backend lobby-frontend

# Start services
systemctl --user start vllm

# Wait for vLLM to load the model (~60-90 seconds)
# Monitor progress:
journalctl --user -u vllm -f

# Once vLLM shows "Uvicorn running", start the app services:
systemctl --user start lobby-backend lobby-frontend
```

### Service Management Commands

```bash
# Check status
systemctl --user status vllm
systemctl --user status lobby-backend
systemctl --user status lobby-frontend

# View logs
journalctl --user -u vllm --no-pager -n 50
journalctl --user -u lobby-backend --no-pager -n 50

# Restart a service
systemctl --user restart vllm

# Stop all services
systemctl --user stop lobby-frontend lobby-backend vllm
```

---

## Step 8 — Configure the Backend

The Node.js backend needs to know about vLLM. Edit the `.env` file in the project root:

```bash
# /home/azureuser/Lobby-Live-Stream-Agent-v2/.env

MODEL_MODE=edge
SLM_URL=http://localhost:8000
VLLM_MODEL=microsoft/Phi-4-multimodal-instruct
FRAME_CAPTURE_INTERVAL=60000
VITE_API_BASE_URL=http://<YOUR_VM_IP>:3001
```

| Variable | Purpose |
|---|---|
| `MODEL_MODE=edge` | Tells the backend to use the local vLLM server instead of Azure OpenAI |
| `SLM_URL=http://localhost:8000` | vLLM server address (same VM, so localhost is correct) |
| `VLLM_MODEL` | The model name vLLM expects in API requests |
| `FRAME_CAPTURE_INTERVAL` | How often to capture and analyze frames (ms) |
| `VITE_API_BASE_URL` | Must use the VM's actual IP (not localhost) for browser access |

### Backend Code Changes (Already Applied)

The backend's `frameAnalysisService.js` was updated to:

1. **Use vLLM's OpenAI-compatible API** — sends `POST /v1/chat/completions` with `image_url` content type instead of the Ollama API format.
2. **Auto-detect response format** — `buildResponseFromSLM()` detects whether the model returned JSON (banking scenario) or plain markdown (hub-lobby scenario) and parses accordingly.
3. **Refusal detection** — `isModelRefusal()` catches cases where the model claims "I cannot view images" and automatically retries the request once.
4. **Temperature set to 0.7** — ensures varied, creative responses (was 0.1, which produced identical captions every time).
5. **Max tokens set to 1024** — sufficient for the detailed JSON+markdown responses the banking prompt requires.

---

## Step 9 — Verify End-to-End

```bash
# 1. Check vLLM is healthy
curl -s http://localhost:8000/health
# {"status":"ok"}

# 2. Check backend is running
curl -s http://localhost:3001/health
# {"status":"ok","message":"Server is running"}

# 3. Check model mode
curl -s http://localhost:3001/api/analysis/model-mode
# {"success":true,"mode":"edge","slmUrl":"http://localhost:8000",...}

# 4. Open the dashboard in a browser
# http://<YOUR_VM_IP>:5173
```

---

## Storage Layout

All large assets reside on `/storage` (1 TB data disk):

```
/storage/
├── miniconda3/          # 2.1 GB — Conda package manager
├── vllm-env/            # 11 GB  — Python 3.11 + vLLM + all dependencies
├── huggingface/         # 11 GB  — Phi-4-multimodal-instruct model weights
│   └── hub/
│       └── models--microsoft--Phi-4-multimodal-instruct/
└── tmp/                 # Temp dir for vLLM (avoids filling root disk)
```

**Total disk usage: ~24 GB on `/storage`**

---

## Troubleshooting

### vLLM won't start

```bash
# Check logs
journalctl --user -u vllm --no-pager -n 50

# Common issues:
# - "CUDA out of memory" → reduce --gpu-memory-utilization to 0.85
# - "No module named scipy" → activate env and pip install scipy
# - "nvcc not found" → ensure CUDA_HOME and PATH are set in the service file
```

### Model downloads fail

```bash
# Check permissions
ls -la /storage/huggingface

# Fix if needed
sudo chown -R azureuser:azureuser /storage/huggingface
```

### Services stop after logout

```bash
# Verify linger is enabled
loginctl show-user azureuser | grep Linger
# Should show: Linger=yes

# If not:
sudo loginctl enable-linger azureuser
```

### GPU memory issues

```bash
# Check GPU usage
nvidia-smi

# Phi-4 FP16 uses ~8.8 GB. With 0.90 utilization on 15 GB T4,
# there's ~4.7 GB for KV cache. If issues occur:
# - Reduce --max-model-len from 4096 to 2048
# - Reduce --gpu-memory-utilization from 0.90 to 0.85
```

### Backend shows "Error analyzing frame"

```bash
# Check if vLLM is responsive
curl -s http://localhost:8000/health

# Check backend logs
journalctl --user -u lobby-backend --no-pager -n 20

# Common: vLLM may be busy with a prior request.
# The backend retries once automatically on model refusal.
```

---

## Key Configuration Tweaks

These tweaks were discovered during deployment and are critical for production quality:

### 1. Temperature: 0.1 → 0.7

**Problem:** With `temperature: 0.1`, the model produced identical captions for every frame — nearly deterministic output.

**Fix:** Raised to `0.7` for creative, varied responses while maintaining coherence.

### 2. Max Tokens: 512 → 1024

**Problem:** The banking scenario's JSON response with embedded markdown was frequently truncated at 512 tokens.

**Fix:** Increased to `1024` to accommodate the full structured response.

### 3. Anti-Hallucination Prompt Engineering

**Problem:** The model hallucinated detections — claiming to see walking sticks when none were present (misidentifying plant stems and furniture legs).

**Fix:** Rewrote the banking scenario prompt with explicit accuracy rules:
- "Objects like plant stems, umbrella stands, furniture legs are NOT walking sticks"
- "A person must be CLEARLY HOLDING a mobility aid for it to count"
- "FALSE POSITIVES are worse than missed detections"
- Default to `alert_required: false` unless 90%+ confident

### 4. Few-Shot Example Removal

**Problem:** The banking prompt had 5 hardcoded example captions. With low temperature, the model copied them verbatim instead of generating original ones.

**Fix:** Removed all example captions, replaced with tone guidance ("use banking puns about interest rates, deposits, etc.").

### 5. HLS Stream Smoothness

**Problem:** 0.5-second segments with forced keyframes every 0.5s caused choppy, disjointed playback.

**Fix:**
- FFmpeg: 2-second segments, GOP of 60 frames, CBR at 2500 kbps
- Added `Cache-Control: no-cache` headers on the `/stream` route to prevent stale playlist caching
- HLS.js: disabled `lowLatencyMode`, increased buffer to 10 seconds

### 6. Model Refusal Handling

**Problem:** vLLM occasionally returns "I'm sorry, as an AI text-based model, I'm unable to view images" — a text-mode refusal that gets displayed as the scene caption.

**Fix:** Added `isModelRefusal()` detection that catches these patterns, retries the request once, and if the retry also fails, skips the frame entirely instead of displaying the error.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                Azure Stack Edge VM                  │
│                                                     │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐   │
│  │ Frontend │    │ Backend  │    │    vLLM      │   │
│  │ Vite     │◄──►│ Node.js  │───►│ Phi-4-multi  │   │
│  │ :5173    │    │ :3001    │    │ :8000        │   │
│  └──────────┘    └──────────┘    └──────┬───────┘   │
│                       │                 │           │
│                       │          ┌──────▼───────┐   │
│                  ┌────▼────┐     │  Tesla T4    │   │
│                  │  RTSP   │     │  15 GB VRAM  │   │
│                  │  Camera │     └──────────────┘   │
│                  └─────────┘                        │
└─────────────────────────────────────────────────────┘
```

All three components run as **systemd user services** with `linger` enabled — they survive SSH disconnects and VS Code Remote session closures, and auto-restart on failure.
