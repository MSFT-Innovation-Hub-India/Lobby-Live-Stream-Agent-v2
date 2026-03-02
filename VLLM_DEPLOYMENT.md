# vLLM Deployment Guide — Azure Stack Edge with Qwen2.5-VL-7B

Complete guide for deploying **vLLM** with **Alibaba Qwen2.5-VL-7B-Instruct-AWQ** on an Azure Stack Edge appliance with a Tesla T4 GPU. This document covers the full journey from initial Ollama experiments, through the Phi-4-multimodal-instruct phase, to the current Qwen2.5-VL production setup.

---

## Table of Contents

1. [Background — Why vLLM](#background--why-vllm)
2. [Hardware & Software Prerequisites](#hardware--software-prerequisites)
3. [Step 1 — Install Miniconda](#step-1--install-miniconda)
4. [Step 2 — Create Python Environment](#step-2--create-python-environment)
5. [Step 3 — Install CUDA Toolkit](#step-3--install-cuda-toolkit)
6. [Step 4 — Install vLLM](#step-4--install-vllm)
7. [Step 5 — Download the Model](#step-5--download-the-model)
8. [Step 6 — Test vLLM Manually](#step-6--test-vllm-manually)
9. [Step 7 — Create systemd Services](#step-7--create-systemd-services)
10. [Step 8 — Configure the Backend](#step-8--configure-the-backend)
11. [Step 9 — Verify End-to-End](#step-9--verify-end-to-end)
12. [Storage Layout](#storage-layout)
13. [Troubleshooting](#troubleshooting)
14. [Key Configuration Tweaks](#key-configuration-tweaks)
15. [Model Migration History](#model-migration-history)

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

1. **Native HuggingFace support** — Loads any HuggingFace model directly without format conversion.
2. **OpenAI-compatible API** — Exposes `/v1/chat/completions` endpoint, making it a drop-in replacement with minimal backend code changes.
3. **Efficient GPU memory management** — PagedAttention allows precise control via `--gpu-memory-utilization 0.90`, maximizing the Tesla T4's 15 GB VRAM.
4. **Async request handling** — Unlike our initial custom `serve.py` (which used synchronous `model.generate()` causing CUDA deadlocks), vLLM handles concurrent requests natively.
5. **Quantization support** — Runs AWQ-quantized models natively, enabling 7B-parameter models to fit comfortably in 15 GB VRAM (~6.6 GB for Qwen2.5-VL-7B-AWQ).
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

## Step 5 — Download the Model

Download the model weights to `/storage/huggingface`:

```bash
# Set HuggingFace cache directory to the data disk
export HF_HOME=/storage/huggingface
echo 'export HF_HOME=/storage/huggingface' >> ~/.bashrc

# Create the directory
mkdir -p /storage/huggingface

# Download the Qwen2.5-VL-7B-Instruct-AWQ model (~7 GB)
conda activate /storage/vllm-env
python -c "
from huggingface_hub import snapshot_download
snapshot_download('Qwen/Qwen2.5-VL-7B-Instruct-AWQ', cache_dir='/storage/huggingface/hub')
"
```

> **Note:** The previous model (Microsoft Phi-4-multimodal-instruct, ~11 GB) is retained in the HuggingFace cache at `/storage/huggingface/hub/models--microsoft--Phi-4-multimodal-instruct/` for fallback purposes. See [Model Migration History](#model-migration-history) for details on why we switched.
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
  --model Qwen/Qwen2.5-VL-7B-Instruct-AWQ \
  --quantization awq \
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
    "model": "Qwen/Qwen2.5-VL-7B-Instruct-AWQ",
    "messages": [{"role": "user", "content": "Say hello in 5 words"}],
    "max_tokens": 50,
    "temperature": 0.4
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
VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct-AWQ
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
4. **Temperature set to 0.4** — balances variety in titles/descriptions while maintaining accuracy for alert detection.
5. **Max tokens set to 300** — sufficient for the concise JSON responses (`{title, scene, alerts}`) the current prompts produce.

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
├── huggingface/         # ~18 GB — Model weights (both models cached)
│   └── hub/
│       ├── models--Qwen--Qwen2.5-VL-7B-Instruct-AWQ/     # ~7 GB (active)
│       └── models--microsoft--Phi-4-multimodal-instruct/  # ~11 GB (retained for fallback)
└── tmp/                 # Temp dir for vLLM (avoids filling root disk)
```

**Total disk usage: ~31 GB on `/storage`** (260 GB free remaining)

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

# Qwen2.5-VL-7B-AWQ uses ~6.6 GB. With 0.90 utilization on 15 GB T4,
# there's ~7.2 GB for KV cache (80K tokens, 19.5x concurrency).
# If issues occur:
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

### 1. Temperature: 0.0 → 0.4

**Problem:** With `temperature: 0.0`, the model produced identical titles for every frame — fully deterministic output. With `0.7`, responses were too creative and hallucinated.

**Fix:** Set to `0.4` for moderate variety in titles while maintaining factual accuracy for scene descriptions and alert detection.

### 2. Max Tokens: 512 → 300

**Problem:** The initial banking scenario prompt required verbose responses that were frequently truncated at 512 tokens. After prompt simplification to a concise JSON format (`{title, scene, alerts}`), 300 tokens is sufficient.

**Fix:** Set to `300` to match the streamlined prompt format.

### 3. Anti-Hallucination Prompt Engineering

**Problem:** The initial Phi-4-multimodal model hallucinated detections — claiming to see walking sticks when none were present (misidentifying yellow floor markings, plant stems, and furniture legs as mobility aids).

**Fix (prompt):** Rewrote the banking scenario prompt with strict alert rules:
- "Set true ONLY if you can clearly see an actual wheelchair, walking stick, cane, or crutch being used by a person"
- "Furniture legs, floor markings, railings, and luggage handles are NOT walking sticks"
- "Default to false if uncertain"
- "A false positive is worse than a missed detection"

**Fix (model):** Migrated from Phi-4-multimodal-instruct (5.6B parameters) to Qwen2.5-VL-7B-Instruct-AWQ (7.6B parameters, 4-bit quantized). Qwen2.5-VL has stronger visual grounding, better spatial reasoning, and more reliable instruction following for structured JSON output. See [Model Migration History](#model-migration-history).

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
│  │ Vite     │◄──►│ Node.js  │───►│ Qwen2.5-VL  │   │
│  │ :5173    │    │ :3001    │    │ 7B-AWQ       │   │
│  │          │    │          │    │ :8000        │   │
│  └──────────┘    └──────────┘    └──────┬───────┘   │
│                       │                 │           │
│                       │          ┌──────▼───────┐   │
│                  ┌────▼────┐     │  Tesla T4    │   │
│                  │  RTSP   │     │  15 GB VRAM  │   │
│                  │  Camera │     │  ~6.6 GB used│   │
│                  └─────────┘     └──────────────┘   │
└─────────────────────────────────────────────────────┘
```

All three components run as **systemd user services** with `linger` enabled — they survive SSH disconnects and VS Code Remote session closures, and auto-restart on failure.

---

## Model Migration History

### Phase 1: Microsoft Phi-4-multimodal-instruct (5.6B parameters)

**Deployed:** Initial setup  
**Size:** ~11 GB (float16)  
**VRAM Usage:** ~8.8 GB on Tesla T4  

Phi-4-multimodal-instruct was the initial edge model selected for its Microsoft provenance and multimodal capabilities. However, several issues emerged in production:

#### Issues Encountered

1. **Repetitive titles** — At temperature 0.0 (deterministic), the model produced the same title (e.g., "Lush Bank Lobby: A Glimpse of Serenity") for nearly every frame from the same camera angle. Even raising temperature didn't fully resolve this.

2. **Alert hallucination** — The model frequently reported `wheelchair_or_walking_stick: true` when no mobility aids were present. It misidentified yellow floor markings, furniture legs, and other objects as walking sticks. As a 5.6B parameter model, it lacked the visual reasoning to reliably distinguish small objects in CCTV footage.

3. **Inconsistent instruction following** — The model sometimes returned responses outside the requested JSON format, required `--trust-remote-code`, and needed extensive prompt engineering to produce structured output.

4. **High VRAM usage** — At ~8.8 GB in float16, it left only ~4.7 GB for KV cache, limiting concurrent request capacity.

#### What We Tried
- Temperature adjustments: 0.0, 0.3, 0.4, 0.7 — lower values caused repetition, higher values increased hallucination
- Prompt rewrites: simplified JSON format, strict accuracy rules, "default to false" instructions
- Max tokens reduction: 1024 → 300 to prevent verbose wandering
- Post-processing: added `postProcessSLMResponse()` for caption formatting

These mitigations reduced but did not eliminate the core issues.

### Phase 2: Alibaba Qwen2.5-VL-7B-Instruct-AWQ (Current)

**Deployed:** March 2, 2026  
**Model:** `Qwen/Qwen2.5-VL-7B-Instruct-AWQ`  
**Creator:** Alibaba Cloud Qwen Team (通义千问)  
**Architecture:** Qwen2.5-VL (7.6B parameters, AWQ 4-bit quantized)  
**Size:** ~7 GB (AWQ quantized weights)  
**VRAM Usage:** ~6.6 GB on Tesla T4  
**KV Cache:** 4.27 GB available, 80K token capacity, 19.5x concurrency at 4096 tokens/request  
**License:** Apache 2.0  

#### Why Qwen2.5-VL-7B

1. **Stronger visual grounding** — Better at identifying specific objects, people, and spatial relationships in images. More reliable for "is X present?" detection tasks.
2. **Better instruction following** — Consistently produces valid JSON in the requested format without needing `--trust-remote-code`.
3. **Lower VRAM footprint** — AWQ 4-bit quantization reduces model memory from 11 GB (Phi-4 FP16) to 6.6 GB, nearly doubling available KV cache.
4. **Higher concurrency** — 19.5x concurrent capacity vs ~4.7x with Phi-4, making it more resilient under load.
5. **Native vLLM support** — First-class support in vLLM without `--trust-remote-code`.

#### Migration Steps Performed

1. Downloaded model: `snapshot_download('Qwen/Qwen2.5-VL-7B-Instruct-AWQ')` → `/storage/huggingface/hub/`
2. Backed up original vLLM service: `cp vllm.service vllm.service.phi4.bak`
3. Updated `vllm.service`: changed `--model`, added `--quantization awq`, removed `--trust-remote-code`
4. Updated `.env`: `VLLM_MODEL=Qwen/Qwen2.5-VL-7B-Instruct-AWQ`
5. Reloaded systemd: `systemctl --user daemon-reload && systemctl --user restart vllm`
6. Updated frontend: removed hardcoded "Phi-4-multimodal" references, now dynamically displays model name from backend
7. Restarted all services: `systemctl --user restart lobby-backend lobby-frontend`

#### Reverting to Phi-4 (if needed)

The Phi-4 model files and service backup are retained:

```bash
# Restore Phi-4 service file
cp ~/.config/systemd/user/vllm.service.phi4.bak ~/.config/systemd/user/vllm.service

# Update .env
sed -i 's|VLLM_MODEL=.*|VLLM_MODEL=microsoft/Phi-4-multimodal-instruct|' ~/Lobby-Live-Stream-Agent-v2/.env

# Reload and restart
systemctl --user daemon-reload
systemctl --user restart vllm lobby-backend
```
