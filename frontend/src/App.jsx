import { useState, useEffect } from 'react';
import StreamControls from './components/StreamControls';
import LiveStream from './components/LiveStream';
import AnalyzedFrames from './components/AnalyzedFrames';
import { streamService } from './services/api';
import './App.css';

function App() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [nextCaptureIn, setNextCaptureIn] = useState(60);

  // Countdown timer for frame capture
  useEffect(() => {
    if (!isStreaming) {
      setNextCaptureIn(60);
      return;
    }

    const interval = setInterval(() => {
      setNextCaptureIn((prev) => {
        if (prev <= 1) {
          return 60; // Reset to 60 seconds
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleStreamStart = async (rtspUrl) => {
    setLoading(true);
    try {
      const response = await streamService.startStream(rtspUrl);
      if (response.success) {
        setIsStreaming(true);
        setStreamUrl(response.stream.streamUrl);
        setNextCaptureIn(60); // Reset countdown
        setRefreshTrigger(prev => prev + 1);
        console.log('Stream started successfully');
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleStreamStop = async () => {
    setLoading(true);
    try {
      const response = await streamService.stopStream();
      if (response.success) {
        setIsStreaming(false);
        setStreamUrl(null);
        setNextCaptureIn(60);
        console.log('Stream stopped successfully');
      }
    } catch (error) {
      console.error('Error stopping stream:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎥 Lobby Live Stream Agent v2</h1>
        <p className="subtitle">Real-time RTSP streaming with AI-powered frame analysis</p>
      </header>

      <main className="app-main">
        <StreamControls
          onStreamStart={handleStreamStart}
          onStreamStop={handleStreamStop}
          isStreaming={isStreaming}
          loading={loading}
          nextCaptureIn={nextCaptureIn}
        />

        <LiveStream 
          streamUrl={streamUrl} 
          isStreaming={isStreaming} 
        />

        <AnalyzedFrames 
          refreshTrigger={refreshTrigger}
        />
      </main>

      <footer className="app-footer">
        <p>Powered by Azure OpenAI GPT-4o • Microsoft Innovation Hub India</p>
      </footer>
    </div>
  );
}

export default App;
