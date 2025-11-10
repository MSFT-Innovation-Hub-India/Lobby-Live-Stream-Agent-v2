import { useState } from 'react';
import './StreamControls.css';

const StreamControls = ({ onStreamStart, onStreamStop, isStreaming, loading }) => {
  const [rtspUrl, setRtspUrl] = useState('');
  const [error, setError] = useState('');

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
      <div className="control-group">
        <label htmlFor="rtsp-url">RTSP Stream URL</label>
        <input
          id="rtsp-url"
          type="text"
          value={rtspUrl}
          onChange={(e) => setRtspUrl(e.target.value)}
          placeholder="rtsp://camera-ip:554/stream"
          disabled={isStreaming || loading}
          className="url-input"
        />
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="button-group">
        <button
          onClick={handleStart}
          disabled={isStreaming || loading}
          className="btn btn-start"
        >
          {loading ? '⏳ Starting...' : '▶️ Start Stream'}
        </button>
        <button
          onClick={handleStop}
          disabled={!isStreaming || loading}
          className="btn btn-stop"
        >
          {loading ? '⏳ Stopping...' : '⏹️ Stop Stream'}
        </button>
      </div>

      <div className="info-panel">
        <div className="info-item">
          <span className="info-label">Status:</span>
          <span className={`status-badge ${isStreaming ? 'active' : 'inactive'}`}>
            {isStreaming ? '🟢 Streaming' : '⚫ Stopped'}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Frame Capture:</span>
          <span className="info-value">
            {isStreaming ? '📸 Every 60 seconds' : '⏸️ Paused'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StreamControls;
