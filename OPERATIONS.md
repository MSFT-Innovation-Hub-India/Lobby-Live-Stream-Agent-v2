# Operations

Day-to-day management of a running deployment. Examples assume the Azure Stack Edge VM set up in [DEPLOYMENT.md](DEPLOYMENT.md) (systemd user services `vllm`, `lobby-backend`, `lobby-frontend`). For a local development run, replace `systemctl`/`journalctl` with the terminals running `npm start` and `npm run dev`.

Placeholders: `<vm-user>`, `<vm-ip>`. Connect with `ssh <vm-user>@<vm-ip>` (or VS Code Remote-SSH) and `cd ~/Lobby-Live-Stream-Agent-v2`.

## Health checks

```bash
systemctl --user status vllm lobby-backend lobby-frontend --no-pager   # all active (running)

curl -s http://localhost:8000/health                      # vLLM: HTTP 200, empty body
curl -s http://localhost:3001/health                      # backend
curl -s http://localhost:3001/api/stream/status           # stream + capture status
curl -s http://localhost:3001/api/analysis/model-mode     # active mode (cloud/edge), slmUrl
curl -s http://localhost:3001/api/analysis/scenarios/active
nvidia-smi                                                # GPU memory in use by the vLLM python process
```

In edge mode the backend calls vLLM's `/health` (5 s timeout) before every frame; if it fails, that frame is stored as an error observation instead of being analysed. There is no fallback to the cloud model: see [ARCHITECTURE.md](ARCHITECTURE.md#inference-modes).

## Logs

```bash
journalctl --user -u vllm -f
journalctl --user -u lobby-backend -f
journalctl --user -u lobby-frontend -f
journalctl --user -u lobby-backend --since "1 hour ago" --no-pager
```

Useful backend log lines: FFmpeg start/exit and restart attempts (stream), capture failures (analysis), and inference errors with the HTTP status from vLLM or Azure OpenAI. Browser-side problems (HLS errors, API calls) show in the browser developer console.

## Start, stop and restart

Order matters: vLLM first on start, last on stop.

```bash
systemctl --user start vllm            # wait ~1-2 minutes for "Uvicorn running"
systemctl --user start lobby-backend lobby-frontend

systemctl --user stop lobby-frontend lobby-backend
systemctl --user stop vllm

systemctl --user restart lobby-backend     # after editing .env
```

Backend variables are read once at startup; restart `lobby-backend` after any `.env` change. `VITE_*` values are read by Vite, so restart `lobby-frontend` after changing them. Restarting the backend stops the RTSP stream; start it again from the dashboard. In-memory observations are lost on restart (JPEGs not referenced afterwards are deleted at startup); the active scenario is restored from `backend/.active-scenario.json`.

## Stream recovery

- The HLS FFmpeg process restarts automatically up to 10 times, 5 s apart, if it exits unexpectedly. After that the stream stays stopped.
- Still capture stops after 5 consecutive failures.
- To recover manually: click **Stop** then **Start** in the dashboard (or `POST /api/stream/stop` then `POST /api/stream/start` with `{"rtspUrl": "<rtsp-url>"}`). Restarting `lobby-backend` also resets all counters.
- The browser player retries network and media errors on its own; if video stays frozen, reload the page.

If the camera is not available, any reachable RTSP source works for testing the pipeline (a second camera, or a looping file served by an RTSP server such as MediaMTX). Verify a URL first with `ffprobe -rtsp_transport tcp "<rtsp-url>"`.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Dashboard loads but API calls fail | `VITE_API_BASE_URL` points to `localhost` and you are browsing from another machine. Set it to `http://<vm-ip>:3001`, restart `lobby-frontend`. |
| Page does not load at all | `lobby-frontend` not running, or port 5173/3001 blocked. Check `systemctl --user status` and firewall/NSG rules. |
| Video never starts | Backend log shows FFmpeg exit: wrong RTSP URL/credentials, camera unreachable from the VM, or `ffmpeg` missing from `PATH`. |
| No observations appear | Stream not started (capture runs with the stream), or inference failing: check the backend log and `/api/analysis/model-mode`. First analysis arrives after one capture interval. |
| Observations say the model is unavailable | vLLM down or still loading: `systemctl --user status vllm`, `curl localhost:8000/health`. Start vLLM; the next capture recovers. |
| Observations say Azure OpenAI is not configured | Cloud mode without `AZURE_OPENAI_ENDPOINT`. Set it (and credentials), or switch to edge. |
| vLLM fails with CUDA out of memory | Another process holds the GPU (`nvidia-smi`), or settings too high. Lower `--gpu-memory-utilization` to 0.85 and/or `--max-model-len` to 2048 in the unit file, then `systemctl --user daemon-reload && systemctl --user restart vllm`. |
| vLLM runs but model names do not match | `VLLM_MODEL` must equal the name vLLM serves (`curl localhost:8000/v1/models`). The code default is Phi-4, not Qwen. |
| Services gone after reboot or logout | Linger not enabled: `sudo loginctl enable-linger <vm-user>`, and confirm `systemctl --user is-enabled` shows `enabled`. |
| Wrong scenario after restart | The persisted selection in `backend/.active-scenario.json` wins over `PROMPT_PROFILE`. Switch in the dashboard, or delete the file and restart. |
| Agent page cannot answer | `/agent` always uses vLLM at `SLM_URL`, even in cloud mode. Check vLLM health. |
| Disk full on the VM root | Model cache must live under `/storage/huggingface`, not `~/.cache`. See [DEPLOYMENT.md](DEPLOYMENT.md#4-download-the-model-to-storage). |

## Updating and rollback

Update the code:

```bash
cd ~/Lobby-Live-Stream-Agent-v2
git pull
(cd backend && npm install) && (cd frontend && npm install)
systemctl --user restart lobby-backend lobby-frontend
```

Roll back the code to a known commit, then reinstall and restart as above:

```bash
git log --oneline -10
git checkout <commit-or-tag>
```

Roll back the model: edit the `vllm` unit (`~/.config/systemd/user/vllm.service`) to the previous model and settings, set `VLLM_MODEL` in `.env` to the same name, then `systemctl --user daemon-reload && systemctl --user restart vllm lobby-backend`. Keep a copy of the previous unit file before changing it. The previous model (`microsoft/Phi-4-multimodal-instruct`) is the code default for `VLLM_MODEL`; its weights must already be in `/storage/huggingface` or be downloaded again.

To fall back to cloud inference, change `MODEL_MODE=cloud` (or switch in the dashboard) and make sure Azure OpenAI is configured. This is a manual decision, not automatic.

## Smoke test checklist

Run after a deployment, update or restart.

1. **Services**: `systemctl --user status vllm lobby-backend lobby-frontend` shows all running.
2. **Inference health** (edge): `curl localhost:8000/health` returns 200 and `curl localhost:8000/v1/models` lists the model in `VLLM_MODEL`. `curl localhost:3001/api/analysis/model-mode` reports the expected mode.
3. **Playback**: open `http://<vm-ip>:5173`, enter the RTSP URL, click Start. Video appears within a few seconds and keeps advancing.
4. **Frame analysis**: wait one `FRAME_CAPTURE_INTERVAL` (default 60 s). A new observation with an image and a scene description appears; the countdown resets. `curl localhost:3001/api/analysis/frames` returns it.
5. **Scenario switching**: switch to another scenario in the dashboard. The panels change, `GET /api/analysis/scenarios/active` reports the new id, and the next observation follows the new prompt. Switch back if needed.
6. **Agent** (edge): open `/agent` and ask a question about recent observations; an answer is returned.
7. **Persistence** (after installing): reboot the VM and confirm all three services return without logging in.

If any step fails, use the troubleshooting table above.

## Key paths

| Item | Location |
|---|---|
| Repository | `~/Lobby-Live-Stream-Agent-v2` |
| Configuration | `~/Lobby-Live-Stream-Agent-v2/.env` |
| systemd units | `~/.config/systemd/user/{vllm,lobby-backend,lobby-frontend}.service` |
| vLLM Python env | `/storage/vllm-env` |
| Model cache | `/storage/huggingface` |
| Active scenario | `backend/.active-scenario.json` |
| Captured JPEGs | `backend/captures/` |
