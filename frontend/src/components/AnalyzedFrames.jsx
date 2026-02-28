import { useEffect, useState } from 'react';
import { analysisService } from '../services/api';
import './AnalyzedFrames.css';

// Configuration
const MAX_FRAMES_TO_KEEP = 10;

const AnalyzedFrames = ({ refreshTrigger }) => {
  const [frames, setFrames] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
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
      const limitedFrames = (data.frames || []).slice(0, MAX_FRAMES_TO_KEEP);
      setFrames(limitedFrames);
      setError(null);
    } catch (err) {
      console.error('Error fetching frames:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const generateQuirkyTitle = (analysis) => {
    const titles = [
      "👀 What's Happening in the Lobby?",
      "🎬 Scene of the Moment",
      "📸 Lobby Chronicles",
      "🔍 Through the AI's Eyes",
      "🎭 The Lobby Scene Unfolds",
      "🌟 Snapshot Insights",
      "🎪 Today's Lobby Theater",
      "🎨 A Moment in Time",
      "🎯 Scene Analysis Report",
      "🎪 Welcome to the Lobby Show"
    ];
    
    const index = Math.floor(analysis.length % titles.length);
    return titles[index];
  };

  const formatAnalysis = (analysisData) => {
    if (!analysisData) return { sections: [], caption: null, counts: null };

    // Handle both string and object formats
    let analysis, counts;
    if (typeof analysisData === 'string') {
      analysis = analysisData;
      counts = null;
    } else {
      analysis = analysisData.scene_description || '';
      // Ensure counts are defined, defaulting to null if all are 0 or undefined
      const hasValidCounts = (
        analysisData.persons_near_doors !== undefined ||
        analysisData.persons_at_reception !== undefined ||
        analysisData.persons_in_other_areas !== undefined ||
        analysisData.total_persons !== undefined
      );
      counts = hasValidCounts ? {
        near_doors: analysisData.persons_near_doors || 0,
        at_reception: analysisData.persons_at_reception || 0,
        other_areas: analysisData.persons_in_other_areas || 0,
        total: analysisData.total_persons || 0
      } : null;
    }

    if (!analysis) return { sections: [], caption: null, counts };

    // Extract HTML caption if present
    let caption = null;
    let remainingText = analysis;
    const captionMatch = analysis.match(/<span class=["']ai-caption["']>(.*?)<\/span>/);
    if (captionMatch) {
      caption = captionMatch[1];
      remainingText = analysis.replace(captionMatch[0], '').trim();
    }

    // Parse markdown-style formatting
    const sections = [];
    const lines = remainingText.split('\n').filter(line => line.trim());

    let currentSection = { title: 'Overview', content: [], items: [] };
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check for markdown headers (### Header or **Header:**)
      if (trimmedLine.match(/^#{1,3}\s+\*?\*?(.+?)\*?\*?:?$/) || trimmedLine.match(/^\*\*[🏢🏛️👥👤🎨💡🚪🪴✨🔍📍🎯💼🏃📊🎬🏦].+?\*\*:?$/)) {
        if (currentSection.content.length > 0 || currentSection.items.length > 0) {
          sections.push({ ...currentSection });
        }
        let title = trimmedLine.replace(/^#{1,3}\s+/, '').replace(/^\*\*/, '').replace(/\*\*:?$/, '').trim();
        currentSection = {
          title: title,
          content: [],
          items: []
        };
      }
      // Check for bullet points
      else if (trimmedLine.match(/^[-*]\s+(.+)/)) {
        const content = trimmedLine.replace(/^[-*]\s+/, '');
        // Parse bold text within bullets
        const formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        currentSection.items.push(formatted);
      }
      // Regular text with potential bold formatting
      else if (trimmedLine) {
        const formatted = trimmedLine.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        currentSection.content.push(formatted);
      }
    }
    
    if (currentSection.content.length > 0 || currentSection.items.length > 0) {
      sections.push(currentSection);
    }

    // If no sections were created, make one from the whole analysis
    if (sections.length === 0 && remainingText) {
      const formatted = remainingText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      sections.push({
        title: '📋 Analysis',
        content: [formatted],
        items: []
      });
    }

    return { sections, caption, counts };
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : frames.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < frames.length - 1 ? prev + 1 : 0));
  };

  if (loading && frames.length === 0) {
    return (
      <div className="analyzed-frames-container">
        <h2>📸 Analyzed Frames</h2>
        <div className="loading">Loading analyzed frames...</div>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="analyzed-frames-container">
        <div className="frames-header">
          <h2>📸 Analyzed Frames</h2>
          <button onClick={fetchFrames} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
        <div className="no-frames">
          <p>✨ No analyzed frames yet. Your AI-powered insights will appear here!</p>
          <p className="info-text">Frames are captured every 60 seconds when streaming is active.</p>
        </div>
      </div>
    );
  }

  const currentFrame = frames[currentIndex];
  const { sections, caption, counts } = formatAnalysis(currentFrame.analysis);

  return (
    <div className="analyzed-frames-container">
      <div className="frames-header">
        <h2>📸 Analyzed Frames</h2>
        <div className="header-actions">
          <span className="frame-counter">
            {currentIndex + 1} / {frames.length}
          </span>
          <button onClick={fetchFrames} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      <div className="carousel-container">
        <button 
          className="carousel-btn carousel-btn-left" 
          onClick={goToPrevious}
          disabled={frames.length <= 1}
        >
          ‹
        </button>

        <div className="frame-showcase">
          <div className="showcase-top-section">
            <div className="showcase-left-column">
              {caption && (
                <div className="catchy-title-banner">
                  <span className="title-icon">✨</span>
                  <h3 className="catchy-title">{caption}</h3>
                  <span className="title-icon">✨</span>
                </div>
              )}
              
              <div className="showcase-image-wrapper">
                <img
                  src={`${import.meta.env.VITE_API_BASE_URL}${currentFrame.filepath}`}
                  alt={`Frame ${currentFrame.id}`}
                  className="showcase-image"
                />
                <div className="image-overlay">
                  <div className="frame-timestamp">
                    📅 {formatTimestamp(currentFrame.timestamp)}
                  </div>
                </div>
              </div>
            </div>

            {counts && (
              <div className="live-count-panel">
                <div className="count-panel-header">
                  <h4 className="live-count-title">📊 Live Count</h4>
                  <p className="live-count-subtitle">Real-time detection</p>
                </div>
                <div className="count-grid">
                  <div className="count-card">
                    <div className="count-card-header">
                      <span className="count-icon">🚪</span>
                      <span className="count-label">Near Doors</span>
                    </div>
                    <span className="count-value">{counts.near_doors}</span>
                  </div>
                  <div className="count-card">
                    <div className="count-card-header">
                      <span className="count-icon">🏢</span>
                      <span className="count-label">At Reception</span>
                    </div>
                    <span className="count-value">{counts.at_reception}</span>
                  </div>
                  <div className="count-card">
                    <div className="count-card-header">
                      <span className="count-icon">🚶</span>
                      <span className="count-label">Other Areas</span>
                    </div>
                    <span className="count-value">{counts.other_areas || 0}</span>
                  </div>
                  <div className="count-card count-card-highlight">
                    <div className="count-card-header">
                      <span className="count-icon">👥</span>
                      <span className="count-label">Total Visible</span>
                    </div>
                    <span className="count-value count-value-highlight">{counts.total}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="showcase-analysis-section">
            <div className="analysis-header">
              <h3 className="analysis-title">{generateQuirkyTitle(currentFrame.analysis)}</h3>
              <p className="analysis-subtitle">AI-Powered Scene Analysis</p>
            </div>

            <div className="analysis-content">
              {sections.map((section, idx) => (
                <div key={idx} className="analysis-card">
                  <div className="card-header">
                    <h4 className="section-title">{section.title}</h4>
                  </div>
                  <div className="card-content">
                    {section.content.map((paragraph, pIdx) => (
                      <p key={pIdx} dangerouslySetInnerHTML={{ __html: paragraph }}></p>
                    ))}
                    {section.items.length > 0 && (
                      <ul className="section-list">
                        {section.items.map((item, iIdx) => (
                          <li key={iIdx} dangerouslySetInnerHTML={{ __html: item }}></li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button 
          className="carousel-btn carousel-btn-right" 
          onClick={goToNext}
          disabled={frames.length <= 1}
        >
          ›
        </button>
      </div>

      {frames.length > 1 && (
        <div className="carousel-dots">
          {frames.map((_, idx) => (
            <button
              key={idx}
              className={`dot ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Go to frame ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalyzedFrames;
