# Stream Recovery and Auto-Restart Implementation

## Problem
The backend was stopping when the FFmpeg RTSP stream disconnected due to network errors (Error -10054: Connection reset). After FFmpeg exited, the frame capture service continued trying to capture frames from a non-existent stream, leading to repeated failures.

## Solution
Implemented automatic stream recovery and better coordination between services:

### 1. **Stream Service Enhancements** (`streamService.js`)

#### Added Auto-Restart Mechanism
- **Automatic reconnection** when FFmpeg exits unexpectedly (exit code ≠ 0)
- **Configurable retry logic**: 
  - Maximum 10 restart attempts
  - 5-second delay between attempts
  - Exponential backoff can be added if needed
- **Smart logging**: Only logs errors and important messages to reduce console noise

#### New Properties
```javascript
{
  rtspUrl: null,              // Stores RTSP URL for restarts
  autoRestart: true,          // Controls auto-restart behavior
  restartDelay: 5000,         // Delay before restart (5 seconds)
  restartAttempts: 0,         // Current restart attempt count
  maxRestartAttempts: 10      // Maximum restart attempts
}
```

#### Key Features
- **Normal exit handling**: When FFmpeg exits with code 0 (normal), no restart is attempted
- **Manual stop prevention**: When manually stopped, `autoRestart` is set to false
- **Maximum attempts**: After 10 failed restarts, stops attempting and logs error message
- **Status tracking**: Enhanced status endpoint shows restart attempts and configuration

### 2. **Frame Analysis Service Improvements** (`frameAnalysisService.js`)

#### Stream-Aware Capture
- **Checks stream status** before attempting frame capture
- **Skips capture** when stream is down, waits for automatic restart
- **Failure tracking**: Counts consecutive failed captures
- **Auto-stop on failures**: Stops after 5 consecutive failures to prevent endless errors

#### New Properties
```javascript
{
  streamService: null,        // Reference to stream service for status checks
  failedCaptureCount: 0,      // Consecutive capture failures
  maxFailedCaptures: 5        // Maximum failures before auto-stop
}
```

#### Benefits
- Prevents resource waste trying to capture from dead stream
- Automatically resumes when stream restarts
- Self-protection against persistent failures

### 3. **Service Coordination** (`routes/stream.js`)

The stream route now passes the `streamService` reference to `frameAnalysisService`:

```javascript
frameAnalysisService.startCapture(rtspUrl, streamService)
```

This enables:
- Real-time stream status checks
- Coordinated start/stop behavior
- Better error handling and recovery

## Error Handling Improvements

### Network Errors (Error -10054)
- **Before**: FFmpeg would exit, backend would continue trying to capture frames
- **After**: FFmpeg automatically restarts, frame capture waits during downtime

### Connection Loss Recovery
1. FFmpeg detects connection loss
2. Process exits with non-zero code
3. Auto-restart mechanism triggered after 5 seconds
4. Frame capture service waits during restart
5. Normal operation resumes when connection restored

### Failure Scenarios
- **Temporary network issues**: Auto-reconnects within 5 seconds
- **Persistent connection problems**: Retries up to 10 times (50 seconds total)
- **Camera offline**: After max attempts, stops and logs error for manual intervention
- **Frame capture failures**: After 5 consecutive failures, stops to prevent error spam

## Status API Enhancement

The `/api/stream/status` endpoint now returns:

```json
{
  "success": true,
  "stream": {
    "isStreaming": true,
    "streamUrl": "/stream/stream.m3u8",
    "autoRestart": true,
    "restartAttempts": 2,
    "rtspUrl": "rtsp://..."
  },
  "capture": {
    "isCapturing": true,
    "frameCount": 5,
    "rtspUrl": "rtsp://...",
    "deploymentName": "microsoft/Phi-4-multimodal-instruct",
    "modelMode": "edge",
    "failedCaptureCount": 0,
    "maxFailedCaptures": 5
  }
}
```

## Configuration Options

### Environment Variables (Optional Future Enhancement)
You can add these to `.env` for customization:

```bash
# Stream auto-restart configuration
STREAM_RESTART_DELAY=5000        # Milliseconds before restart
STREAM_MAX_RESTART_ATTEMPTS=10   # Maximum restart attempts
STREAM_AUTO_RESTART=true         # Enable/disable auto-restart

# Frame capture configuration  
CAPTURE_MAX_FAILURES=5           # Max consecutive capture failures
CAPTURE_INTERVAL=60000           # Capture interval in milliseconds
```

## Testing the Changes

### Test Auto-Restart
1. Start the stream
2. Disconnect network or stop camera
3. Observe auto-restart attempts in logs
4. Reconnect network
5. Verify stream resumes automatically

### Test Frame Capture Coordination
1. Start stream and capture
2. Trigger a stream failure
3. Verify frame capture waits (doesn't spam errors)
4. Verify capture resumes when stream restarts

### Test Manual Stop
1. Start stream
2. Click Stop button
3. Verify stream doesn't auto-restart
4. Verify both stream and capture stop cleanly

## Benefits

✅ **Resilient**: Automatically recovers from temporary network issues  
✅ **Efficient**: Doesn't waste resources on dead connections  
✅ **Informative**: Clear logging of restart attempts and failures  
✅ **Coordinated**: Stream and frame capture work together  
✅ **Safe**: Self-limits to prevent infinite retry loops  
✅ **Maintainable**: Easy to adjust retry logic and timeouts  

---

## Smooth Live Stream Playback — Tuning Guide

The initial implementation suffered from frequent freezes, frame drops, and broken playback in the browser. This section documents the root causes and the changes made to achieve smooth, consistent HLS playback.

### Root Causes Identified

1. **Orphaned FFmpeg process** — A stale FFmpeg from a previous session was still running and writing to the same `stream.m3u8` playlist. Two FFmpeg processes competing over the same output caused segment interleaving, corrupt playlists, and constant player confusion.

2. **Too few segments retained** — `hls_list_size 5` kept only 10 seconds of segments. The player couldn't fetch segments fast enough before they were deleted, causing 404 errors and playback gaps.

3. **No constant framerate enforcement** — Variable-rate RTSP input caused segment duration drift. Some segments were shorter or longer than expected, breaking the player's buffer model.

4. **Corrupt frame discarding** — `-fflags +genpts+discardcorrupt` dropped any slightly malformed frames from the RTSP source. On a live IP camera with occasional glitches, this created visible gaps.

5. **Insufficient client-side buffering** — The HLS.js player had a 10-second max buffer, which left no room to absorb network jitter or segment fetch delays.

6. **No stall recovery** — When the player buffer ran empty, the video froze indefinitely. There was no logic to seek forward to the live edge.

7. **Service not killing child processes** — The systemd service used the default `KillMode`, so when the backend was restarted, the child FFmpeg process was left orphaned and continued writing to the stream directory.

### Backend Changes (`streamService.js`)

#### FFmpeg Command Tuning

| Parameter | Before | After | Why |
|-----------|--------|-------|-----|
| `-fflags` | `+genpts+discardcorrupt` | `+genpts+igndts` | Stop discarding slightly malformed RTSP frames. `igndts` ignores DTS timestamps that may be out of order from the camera, letting FFmpeg fix them via `genpts` instead of dropping the frame. |
| `-err_detect` | *(not set)* | `ignore_err` | Tolerate minor input errors from the RTSP source instead of aborting. IP cameras often produce occasional malformed packets. |
| `-r` | *(not set)* | `30` | Force constant 30fps output. The RTSP source delivers variable framerate; without this, segment durations drift. |
| `-vsync` | *(not set)* | `cfr` | Enforce Constant Frame Rate mode. Duplicates or drops frames as needed to maintain exact 30fps timing, producing consistent 2-second HLS segments. |
| `-hls_list_size` | `5` | `10` | Keep 20 seconds of segments in the playlist (10 × 2s). Gives the player much more runway to absorb network delays without hitting 404s on already-deleted segments. |

All other FFmpeg parameters (`-preset ultrafast`, `-tune zerolatency`, `-g 60`, `-b:v 2500k`, `-hls_time 2`, etc.) were kept unchanged — they were already well-tuned for low-latency live encoding.

### Backend Changes (`server.js`)

#### Explicit MIME Types for HLS

```javascript
if (req.path.endsWith('.m3u8')) {
  res.set('Content-Type', 'application/vnd.apple.mpegurl');
} else if (req.path.endsWith('.ts')) {
  res.set('Content-Type', 'video/mp2t');
}
```

Express's `static` middleware may serve `.m3u8` as `application/octet-stream` depending on the system's MIME database. Setting the correct types explicitly ensures HLS.js and browsers handle the content correctly.

### Frontend Changes (`LobbyDashboard.jsx`)

#### HLS.js Configuration

| Setting | Before | After | Why |
|---------|--------|-------|-----|
| `liveSyncDurationCount` | `3` | `4` | Stay 8 seconds behind live edge (4 × 2s segments) instead of 6. The extra cushion prevents the player from running out of buffer during minor network blips. |
| `liveMaxLatencyDurationCount` | `8` | `12` | Allow up to 24 seconds behind live before force-seeking. Was 16 seconds — too aggressive, causing jarring jumps forward. |
| `maxBufferLength` | `10` | `30` | Buffer up to 30 seconds of video ahead. A larger forward buffer absorbs network jitter and slow segment downloads. |
| `maxMaxBufferLength` | `30` | `60` | Hard ceiling for buffer growth during catch-up. 60 seconds ensures the player never stalls even during prolonged slowdowns. |
| `maxBufferSize` | `30MB` | `60MB` | Proportional increase with buffer length. At 2.5 Mbps, 60 seconds ≈ 19MB, so 60MB provides ample headroom. |
| `startFragPrefetch` | *(not set)* | `true` | Begin downloading the next segment while the current one is still loading. Eliminates the gap between segment fetches. |
| `highBufferWatchdogPeriod` | *(not set)* | `3` | Check every 3 seconds if the buffer has grown too large and needs trimming. Prevents unbounded memory growth. |
| `manifestLoadingMaxRetry` | `6` | `10` | More retries before giving up on the playlist. |
| `levelLoadingMaxRetry` | `6` | `10` | More retries for level/variant playlist loads. |
| `fragLoadingMaxRetry` | `6` | `10` | More retries for segment downloads. |
| `fragLoadingTimeOut` | `10000` | `20000` | 20-second timeout per segment download (was 10s). 2-second segments at 2.5Mbps are ~625KB — 20 seconds is generous for slow links. |
| `*RetryDelay` | *(not set)* | `500` | Wait 500ms between retries instead of immediately hammering the server. Gives the network time to recover. |

#### Stall Recovery Logic

**Buffer stall event** — When HLS.js reports `BUFFER_STALLED_ERROR` (non-fatal), the player now seeks to `hls.liveSyncPosition` (the ideal live playback point). Previously, the player would just freeze.

**Video `waiting` event** — A 2-second debounced listener detects when the video element is starved for data. If the player has drifted more than 4 seconds behind live, it seeks forward automatically instead of waiting for data that may never arrive.

**Fatal error reinit** — Previously, unrecoverable errors left a dead player. Now the HLS instance is destroyed and re-created after a 2-second delay, giving the player a fresh start.

### Systemd Service Fix (`lobby-backend.service`)

```ini
KillMode=control-group    # Kill ALL processes in the cgroup (including FFmpeg)
KillSignal=SIGTERM        # Graceful shutdown signal
TimeoutStopSec=10         # Force-kill after 10 seconds if still running
```

Previously, `systemctl --user restart lobby-backend` sent SIGTERM only to the Node.js process. FFmpeg (a child process) was left running as an orphan, continuing to write segments and corrupt the playlist. `KillMode=control-group` ensures all child processes are terminated on stop/restart.

### Operational Steps Performed

1. Killed orphaned FFmpeg process (PID 190044) that had been running since the previous day
2. Cleared all stale `.ts` segments and `stream.m3u8` from `backend/stream/`
3. Restarted `lobby-backend` service (picks up new FFmpeg parameters)
4. Restarted `lobby-frontend` service (picks up new HLS.js configuration)
5. Reloaded systemd daemon to apply the updated service file

### Latency vs. Smoothness Trade-off

These settings prioritize **smooth, uninterrupted playback** over minimum latency. The stream will be approximately 8–10 seconds behind real-time. This is the right trade-off for a lobby monitoring dashboard where continuous visibility matters more than sub-second responsiveness. If lower latency is needed in the future, reduce `liveSyncDurationCount` and `maxBufferLength` — but expect more frequent stalls on unreliable networks.

---

## Future Enhancements

1. **Exponential backoff**: Increase delay between retry attempts
2. **Health monitoring**: Track success rate and alert on persistent failures
3. **Notification system**: Alert users when stream is down
4. **Multiple RTSP sources**: Failover to backup cameras
5. **Connection testing**: Pre-validate RTSP URL before starting stream
6. **Metrics dashboard**: Visualize uptime, restarts, and failure patterns
