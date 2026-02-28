# Operations Guide — Day-to-Day Management

> **Who is this for?** Anyone who needs to manage, troubleshoot, or restart the Lobby Live Stream app on the Azure Stack Edge VM. No Linux experience required — just follow the steps exactly as written.

---

## Table of Contents

1. [Connect to the VM](#1-connect-to-the-vm)
2. [Navigate to the Project Folder](#2-navigate-to-the-project-folder)
3. [Check if Everything is Running](#3-check-if-everything-is-running)
4. [View Console Logs (Backend, Frontend, vLLM)](#4-view-console-logs)
5. [Stop Services](#5-stop-services)
6. [Start Services](#6-start-services)
7. [Restart Services](#7-restart-services)
8. [Edit Configuration (.env file)](#8-edit-configuration)
9. [Common Problems & Fixes](#9-common-problems--fixes)
10. [Quick Reference Cheat Sheet](#10-quick-reference-cheat-sheet)

---

## 1. Connect to the VM

### Option A: VS Code Remote SSH (Recommended)

1. Open **VS Code** on your Windows/Mac machine
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type **"Remote-SSH: Connect to Host"** and select it
4. Enter: `azureuser@10.11.70.24`
5. Enter your password when prompted
6. VS Code will open a remote session on the VM
7. Open the **Terminal** in VS Code: press `` Ctrl+` `` (backtick key, next to the number 1)

### Option B: Plain SSH from Terminal

Open PowerShell, Windows Terminal, or any terminal and run:

```bash
ssh azureuser@10.11.70.24
```

Enter your password when prompted. You are now on the VM.

---

## 2. Navigate to the Project Folder

Once you are connected (either via VS Code terminal or plain SSH), run:

```bash
cd ~/Lobby-Live-Stream-Agent-v2
```

> **What does `~` mean?** It's a shortcut for your home folder (`/home/azureuser`). So the full path is `/home/azureuser/Lobby-Live-Stream-Agent-v2`.

You are now in the project root. All commands below assume you are in a terminal on the VM.

---

## 3. Check if Everything is Running

The app has **3 services** that must all be running:

| # | Service | What it does | Port |
|---|---------|-------------|------|
| 1 | **vllm** | Runs the Phi-4 AI model on the GPU | 8000 |
| 2 | **lobby-backend** | Node.js server (video streaming + AI analysis) | 3001 |
| 3 | **lobby-frontend** | React web UI | 5173 |

### Check all three at once:

```bash
systemctl --user status vllm lobby-backend lobby-frontend
```

**What to look for:**
- ✅ `active (running)` = service is working
- ❌ `inactive (dead)` = service is stopped
- ❌ `failed` = service crashed (check logs — see Section 4)

Press `q` to exit the status view.

### Check one service at a time:

```bash
systemctl --user status vllm
systemctl --user status lobby-backend
systemctl --user status lobby-frontend
```

Press `q` to exit each status view.

### Quick health check (test if services are responding):

```bash
# Check vLLM (should return JSON)
curl -s -m 10 http://localhost:8000/health

# Check backend (should return HTML)
curl -s -m 5 http://localhost:3001/ | head -1

# Check frontend (should return HTML)
curl -s -m 5 http://localhost:5173/ | head -1
```

---

## 4. View Console Logs

This is how you see what the backend/frontend/vLLM are printing — useful for finding errors.

### View backend logs (live, streaming):

```bash
journalctl --user -u lobby-backend -f
```

> **How to exit:** Press `Ctrl+C` to stop watching logs and return to the terminal.

### View frontend logs (live, streaming):

```bash
journalctl --user -u lobby-frontend -f
```

> **How to exit:** Press `Ctrl+C`

### View vLLM model server logs (live, streaming):

```bash
journalctl --user -u vllm -f
```

> **How to exit:** Press `Ctrl+C`

### View last N lines of logs (not live — just a snapshot):

```bash
# Last 50 lines of backend logs
journalctl --user -u lobby-backend -n 50 --no-pager

# Last 100 lines of vLLM logs
journalctl --user -u vllm -n 100 --no-pager

# Last 200 lines of frontend logs
journalctl --user -u lobby-frontend -n 200 --no-pager
```

> **Tip:** `--no-pager` prints the output directly to the terminal (no scrolling view). Without it, you'll enter a scrollable view — press `q` to exit that.

### View logs from a specific time period:

```bash
# Logs from the last 30 minutes
journalctl --user -u lobby-backend --since "30 minutes ago" --no-pager

# Logs from the last 2 hours
journalctl --user -u vllm --since "2 hours ago" --no-pager

# Logs from today only
journalctl --user -u lobby-backend --since today --no-pager
```

---

## 5. Stop Services

### Stop one service:

```bash
# Stop the backend
systemctl --user stop lobby-backend

# Stop the frontend
systemctl --user stop lobby-frontend

# Stop vLLM (the AI model server)
systemctl --user stop vllm
```

### Stop all three:

```bash
systemctl --user stop lobby-frontend lobby-backend vllm
```

> **Order matters when stopping:** Stop frontend first, then backend, then vLLM. This is the cleanest order but not strictly required.

### Verify they stopped:

```bash
systemctl --user status vllm lobby-backend lobby-frontend
```

All should show `inactive (dead)`.

---

## 6. Start Services

### Start vLLM first (it takes ~30 seconds to load the model):

```bash
systemctl --user start vllm
```

Wait for it to load the model:

```bash
# Watch the logs until you see "Uvicorn running on http://0.0.0.0:8000"
journalctl --user -u vllm -f
```

Once you see that message, press `Ctrl+C` to exit the log view, then start the others:

```bash
systemctl --user start lobby-backend
systemctl --user start lobby-frontend
```

### Or start all three at once:

```bash
systemctl --user start vllm lobby-backend lobby-frontend
```

> **Note:** If you start all at once, the backend may show errors for the first ~30 seconds while vLLM is still loading. This is normal — it will recover automatically.

### Verify they started:

```bash
systemctl --user status vllm lobby-backend lobby-frontend
```

All should show `active (running)`. Press `q` to exit.

---

## 7. Restart Services

Restarting = stop + start in one command. Use this when a service is misbehaving.

### Restart one service:

```bash
# Restart just the backend (most common)
systemctl --user restart lobby-backend

# Restart just the frontend
systemctl --user restart lobby-frontend

# Restart vLLM (takes ~30 seconds to reload model)
systemctl --user restart vllm
```

### Restart all three:

```bash
systemctl --user restart vllm lobby-backend lobby-frontend
```

### After restarting vLLM, wait for model to load:

```bash
# Wait 30 seconds, then check health
sleep 30
curl -s -m 10 http://localhost:8000/health
```

If it returns JSON, vLLM is ready. If it times out, wait another 15 seconds and try again.

---

## 8. Edit Configuration

The app's settings are in a single `.env` file at the project root.

### View the current settings:

```bash
cat ~/Lobby-Live-Stream-Agent-v2/.env
```

### Edit the settings:

```bash
nano ~/Lobby-Live-Stream-Agent-v2/.env
```

> **How to use nano (text editor):**
> - Use **arrow keys** to move the cursor
> - Type to edit text normally
> - **Save:** Press `Ctrl+O`, then press `Enter`
> - **Exit:** Press `Ctrl+X`
> - **Cancel edits:** Press `Ctrl+X`, then press `N` (No, don't save)

### Key settings you might change:

| Setting | What it does | Example value |
|---------|-------------|---------------|
| `MODEL_MODE` | `edge` (local GPU) or `cloud` (Azure) | `edge` |
| `PROMPT_PROFILE` | Which scenario to use | `hub-lobby-default` or `ai-first-bank` |
| `VLLM_MODEL` | Model name for edge mode | `microsoft/Phi-4-multimodal-instruct` |
| `FRAME_CAPTURE_INTERVAL` | Milliseconds between captures | `60000` (= 60 seconds) |
| `VITE_API_BASE_URL` | Backend URL for the UI | `http://10.11.70.24:3001` |

### After editing `.env`, restart the affected services:

```bash
# If you changed backend settings (MODEL_MODE, PROMPT_PROFILE, etc.):
systemctl --user restart lobby-backend

# If you changed frontend settings (VITE_API_BASE_URL, etc.):
systemctl --user restart lobby-frontend

# If you changed both:
systemctl --user restart lobby-backend lobby-frontend
```

> **⚠️ IMPORTANT:** Never set `VITE_API_BASE_URL=http://localhost:3001` — the browser on your laptop will try to reach `localhost` on your laptop, not the VM. Always use the VM IP: `http://10.11.70.24:3001`

---

## 9. Common Problems & Fixes

### Problem: "Scene analysis in progress" but no results appear

**Cause:** vLLM is stuck or crashed.

**Fix:**
```bash
# Step 1: Restart vLLM
systemctl --user restart vllm

# Step 2: Wait for model to load
sleep 30

# Step 3: Check it's healthy
curl -s -m 10 http://localhost:8000/health

# Step 4: Restart backend to clear any stuck state
systemctl --user restart lobby-backend
```

Then refresh the browser and click "Start Stream" again.

---

### Problem: Web page doesn't load at all

**Cause:** Frontend or backend service is down.

**Fix:**
```bash
# Check what's running
systemctl --user status vllm lobby-backend lobby-frontend

# Restart whatever is not "active (running)"
systemctl --user restart lobby-frontend lobby-backend

# Verify
systemctl --user status lobby-frontend lobby-backend
```

---

### Problem: Video stream not playing / freezing

**Cause:** Backend or FFmpeg issue.

**Fix:**
```bash
# Check backend logs for FFmpeg errors
journalctl --user -u lobby-backend -n 50 --no-pager

# Restart backend
systemctl --user restart lobby-backend
```

Then refresh the browser and click "Start Stream" again.

---

### Problem: App breaks when VS Code is closed

**Cause:** `VITE_API_BASE_URL` is set to `localhost` instead of the VM IP.

**Fix:**
```bash
# Edit the .env file
nano ~/Lobby-Live-Stream-Agent-v2/.env

# Find this line and change it:
#   WRONG:   VITE_API_BASE_URL=http://localhost:3001
#   CORRECT: VITE_API_BASE_URL=http://10.11.70.24:3001

# Save (Ctrl+O, Enter) and exit (Ctrl+X)

# Restart frontend
systemctl --user restart lobby-frontend
```

---

### Problem: Everything was working but stopped after VM reboot

**Cause:** Services should auto-start, but may need a moment.

**Fix:**
```bash
# Check if services are running
systemctl --user status vllm lobby-backend lobby-frontend

# If any are not running, start them
systemctl --user start vllm lobby-backend lobby-frontend

# Wait 30 seconds for vLLM to load, then verify
sleep 30
curl -s -m 10 http://localhost:8000/health
```

---

### Problem: GPU out of memory or vLLM won't start

**Cause:** Something else is using the GPU, or a previous vLLM process is stuck.

**Fix:**
```bash
# Check GPU usage
nvidia-smi

# If vLLM is using all memory, stop it first
systemctl --user stop vllm

# Wait a few seconds for GPU memory to free
sleep 5

# Check GPU again (should show 0 MB used)
nvidia-smi

# Start vLLM again
systemctl --user start vllm

# Watch logs to confirm it loads successfully
journalctl --user -u vllm -f
# Press Ctrl+C once you see "Uvicorn running on http://0.0.0.0:8000"
```

---

### Problem: Need to update the code (git pull)

```bash
# Step 1: Stop the app services (not vLLM — it doesn't change with code updates)
systemctl --user stop lobby-frontend lobby-backend

# Step 2: Pull latest code
cd ~/Lobby-Live-Stream-Agent-v2
git pull

# Step 3: If package.json changed, reinstall dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Step 4: Start services again
systemctl --user start lobby-backend lobby-frontend

# Step 5: Verify
systemctl --user status lobby-backend lobby-frontend
```

---

## 10. Quick Reference Cheat Sheet

Copy-paste these commands as needed. All commands assume you are SSH'd into the VM.

```bash
# ──────────────────────────────────────────────
# CONNECT
# ──────────────────────────────────────────────
ssh azureuser@10.11.70.24
cd ~/Lobby-Live-Stream-Agent-v2

# ──────────────────────────────────────────────
# CHECK STATUS
# ──────────────────────────────────────────────
systemctl --user status vllm lobby-backend lobby-frontend

# ──────────────────────────────────────────────
# VIEW LOGS (press Ctrl+C to exit)
# ──────────────────────────────────────────────
journalctl --user -u lobby-backend -f          # Backend (live)
journalctl --user -u lobby-frontend -f         # Frontend (live)
journalctl --user -u vllm -f                   # vLLM (live)
journalctl --user -u lobby-backend -n 50 --no-pager   # Last 50 lines

# ──────────────────────────────────────────────
# STOP
# ──────────────────────────────────────────────
systemctl --user stop lobby-frontend           # Stop frontend only
systemctl --user stop lobby-backend            # Stop backend only
systemctl --user stop vllm                     # Stop vLLM only
systemctl --user stop lobby-frontend lobby-backend vllm   # Stop all

# ──────────────────────────────────────────────
# START
# ──────────────────────────────────────────────
systemctl --user start vllm                    # Start vLLM (wait ~30s)
systemctl --user start lobby-backend           # Start backend
systemctl --user start lobby-frontend          # Start frontend
systemctl --user start vllm lobby-backend lobby-frontend  # Start all

# ──────────────────────────────────────────────
# RESTART
# ──────────────────────────────────────────────
systemctl --user restart lobby-backend         # Restart backend
systemctl --user restart lobby-frontend        # Restart frontend
systemctl --user restart vllm                  # Restart vLLM (~30s reload)
systemctl --user restart vllm lobby-backend lobby-frontend  # Restart all

# ──────────────────────────────────────────────
# HEALTH CHECKS
# ──────────────────────────────────────────────
curl -s -m 10 http://localhost:8000/health     # vLLM
curl -s -m 5 http://localhost:3001/ | head -1  # Backend
curl -s -m 5 http://localhost:5173/ | head -1  # Frontend
nvidia-smi                                      # GPU status

# ──────────────────────────────────────────────
# EDIT CONFIG
# ──────────────────────────────────────────────
nano ~/Lobby-Live-Stream-Agent-v2/.env         # Edit settings
cat ~/Lobby-Live-Stream-Agent-v2/.env          # View settings

# ──────────────────────────────────────────────
# UPDATE CODE
# ──────────────────────────────────────────────
systemctl --user stop lobby-frontend lobby-backend
cd ~/Lobby-Live-Stream-Agent-v2 && git pull
cd backend && npm install && cd ../frontend && npm install && cd ..
systemctl --user start lobby-backend lobby-frontend
```

---

## Service File Locations

If you ever need to edit the systemd service definitions themselves (rare):

```
~/.config/systemd/user/vllm.service
~/.config/systemd/user/lobby-backend.service
~/.config/systemd/user/lobby-frontend.service
```

After editing a service file, reload and restart:

```bash
systemctl --user daemon-reload
systemctl --user restart <service-name>
```

---

## Key Paths on the VM

| What | Path |
|------|------|
| Project root | `~/Lobby-Live-Stream-Agent-v2/` |
| Backend code | `~/Lobby-Live-Stream-Agent-v2/backend/` |
| Frontend code | `~/Lobby-Live-Stream-Agent-v2/frontend/` |
| Environment config | `~/Lobby-Live-Stream-Agent-v2/.env` |
| System prompts | `~/Lobby-Live-Stream-Agent-v2/backend/system-prompts/` |
| Captured frames | `~/Lobby-Live-Stream-Agent-v2/backend/captures/` |
| HLS video segments | `~/Lobby-Live-Stream-Agent-v2/backend/stream/` |
| vLLM virtual environment | `/storage/vllm-env/` |
| AI model files | `/storage/huggingface/` |
| systemd service files | `~/.config/systemd/user/` |

---

> **Remember:** All three services auto-start on boot and auto-restart on crash. Most of the time you don't need to do anything — just open `http://10.11.70.24:5173` in your browser. This guide is for when things go wrong or when you need to make changes.
