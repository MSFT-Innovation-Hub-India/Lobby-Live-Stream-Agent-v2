import { useState } from 'react';
import './StreamControls.css';

const StreamControls = ({ onStreamStart, onStreamStop, isStreaming, loading, nextCaptureIn }) => {
  const [rtspUrl, setRtspUrl] = useState('');
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const handleStart = async () => {
    if (!rtspUrl.trim()) {
      setError('Please enter an RTSP URL');
      return;
    }

    if (!rtspUrl.startsWith('rtsp://')) {
      setError('URL must start with rtsp://');
      return;
    }

    setError('');
    try {
      await onStreamStart(rtspUrl);
      setShowSettings(false); // Hide settings after starting
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStop = async () => {
    setError('');
    try {
      await onStreamStop();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="stream-controls">
      <div className="control-header">
        <div className="status-section">
          <div className="status-badge-large">
            <span className={`status-indicator ${isStreaming ? 'active' : 'inactive'}`}>
              {isStreaming ? '🟢 Streaming' : '⚫ Stopped'}
            </span>
          </div>
          
          {isStreaming && nextCaptureIn !== null && (
            <div className="countdown-timer">
              <div className="countdown-label">Next Frame Capture</div>
              <div className="countdown-value">{nextCaptureIn}s</div>
            </div>
          )}
        </div>

        <div className="action-buttons">
          {!isStreaming && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn btn-settings"
            >
              ⚙️ {showSettings ? 'Hide' : 'Show'} Settings
            </button>
          )}
          <button
            onClick={handleStop}
            disabled={!isStreaming || loading}
            className="btn btn-stop"
          >
            {loading ? '⏳ Stopping...' : '⏹️ Stop Stream'}
          </button>
        </div>
      </div>

      {showSettings && !isStreaming && (
        <div className="settings-panel">
          <div className="settings-header">
            <h3>🔒 Stream Configuration</h3>
            <p className="settings-note">Your credentials are kept secure and never stored</p>
          </div>
          
          <div className="control-group">
            <label htmlFor="rtsp-url">RTSP Stream URL</label>
            <input
              id="rtsp-url"
              type="password"
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://username:password@ip:port/stream"
              disabled={loading}
              className="url-input"
            />
          </div>

          {error && (
            <div className="error-message">
              <p>⚠️ {error}</p>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={loading}
            className="btn btn-start btn-full"
          >
            {loading ? '⏳ Starting...' : '▶️ Start Stream'}
          </button>
        </div>
      )}

      {!isStreaming && !showSettings && (
        <div className="quick-start-hint">
          <p>👆 Click "Show Settings" to configure your RTSP stream</p>
        </div>
      )}
    </div>
  );
};

export default StreamControls;
