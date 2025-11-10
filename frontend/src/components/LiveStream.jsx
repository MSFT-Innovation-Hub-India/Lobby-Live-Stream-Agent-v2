import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import './LiveStream.css';

const LiveStream = ({ streamUrl, isStreaming }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!streamUrl || !isStreaming) {
      // Clean up HLS instance if stream stops
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const fullStreamUrl = `http://localhost:3001${streamUrl}`;

    if (Hls.isSupported()) {
      // Initialize HLS.js
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;

      hls.loadSource(fullStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, playing video');
        video.play().catch(e => {
          console.error('Error playing video:', e);
          setError('Failed to play video. Click to play.');
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, cannot recover');
              setError('Fatal streaming error occurred');
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        if (hls) {
          hls.destroy();
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = fullStreamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => {
          console.error('Error playing video:', e);
          setError('Failed to play video. Click to play.');
        });
      });
    } else {
      setError('HLS is not supported in your browser');
    }
  }, [streamUrl, isStreaming]);

  const handleVideoClick = () => {
    if (videoRef.current && error) {
      videoRef.current.play().catch(e => console.error('Play error:', e));
      setError(null);
    }
  };

  return (
    <div className="live-stream-container">
      <div className="stream-header">
        <h2>🔴 Live Stream</h2>
        {isStreaming && <span className="live-indicator">LIVE</span>}
      </div>
      
      {isStreaming ? (
        <div className="video-wrapper">
          <video
            ref={videoRef}
            className="video-player"
            controls
            muted
            onClick={handleVideoClick}
          />
          {error && (
            <div className="error-overlay" onClick={handleVideoClick}>
              <p>{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="no-stream">
          <p>No active stream. Enter an RTSP URL and click Start Stream.</p>
        </div>
      )}
    </div>
  );
};

export default LiveStream;
