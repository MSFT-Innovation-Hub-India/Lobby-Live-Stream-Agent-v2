import { useEffect, useState } from 'react';
import { analysisService } from '../services/api';
import './AnalyzedFrames.css';

const AnalyzedFrames = ({ refreshTrigger }) => {
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFrames();
    // Poll for new frames every 10 seconds
    const interval = setInterval(fetchFrames, 10000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const fetchFrames = async () => {
    try {
      setLoading(true);
      const data = await analysisService.getFrames();
      setFrames(data.frames || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching frames:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading && frames.length === 0) {
    return (
      <div className="analyzed-frames-container">
        <h2>📸 Analyzed Frames</h2>
        <div className="loading">Loading analyzed frames...</div>
      </div>
    );
  }

  return (
    <div className="analyzed-frames-container">
      <div className="frames-header">
        <h2>📸 Analyzed Frames</h2>
        <button onClick={fetchFrames} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      {frames.length === 0 ? (
        <div className="no-frames">
          <p>No analyzed frames yet. Frames will appear here once captured and analyzed.</p>
          <p className="info-text">Frames are captured every 60 seconds when streaming is active.</p>
        </div>
      ) : (
        <div className="frames-grid">
          {frames.map((frame) => (
            <div key={frame.id} className="frame-card">
              <div className="frame-image-wrapper">
                <img
                  src={`http://localhost:3001${frame.filepath}`}
                  alt={`Frame ${frame.id}`}
                  className="frame-image"
                />
                <div className="frame-timestamp">
                  {formatTimestamp(frame.timestamp)}
                </div>
              </div>
              <div className="frame-analysis">
                <h3>Analysis</h3>
                <p>{frame.analysis}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalyzedFrames;
