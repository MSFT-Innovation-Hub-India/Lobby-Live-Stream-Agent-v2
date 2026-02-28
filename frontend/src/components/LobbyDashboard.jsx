import React, { useEffect, useMemo, useState, useRef } from "react";
import Hls from 'hls.js';
import {
  Camera,
  CircleDot,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Settings,
  RefreshCw,
  BarChart3,
  Clock,
  Users,
  Users2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Dot,
  Radio,
  DoorOpen,
  UserCheck,
  Eye,
  X,
  Baby,
  Heart,
  Armchair,
  Layers,
  Bell,
  AlertCircle,
  Mail,
  Cloud,
  Cpu
} from "lucide-react";
import { streamService, analysisService } from '../services/api';

/**
 * Lobby Live Stream Agent v2 — Professional Dashboard Redesign
 * Framework: React + TailwindCSS
 * Icons: lucide-react
 * Integrated with existing backend API
 */

// ---------- Helper UI ----------
const Capsule = ({ children, tone = "slate" }) => (
  <span
    className={
      `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ` +
      {
        green:
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15",
        red: "border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/15",
        amber:
          "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15",
        slate:
          "border-slate-500/30 bg-slate-500/10 text-slate-300 hover:bg-slate-500/15",
        indigo:
          "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/15",
      }[tone]
    }
  >
    {children}
  </span>
);

const SectionCard = ({ title, right, children }) => (
  <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/40 to-slate-900/20 p-5 shadow-lg shadow-black/20">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-sm font-semibold tracking-wide text-slate-200">{title}</h3>
      <div>{right}</div>
    </div>
    {children}
  </div>
);

// ---------- Icon Map ----------
const ICON_MAP = {
  DoorOpen, UserCheck, Users, Eye, Baby, Heart, Armchair,
};

const getIcon = (iconName) => ICON_MAP[iconName] || Eye;

// ---------- Main Component ----------
export default function LobbyLiveStreamDashboard() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rtspUrl, setRtspUrl] = useState(import.meta.env.VITE_DEFAULT_RTSP_URL || '');
  const [showRtspInput, setShowRtspInput] = useState(false);
  const [modelName, setModelName] = useState('GPT-4o');
  const [selectedFrame, setSelectedFrame] = useState(null);
  
  // Scenario state
  const [scenarios, setScenarios] = useState([]);
  const [scenarioConfig, setScenarioConfig] = useState(null);
  const [switchingScenario, setSwitchingScenario] = useState(false);
  
  // Model mode state (cloud vs edge)
  const [modelMode, setModelMode] = useState('cloud');
  const [slmUrl, setSlmUrl] = useState('');
  const [switchingModel, setSwitchingModel] = useState(false);
  const [slmHealthy, setSlmHealthy] = useState(null);
  
  // Analyzed frames state
  const [analyzedFrames, setAnalyzedFrames] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  
  // Alert state
  const [alertMessage, setAlertMessage] = useState(null);
  const [dismissedAlertFrameId, setDismissedAlertFrameId] = useState(null);

  // Initialize HLS player
  useEffect(() => {
    if (!streamUrl || !videoRef.current) {
      console.log('HLS init skipped - streamUrl:', !!streamUrl, 'videoRef:', !!videoRef.current);
      return;
    }

    console.log('Initializing HLS player with URL:', streamUrl);
    const video = videoRef.current;

    // Cleanup function
    const cleanup = () => {
      if (hlsRef.current) {
        console.log('Cleaning up HLS player');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    if (Hls.isSupported()) {
      console.log('HLS.js is supported, creating player...');
      
      // Clean up any existing instance first
      cleanup();
      
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        debug: false,
        xhrSetup: (xhr, url) => {
          xhr.withCredentials = false;
        },
        // Live sync: stay 4 segments behind live edge for smooth playback
        liveSyncDurationCount: 4,
        liveMaxLatencyDurationCount: 12,
        liveDurationInfinity: true,
        // Generous buffers to prevent stalls
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1000 * 1000,
        maxBufferHole: 0.5,
        // Prefetch next fragment while current one is loading
        startFragPrefetch: true,
        // Faster high-buffer watchdog to prevent drift
        highBufferWatchdogPeriod: 3,
        // Timeouts and retries
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 10,
        manifestLoadingRetryDelay: 500,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 10,
        levelLoadingRetryDelay: 500,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 500,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed successfully, attempting to play...');
        video.play()
          .then(() => console.log('Video playback started successfully'))
          .catch(err => console.error('Auto-play prevented or error:', err));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('HLS Error:', data.type, data.details);

        // Handle non-fatal buffer stalls by seeking to live edge
        if (!data.fatal && data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
          console.log('Buffer stalled - seeking to live edge');
          if (hls.liveSyncPosition != null) {
            video.currentTime = hls.liveSyncPosition;
          }
          return;
        }

        if (data.fatal) {
          console.error('HLS Fatal Error - attempting recovery');
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error - trying to recover...');
              setTimeout(() => {
                if (hlsRef.current) {
                  hls.startLoad();
                }
              }, 1000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error - trying to recover...');
              setTimeout(() => {
                if (hlsRef.current) {
                  hls.recoverMediaError();
                }
              }, 1000);
              break;
            default:
              console.error('Unrecoverable error - reinitializing player');
              setTimeout(() => {
                if (hlsRef.current) {
                  hls.destroy();
                  hlsRef.current = null;
                  // Re-trigger the effect by briefly clearing and resetting streamUrl
                  const savedUrl = streamUrl;
                  setStreamUrl(null);
                  setTimeout(() => setStreamUrl(savedUrl), 500);
                }
              }, 2000);
              break;
          }
        }
      });

      // When video stalls (waiting), seek closer to live edge after a short delay
      let stallTimer = null;
      const onWaiting = () => {
        if (stallTimer) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          if (hls && hls.liveSyncPosition != null && video.paused === false) {
            const drift = hls.liveSyncPosition - video.currentTime;
            if (drift > 4) {
              console.log(`Video stalled, drifted ${drift.toFixed(1)}s behind live - seeking forward`);
              video.currentTime = hls.liveSyncPosition;
            }
          }
        }, 2000);
      };
      video.addEventListener('waiting', onWaiting);

      hlsRef.current = hls;

      return () => {
        video.removeEventListener('waiting', onWaiting);
        if (stallTimer) clearTimeout(stallTimer);
        cleanup();
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('Using native HLS support');
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(err => console.log('Auto-play prevented:', err));
      });
      
      return () => {
        video.src = '';
      };
    } else {
      console.error('HLS is not supported in this browser');
    }
  }, [streamUrl]);

  // Fetch analyzed frames
  const fetchAnalyzedFrames = async () => {
    try {
      console.log('Fetching analyzed frames...');
      const response = await analysisService.getFrames();
      console.log('Analyzed frames response:', response);
      
      if (response.frames && response.frames.length > 0) {
        console.log('Setting analyzed frames:', response.frames.length, 'frames');
        // Limit to 10 frames max to prevent memory buildup
        const limitedFrames = response.frames.slice(0, 10);
        setAnalyzedFrames(limitedFrames);
        // Find the index of the newest frame (highest timestamp)
        const newestIndex = limitedFrames.reduce((maxIdx, frame, idx, arr) => 
          frame.timestamp > arr[maxIdx].timestamp ? idx : maxIdx, 0);
        setCurrentFrameIndex(newestIndex);
      } else {
        console.log('No frames in response');
      }
    } catch (error) {
      console.error('Error fetching analyzed frames:', error);
    }
  };

  // Countdown timer for frame capture
  useEffect(() => {
    if (!isStreaming) {
      setSeconds(60);
      return;
    }

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          fetchAnalyzedFrames(); // Refresh frames when countdown resets
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  // Poll for new frames every 10 seconds
  useEffect(() => {
    if (!isStreaming) return;

    const pollInterval = setInterval(() => {
      fetchAnalyzedFrames();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [isStreaming]);

  // Initial fetch
  useEffect(() => {
    fetchAnalyzedFrames();
    fetchStreamStatus();
    fetchScenarios();
    fetchModelMode();
    
    // Poll stream status every 5 seconds to stay in sync with backend
    const statusInterval = setInterval(() => {
      fetchStreamStatus();
    }, 5000);
    
    return () => clearInterval(statusInterval);
  }, []);

  const fetchModelMode = async () => {
    try {
      const result = await analysisService.getModelMode();
      if (result.success) {
        setModelMode(result.mode);
        if (result.slmUrl) setSlmUrl(result.slmUrl);
      }
    } catch (error) {
      console.error('Error fetching model mode:', error);
    }
  };

  const handleModelModeSwitch = async (mode) => {
    setSwitchingModel(true);
    try {
      const result = await analysisService.setModelMode(mode, mode === 'edge' ? slmUrl : undefined);
      if (result.success) {
        setModelMode(result.mode);
        if (result.slmUrl) setSlmUrl(result.slmUrl);
      }
    } catch (error) {
      console.error('Error switching model mode:', error);
    } finally {
      setSwitchingModel(false);
    }
  };

  const fetchScenarios = async () => {
    try {
      const [scenariosRes, activeRes] = await Promise.all([
        analysisService.getScenarios(),
        analysisService.getActiveScenario()
      ]);
      if (scenariosRes.scenarios) setScenarios(scenariosRes.scenarios);
      if (activeRes.config) setScenarioConfig(activeRes.config);
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    }
  };

  const handleScenarioSwitch = async (scenarioId) => {
    setSwitchingScenario(true);
    try {
      const result = await analysisService.switchScenario(scenarioId);
      if (result.success) {
        setScenarioConfig(result.config);
        setAnalyzedFrames([]);
        setCurrentFrameIndex(0);
        await fetchScenarios();
      }
    } catch (error) {
      console.error('Error switching scenario:', error);
    } finally {
      setSwitchingScenario(false);
    }
  };

  const fetchStreamStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/stream/status`);
      const data = await response.json();
      
      if (data.success) {
        // Sync streaming state with backend
        const backendIsStreaming = data.stream?.isStreaming || false;
        setIsStreaming(backendIsStreaming);
        
        // Only update stream URL if it actually changed to avoid re-initializing HLS player
        if (backendIsStreaming && data.stream?.streamUrl) {
          const newStreamUrl = `${import.meta.env.VITE_API_BASE_URL}${data.stream.streamUrl}`;
          setStreamUrl(prevUrl => prevUrl === newStreamUrl ? prevUrl : newStreamUrl);
        } else if (!backendIsStreaming) {
          setStreamUrl(prevUrl => prevUrl === null ? prevUrl : null);
          setSeconds(60);
        }
        
        // Update model name
        if (data.capture?.deploymentName) {
          setModelName(data.capture.deploymentName);
        }
        
        // Update SLM health status
        if (data.capture?.slmHealthy !== undefined) {
          setSlmHealthy(data.capture.slmHealthy);
        }
      }
    } catch (error) {
      console.error('Error fetching stream status:', error);
      // If backend is not reachable, set streaming to false
      setIsStreaming(false);
      setStreamUrl(prevUrl => prevUrl === null ? prevUrl : null);
      setSeconds(60);
    }
  };

  const handleStreamToggle = async () => {
    if (isStreaming) {
      // Stop stream
      try {
        await streamService.stopStream();
        setIsStreaming(false);
        setStreamUrl(null);
        setSeconds(60);
        console.log('Stream stopped');
      } catch (error) {
        console.error('Error stopping stream:', error);
      }
    } else {
      // Start stream
      setLoading(true);
      try {
        console.log('Starting stream with URL:', rtspUrl);
        const response = await streamService.startStream(rtspUrl);
        console.log('Stream response:', response);
        
        if (response.success) {
          // Construct full backend URL for HLS stream using environment variable
          const backendUrl = import.meta.env.VITE_API_BASE_URL;
          const fullStreamUrl = `${backendUrl}${response.stream.streamUrl}`;
          
          console.log('Backend URL:', backendUrl);
          console.log('Stream path:', response.stream.streamUrl);
          console.log('Full stream URL:', fullStreamUrl);
          
          setIsStreaming(true);
          setStreamUrl(fullStreamUrl);
          setSeconds(60);
          fetchAnalyzedFrames();
          console.log('Stream started successfully, HLS URL:', fullStreamUrl);
        } else {
          console.error('Stream start failed:', response);
        }
      } catch (error) {
        console.error('Error starting stream:', error);
        alert('Failed to start stream: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const currentFrame = analyzedFrames[currentFrameIndex];
  
  // Parse analysis data
  const parseAnalysis = (frame) => {
    if (!frame || !frame.analysis) return null;

    try {
      // Try to parse as JSON first
      if (typeof frame.analysis === 'object') {
        return frame.analysis;
      }
      
      // Try to extract JSON from markdown code block
      const jsonMatch = frame.analysis.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Return raw text
      return { raw: frame.analysis };
    } catch (error) {
      return { raw: frame.analysis };
    }
  };

  const analysisData = currentFrame ? parseAnalysis(currentFrame) : null;
  
  // Alert detection: check if current analysis triggers an alert
  useEffect(() => {
    if (!analysisData || !currentFrame || !scenarioConfig?.alerts?.enabled) return;
    if (currentFrame.id === dismissedAlertFrameId) return;
    
    const triggerKeys = scenarioConfig.alerts.triggerKeys || [];
    const triggered = triggerKeys.some(key => (analysisData[key] ?? 0) > 0);
    
    if (triggered && analysisData.alert_message) {
      setAlertMessage({
        frameId: currentFrame.id,
        message: analysisData.alert_message,
        title: scenarioConfig.alerts.title || 'Alert',
        emailNote: scenarioConfig.alerts.emailNote || '',
        timestamp: currentFrame.timestamp,
      });
    }
  }, [currentFrame?.id, analysisData, scenarioConfig, dismissedAlertFrameId]);
  
  const dismissAlert = () => {
    if (alertMessage) {
      setDismissedAlertFrameId(alertMessage.frameId);
    }
    setAlertMessage(null);
  };
  
  // Dynamic metric extraction based on scenario config
  const metrics = scenarioConfig?.metrics || [
    { key: 'persons_near_doors', label: 'Near Doors', icon: 'DoorOpen', color: 'indigo' },
    { key: 'persons_at_reception', label: 'At Reception', icon: 'UserCheck', color: 'amber' },
    { key: 'persons_in_other_areas', label: 'Other Areas', icon: 'Users', color: 'purple' },
  ];
  const totalMetric = scenarioConfig?.totalMetric || { key: 'total_persons', label: 'Total Visible', icon: 'Eye', color: 'emerald' };
  const sceneSections = scenarioConfig?.sceneSections || [
    { key: 'location', emoji: '🏢', title: 'Location & Environment' },
    { key: 'people', emoji: '👥', title: 'People & Activities' },
    { key: 'notable', emoji: '🔍', title: 'Notable Elements' },
    { key: 'overall', emoji: '📊', title: 'Overall Status' },
  ];
  
  const totalCount = analysisData?.[totalMetric.key] ?? 0;

  // Extract catchy title
  const extractCatchyTitle = (analysis) => {
    if (!analysis) return "Awaiting scene analysis...";
    
    // Get the scene description from parsed JSON or raw text
    const parsed = typeof analysis === 'object' ? analysis : { raw: analysis };
    const sceneText = parsed.scene_description || parsed.raw || '';
    
    console.log('Extracting catchy title from:', sceneText.substring(0, 200));
    
    // Decode HTML entities if needed
    const decodedText = sceneText.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
    
    // Extract caption from HTML span
    const captionMatch = decodedText.match(/<span class=["']ai-caption["']>(.*?)<\/span>/);
    if (captionMatch) {
      console.log('Extracted caption:', captionMatch[1]);
      return captionMatch[1];
    }
    // Check if analysis is an error string
    if (typeof analysis === 'string' && (analysis.startsWith('Error') || analysis.includes('unavailable') || analysis.includes('timed out'))) {
      console.log('Analysis error detected:', analysis.substring(0, 100));
      return 'Model recovering — next analysis incoming...';
    }
    const result = "Scene Analysis in Progress";
    console.log('Extracted caption:', result);
    return result;
  };

  const catchyTitle = currentFrame ? extractCatchyTitle(currentFrame.analysis) : "Awaiting scene analysis...";

  // Extract analysis sections dynamically based on scenario config
  const extractSections = (analysis) => {
    if (!analysis) return null;
    
    const parsed = typeof analysis === 'object' ? analysis : { raw: analysis };
    const sceneText = parsed.scene_description || parsed.raw || '';
    
    if (!sceneText) return null;
    
    const decodedText = sceneText.replace(/\\u003c/g, '<').replace(/\\u003e/g, '>').replace(/\\u0026/g, '&').replace(/\\u0027/g, "'");
    
    const result = {};
    for (const section of sceneSections) {
      const regex = new RegExp(`\\*\\*${section.emoji}\\s*${section.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[:\\*]*\\s*[\\r\\n]+(.*?)(?=\\*\\*|$)`, 's');
      const match = decodedText.match(regex);
      if (match) result[section.key] = match[1].trim();
    }
    
    // Fallback: if no config-keyed sections matched (e.g. simplified edge output),
    // extract any **emoji Title:** section and map to the first sceneSections key
    if (Object.keys(result).length === 0) {
      const genericMatch = decodedText.match(/\*\*[^\n*]+\*\*:?\s*[\r\n]+([\s\S]*?)(?=\*\*|$)/);
      if (genericMatch && genericMatch[1].trim()) {
        const firstKey = sceneSections[0]?.key || 'overview';
        result[firstKey] = genericMatch[1].trim();
      } else {
        // Last resort: use everything after the caption as content
        const afterCaption = decodedText.replace(/<span[^>]*>.*?<\/span>/g, '').replace(/\*\*[^*]+\*\*:?/g, '').trim();
        if (afterCaption) {
          const firstKey = sceneSections[0]?.key || 'overview';
          result[firstKey] = afterCaption;
        }
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  };

  const sections = analysisData ? extractSections(analysisData) : null;

  const quickStats = useMemo(
    () => [
      { label: "FPS", value: "30" },
      { label: "Resolution", value: "1280×720" },
      { label: "Model", value: modelMode === 'edge' ? 'Phi-4-multimodal' : modelName },
    ],
    [modelName]
  );

  // Format frames for display (show all available frames, sorted by newest first)
  const formattedFrames = [...analyzedFrames]
    .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp descending (newest first)
    .map(frame => {
    const analysis = parseAnalysis(frame);
    const timestamp = new Date(frame.timestamp).toLocaleTimeString();
    
    // Construct full image URL using backend base URL from environment variable
    const imageUrl = frame.filepath ? `${import.meta.env.VITE_API_BASE_URL}${frame.filepath}` : '';
    
    return {
      id: frame.id,
      timestamp,
      imageUrl: imageUrl,
      tags: modelMode === 'edge'
        ? ['Phi-4-multimodal', ...(analysis?.alert_message ? ['Alert Triggered'] : ['No Alert'])]
        : [
            `${analysis?.[totalMetric.key] ?? 0} people`,
            ...metrics.map(m => `${m.label}: ${analysis?.[m.key] ?? 0}`)
          ],
      summary: extractCatchyTitle(frame.analysis),
      alertMessage: analysis?.alert_message || null
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-r from-indigo-600/20 via-indigo-400/10 to-transparent px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-indigo-300">
              <Eye className="h-5 w-5" />
              <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            </div>
            <div>
              <div className="text-base font-bold tracking-wide text-slate-100">
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Agent Eye</span>
              </div>
              <div className="text-xs text-slate-400">
                Real‑time intelligent stream analysis & monitoring
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Capsule tone={isStreaming ? "green" : "red"}>
              <CircleDot className="h-3 w-3" /> {isStreaming ? "Streaming" : "Stopped"}
            </Capsule>
          </div>
        </div>
      </header>

      {/* Prominent Countdown Timer Banner */}
      {isStreaming && (
        <div className="sticky top-[73px] z-30 border-b border-amber-500/30 bg-gradient-to-r from-amber-600/20 via-amber-500/15 to-transparent backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-6 py-3">
            <div className="flex items-center justify-center gap-4">
              <Clock className="h-8 w-8 text-amber-400 animate-pulse" />
              <div className="text-center">
                <div className="text-xs font-medium text-amber-300/80 uppercase tracking-wider">Next Frame Capture In</div>
                <div className="text-5xl font-bold text-amber-400 tabular-nums tracking-tight leading-none mt-1">
                  {seconds}<span className="text-2xl ml-1 text-amber-300/70">seconds</span>
                </div>
              </div>
              <Clock className="h-8 w-8 text-amber-400 animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-7xl gap-6 p-6 lg:grid-cols-3">
        {/* Left: Live Feed + Controls */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-rose-400" />
                <span>Live Stream Feed</span>
                {isStreaming && <Capsule tone="red">LIVE</Capsule>}
              </div>
            }
            right={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPaused((p) => !p)}
                  disabled={!isStreaming}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                  {paused ? "Play" : "Pause"}
                </button>
                <button
                  onClick={() => setMuted((m) => !m)}
                  disabled={!isStreaming}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                  {muted ? "Muted" : "Sound On"}
                </button>
                <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
                  <Settings className="h-3.5 w-3.5" /> Settings
                </button>
              </div>
            }
          >
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <div className="aspect-video w-full bg-slate-900">
                {streamUrl && isStreaming ? (
                  <video
                    ref={videoRef}
                    id="video-player"
                    className={`h-full w-full object-cover ${paused ? 'opacity-50' : 'opacity-90'}`}
                    controls={false}
                    muted={muted}
                    autoPlay
                    playsInline
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-400">
                    <div className="text-center">
                      <Camera className="mx-auto h-16 w-16 mb-4 opacity-50" />
                      <p>Stream not active</p>
                      <p className="text-xs mt-2">Click "Start Stream" to begin</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent p-3">
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <Capsule tone="indigo">H.264</Capsule>
                  <Capsule tone="slate">1280×720</Capsule>
                  <Capsule tone="slate">30 FPS</Capsule>
                </div>
                <div className="text-[10px] text-white/70">{new Date().toLocaleString()}</div>
              </div>
            </div>

            {/* Catchy AI Title Banner */}
            {currentFrame && (
              <div className="mt-4 rounded-xl bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-yellow-500/20 border border-orange-500/30 p-4">
                <div className="flex items-center gap-2 text-amber-300 mb-2">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">AI Scene Insight</span>
                </div>
                <p className="text-lg font-semibold text-white leading-relaxed">
                  {catchyTitle}
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-amber-400" /> Recent Frame Analysis
              </div>
            }
            right={
              <button
                onClick={() => setExpanded((e) => !e)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" /> Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" /> Expand
                  </>
                )}
              </button>
            }
          >
            <div className={`grid grid-cols-1 gap-4 transition-all md:grid-cols-2 ${expanded ? "opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}>
              {formattedFrames.length > 0 ? formattedFrames.map((f) => (
                <div
                  key={f.id}
                  onClick={() => {
                    const fullFrame = analyzedFrames.find(frame => frame.id === f.id);
                    if (fullFrame) setSelectedFrame(fullFrame);
                  }}
                  className="group flex gap-4 rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <div className="h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-slate-900">
                    <img src={f.imageUrl} alt="frame" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                      <Clock className="h-3.5 w-3.5" /> {f.timestamp}
                    </div>
                    <p className="text-sm leading-snug text-slate-200 line-clamp-2">{f.summary}</p>
                    {f.alertMessage && (
                      <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5">
                        <Bell className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-200/90 line-clamp-2">{f.alertMessage}</p>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {f.tags.map((t, idx) => (
                        <Capsule key={idx} tone="slate">
                          <Dot className="h-3 w-3" /> {t}
                        </Capsule>
                      ))}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 text-center py-8 text-slate-400">
                  <Camera className="mx-auto h-12 w-12 mb-3 opacity-30" />
                  <p>No analyzed frames yet</p>
                  <p className="text-xs mt-1">Frames will appear here after capture</p>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Right: Status & Insights */}
        <div className="space-y-6">
          <SectionCard
            title={
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-400" /> Stream Status
              </div>
            }
            right={
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStreamToggle}
                  disabled={loading}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                    isStreaming
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {loading ? "Loading..." : isStreaming ? "Stop Stream" : "Start Stream"}
                </button>
                <button 
                  onClick={fetchAnalyzedFrames}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-3 gap-3">
              {quickStats.map((s) => (
                <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-3 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">{s.label}</div>
                  <div className="text-lg font-semibold text-slate-50 truncate">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Model Mode Selector */}
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4" /> Inference Engine
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleModelModeSwitch('cloud')}
                  disabled={switchingModel || modelMode === 'cloud'}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs transition-all ${
                    modelMode === 'cloud'
                      ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  } disabled:cursor-not-allowed`}
                >
                  <Cloud className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Cloud LLM</div>
                    <div className="text-[10px] opacity-70">GPT-4o-mini</div>
                  </div>
                </button>
                <button
                  onClick={() => handleModelModeSwitch('edge')}
                  disabled={switchingModel || modelMode === 'edge'}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs transition-all ${
                    modelMode === 'edge'
                      ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  } disabled:cursor-not-allowed`}
                >
                  <Cpu className="h-4 w-4 shrink-0" />
                  <div className="text-left min-w-0">
                    <div className="font-medium truncate">Phi-4-multimodal</div>
                    <div className="text-[10px] opacity-70">Local Model</div>
                  </div>
                </button>
              </div>
              {modelMode === 'edge' && (
                <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                  <div className="text-[10px] text-emerald-300/80 mb-1">SLM Endpoint</div>
                  <div className="text-xs text-emerald-200 font-mono truncate">{slmUrl}</div>
                </div>
              )}
            </div>

            {/* Scenario Selector */}
            {scenarios.length > 1 && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Scenario
                </div>
                <div className="space-y-2">
                  {scenarios.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleScenarioSwitch(s.id)}
                      disabled={switchingScenario || s.active}
                      className={`w-full text-left rounded-xl border p-3 text-xs transition-all ${
                        s.active
                          ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      } disabled:cursor-not-allowed`}
                    >
                      <div className="font-medium">{s.name}</div>
                      <div className="text-[10px] mt-1 opacity-70">{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live People Count */}
            <div className={`mt-4 space-y-3${modelMode === 'edge' ? ' opacity-40 pointer-events-none' : ''}`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300 mb-3 flex items-center gap-2">
                <Users2 className="h-4 w-4" /> Live People Count
                {modelMode === 'edge' && <span className="text-[10px] font-normal text-slate-500 ml-1">(not available in edge mode)</span>}
              </div>
              
              {metrics.map((m) => {
                const IconComp = getIcon(m.icon);
                const colorMap = {
                  indigo: { border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-300' },
                  amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-300' },
                  purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-300' },
                };
                const c = colorMap[m.color] || colorMap.indigo;
                return (
                  <div key={m.key} className={`rounded-xl ${c.border} ${c.bg} p-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-300">
                        <IconComp className="h-4 w-4" />
                        <span className="text-xs">{m.label}</span>
                      </div>
                      <span className={`text-2xl font-bold ${modelMode === 'edge' ? 'text-slate-600' : c.text}`}>{modelMode === 'edge' ? 'N/A' : (analysisData?.[m.key] ?? 0)}</span>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300">
                    {(() => { const TotalIcon = getIcon(totalMetric.icon); return <TotalIcon className="h-4 w-4" />; })()}
                    <span className="text-xs font-semibold">{totalMetric.label}</span>
                  </div>
                  <span className={`text-3xl font-bold ${modelMode === 'edge' ? 'text-slate-600' : 'text-emerald-300'}`}>{modelMode === 'edge' ? 'N/A' : totalCount}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <div className="mb-1 font-medium text-slate-200">Health</div>
              <ul className="list-disc space-y-1 pl-5">
                <li>RTSP connection: {isStreaming ? 'Active' : 'Inactive'}</li>
                <li>Frame capture interval: 60 seconds</li>
                <li>AI analysis: {currentFrame ? 'Running' : 'Standby'}</li>
                {modelMode === 'edge' && <li>Edge model: {slmHealthy === true ? <span className="text-emerald-400">Healthy</span> : slmHealthy === false ? <span className="text-amber-400">Recovering...</span> : 'Unknown'}</li>}
              </ul>
            </div>

            {/* RTSP URL Input */}
            <div className="mt-4">
              <button
                onClick={() => setShowRtspInput(!showRtspInput)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
              >
                <Settings className="h-3.5 w-3.5" />
                {showRtspInput ? 'Hide' : 'Configure'} RTSP URL
              </button>
              
              {showRtspInput && (
                <div className="mt-3 space-y-2">
                  <label className="text-xs font-medium text-slate-300">RTSP Stream URL</label>
                  <input
                    type="text"
                    value={rtspUrl}
                    onChange={(e) => setRtspUrl(e.target.value)}
                    disabled={isStreaming}
                    placeholder="rtsp://username:password@host:port"
                    className="w-full rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-[10px] text-slate-400">
                    Change RTSP URL before starting stream
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          {sections && (
            <SectionCard
              title={
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" /> Detailed Scene Analysis
                </div>
              }
            >
              <div className="space-y-4 text-sm leading-relaxed text-slate-300">
                {sceneSections.map((s) => sections[s.key] ? (
                  <div key={s.key}>
                    <div className="mb-1 font-medium text-slate-200">{s.title}</div>
                    <p className="text-slate-300/90">{sections[s.key]}</p>
                  </div>
                ) : null)}
              </div>
            </SectionCard>
          )}
        </div>
      </main>

      {/* Sticky Insight Bar */}
      <div className="sticky bottom-4 z-30 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200/90">
          <Capsule tone="slate">
            {isStreaming ? "Stream Active" : "Stream Inactive"}
          </Capsule>
          <Capsule tone="slate">{totalCount} visible individuals</Capsule>
          <Capsule tone="slate">
            {analyzedFrames.length} frames analyzed
          </Capsule>
          <Capsule tone="slate">Next capture in {seconds}s</Capsule>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchAnalyzedFrames}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
            <BarChart3 className="h-3.5 w-3.5" /> View Trend
          </button>
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">
            <Settings className="h-3.5 w-3.5" /> Settings
          </button>
        </div>
      </div>

      {/* Alert Popup */}
      {alertMessage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={dismissAlert}
        >
          <div 
            className="relative w-full max-w-lg rounded-2xl border-2 border-amber-500/50 bg-slate-900 shadow-2xl shadow-amber-500/20 animate-[pulse_2s_ease-in-out_1]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Alert Header */}
            <div className="flex items-center gap-3 border-b border-amber-500/30 bg-gradient-to-r from-amber-600/30 via-amber-500/20 to-transparent px-6 py-4 rounded-t-2xl">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/30">
                <Bell className="h-6 w-6 text-amber-300 animate-bounce" />
                <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 animate-ping"></div>
                <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500"></div>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-amber-200">{alertMessage.title}</h2>
                <p className="text-xs text-amber-300/70">
                  {new Date(alertMessage.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={dismissAlert}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Alert Body */}
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed text-slate-200">
                  {alertMessage.message}
                </p>
              </div>

              {alertMessage.emailNote && (
                <div className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
                  <Mail className="h-4 w-4 text-indigo-400 shrink-0" />
                  <p className="text-xs text-indigo-300">{alertMessage.emailNote}</p>
                </div>
              )}
            </div>

            {/* Alert Footer */}
            <div className="border-t border-white/10 px-6 py-4 rounded-b-2xl">
              <button
                onClick={dismissAlert}
                className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition-all hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/30"
              >
                Acknowledge &amp; Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Frame Detail Modal */}
      {selectedFrame && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedFrame(null)}
        >
          <div 
            className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/20 bg-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-900/95 backdrop-blur px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-200">Frame Analysis Details</h2>
                  <p className="text-xs text-slate-400">
                    Captured at {new Date(selectedFrame.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFrame(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Top Section: Image and Counts */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Frame Image */}
                <div className="lg:col-span-2">
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL}${selectedFrame.filepath}`}
                      alt={`Frame ${selectedFrame.id}`}
                      className="w-full h-auto"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Timestamp: {new Date(selectedFrame.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}</span>
                  </div>
                </div>

                {/* People Count Panel */}
                <div className={`space-y-3${modelMode === 'edge' ? ' opacity-40' : ''}`}>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                    <Users2 className="h-4 w-4" /> People Count
                    {modelMode === 'edge' && <span className="text-[10px] font-normal text-slate-500 ml-1">(N/A in edge mode)</span>}
                  </h3>
                  
                  {(() => {
                    const analysis = parseAnalysis(selectedFrame);
                    const colorMap = {
                      indigo: { border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-300' },
                      amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-300' },
                      purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-300' },
                    };
                    return (
                      <>
                        {metrics.map((m) => {
                          const IconComp = getIcon(m.icon);
                          const c = colorMap[m.color] || colorMap.indigo;
                          return (
                            <div key={m.key} className={`rounded-xl ${c.border} ${c.bg} p-4`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-300">
                                  <IconComp className="h-4 w-4" />
                                  <span className="text-sm">{m.label}</span>
                                </div>
                                <span className={`text-3xl font-bold ${modelMode === 'edge' ? 'text-slate-600' : c.text}`}>
                                  {modelMode === 'edge' ? 'N/A' : (analysis?.[m.key] ?? 0)}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        <div className="rounded-xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-200">
                              {(() => { const TotalIcon = getIcon(totalMetric.icon); return <TotalIcon className="h-5 w-5" />; })()}
                              <span className="text-sm font-semibold">{totalMetric.label}</span>
                            </div>
                            <span className={`text-4xl font-bold ${modelMode === 'edge' ? 'text-slate-600' : 'text-emerald-300'}`}>
                              {modelMode === 'edge' ? 'N/A' : (analysis?.[totalMetric.key] ?? 0)}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* AI Scene Insight */}
              {(() => {
                const captionMatch = typeof selectedFrame.analysis === 'string' 
                  ? selectedFrame.analysis.match(/<span class=["']ai-caption["']>(.*?)<\/span>/)
                  : selectedFrame.analysis?.scene_description?.match(/<span class=["']ai-caption["']>(.*?)<\/span>/);
                
                if (captionMatch) {
                  return (
                    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-transparent p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                          <Eye className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-300">
                            AI Scene Insight
                          </h3>
                          <p className="text-base leading-relaxed text-slate-200">
                            {captionMatch[1]}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Alert Message */}
              {(() => {
                const analysis = parseAnalysis(selectedFrame);
                if (analysis?.alert_message) {
                  return (
                    <div className="rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                          <Bell className="h-5 w-5 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-300">
                            {scenarioConfig?.alerts?.title || 'Alert'}
                          </h3>
                          <p className="text-sm leading-relaxed text-slate-200">
                            {analysis.alert_message}
                          </p>
                          {scenarioConfig?.alerts?.emailNote && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
                              <Mail className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                              <p className="text-xs text-indigo-300">{scenarioConfig.alerts.emailNote}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Detailed Scene Analysis */}
              {(() => {
                const frameSections = extractSections(selectedFrame.analysis);
                if (frameSections) {
                  return (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-200 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-indigo-400" /> Detailed Scene Analysis
                      </h3>
                      <div className="space-y-4 text-sm leading-relaxed text-slate-300">
                        {sceneSections.map((s, idx) => frameSections[s.key] ? (
                          <div key={s.key} className={idx < sceneSections.length - 1 ? 'pb-4 border-b border-white/10' : ''}>
                            <div className="mb-2 font-medium text-slate-200">{s.emoji} {s.title}</div>
                            <p className="text-slate-300/90">{frameSections[s.key]}</p>
                          </div>
                        ) : null)}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 border-t border-white/10 bg-slate-900/95 backdrop-blur px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Frame ID: {selectedFrame.id}</span>
                  <span>•</span>
                  <span>Analyzed by {modelMode === 'edge' ? 'Phi-4-multimodal-instruct' : modelName}</span>
                </div>
                <button
                  onClick={() => setSelectedFrame(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
