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

## Future Enhancements

1. **Exponential backoff**: Increase delay between retry attempts
2. **Health monitoring**: Track success rate and alert on persistent failures
3. **Notification system**: Alert users when stream is down
4. **Multiple RTSP sources**: Failover to backup cameras
5. **Connection testing**: Pre-validate RTSP URL before starting stream
6. **Metrics dashboard**: Visualize uptime, restarts, and failure patterns
