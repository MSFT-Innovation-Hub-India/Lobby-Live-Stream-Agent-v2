const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class StreamService {
  constructor() {
    this.ffmpegProcess = null;
    this.streamDir = path.join(__dirname, '..', 'stream');
    this.isStreaming = false;
    this.rtspUrl = null;
    this.autoRestart = true;
    this.restartDelay = 5000; // 5 seconds delay before restart
    this.restartAttempts = 0;
    this.maxRestartAttempts = 10;
    this.hadError = false; // Track if errors occurred during streaming
    this.manualStop = false; // Track if stop was manual
  }

  // Start FFmpeg to convert RTSP to HLS
  startStream(rtspUrl) {
    if (this.isStreaming && this.ffmpegProcess) {
      console.log('Stream is already running');
      return { success: true, message: 'Stream is already running' };
    }

    // Store RTSP URL for potential restarts
    this.rtspUrl = rtspUrl;
    this.autoRestart = true;
    this.restartAttempts = 0;
    this.manualStop = false;

    return this._initializeStream();
  }

  // Internal method to initialize/restart stream
  _initializeStream() {
    // Ensure stream directory exists
    if (!fs.existsSync(this.streamDir)) {
      fs.mkdirSync(this.streamDir, { recursive: true });
    }

    const hlsPath = path.join(this.streamDir, 'stream.m3u8');

    // FFmpeg command to convert RTSP to HLS
    // -rtsp_transport tcp: Use TCP for RTSP (more reliable)
    // -i: Input RTSP URL
    // -c:v libx264: Encode to H.264 for browser compatibility
    // -preset ultrafast: Fast encoding
    // -tune zerolatency: Minimize latency
    // -c:a aac: Convert audio to AAC
    // -f hls: Output format HLS
    // -hls_time 2: Each segment is 2 seconds
    // -hls_list_size 10: Keep 10 segments in playlist
    // -hls_flags delete_segments+append_list: Delete old segments and append to list
    // -hls_playlist_type event: Live event playlist
    console.log(`Starting FFmpeg stream (attempt ${this.restartAttempts + 1})...`);
    
    // Reset error flag for this attempt
    this.hadError = false;
    
    this.ffmpegProcess = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-i', this.rtspUrl,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-g', '30',
      '-keyint_min', '30',
      '-sc_threshold', '0',
      '-force_key_frames', 'expr:gte(t,n_forced*0.5)', // enforce keyframes at 0.5s boundaries for segmenting
      '-max_delay', '0',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'hls',
      // Short 0.5s segments with a slightly deeper playlist to avoid starvation
      '-hls_time', '0.5',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+append_list+omit_endlist',
      '-hls_allow_cache', '0',
      '-hls_segment_filename', path.join(this.streamDir, 'segment%d.ts'),
      hlsPath
    ]);

    this.ffmpegProcess.stderr.on('data', (data) => {
      // FFmpeg outputs to stderr, we'll keep it minimal
      const output = data.toString();
      
      // Check for errors
      if (output.includes('Error') || output.includes('error')) {
        console.log(`FFmpeg: ${output.substring(0, 200)}`);
        this.hadError = true; // Mark that an error occurred
      }
      
      // Log connection-related messages
      if (output.includes('Connection') || output.includes('connection')) {
        console.log(`FFmpeg: ${output.substring(0, 200)}`);
      }
    });

    this.ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      this.isStreaming = false;
      
      // Determine if we should restart:
      // - Not a manual stop
      // - Auto-restart is enabled
      // - Either non-zero exit code OR had errors during streaming
      const shouldRestart = !this.manualStop && this.autoRestart && (code !== 0 || this.hadError);
      
      if (shouldRestart) {
        if (this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          const reason = code !== 0 ? `exit code ${code}` : 'streaming errors detected';
          console.log(`Stream disconnected (${reason}). Attempting restart in ${this.restartDelay/1000} seconds... (${this.restartAttempts}/${this.maxRestartAttempts})`);
          
          setTimeout(() => {
            if (this.autoRestart && !this.manualStop) {
              console.log('Restarting stream...');
              this._initializeStream();
            }
          }, this.restartDelay);
        } else {
          console.error(`Maximum restart attempts (${this.maxRestartAttempts}) reached. Please check the RTSP connection and restart manually.`);
          this.autoRestart = false;
        }
      } else if (this.manualStop) {
        console.log('Stream stopped manually');
      } else {
        console.log('Stream ended normally (no errors detected)');
      }
    });

    this.ffmpegProcess.on('error', (error) => {
      console.error(`FFmpeg error: ${error.message}`);
      this.isStreaming = false;
      
      // Attempt restart on spawn error
      if (this.autoRestart && this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts++;
        console.log(`Attempting restart after error in ${this.restartDelay/1000} seconds...`);
        
        setTimeout(() => {
          if (this.autoRestart) {
            this._initializeStream();
          }
        }, this.restartDelay);
      }
    });

    this.isStreaming = true;
    console.log('Stream started successfully');

    return { 
      success: true, 
      message: 'Stream started successfully',
      streamUrl: '/stream/stream.m3u8'
    };
  }

  // Stop the stream
  stopStream() {
    // Mark as manual stop to prevent auto-restart
    this.manualStop = true;
    this.autoRestart = false;
    
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
      this.isStreaming = false;
      this.restartAttempts = 0;
      this.hadError = false;
      console.log('Stream stopped manually');
      return { success: true, message: 'Stream stopped' };
    }
    return { success: false, message: 'No stream is running' };
  }

  // Get stream status
  getStatus() {
    return {
      isStreaming: this.isStreaming,
      streamUrl: this.isStreaming ? '/stream/stream.m3u8' : null,
      autoRestart: this.autoRestart,
      restartAttempts: this.restartAttempts,
      rtspUrl: this.rtspUrl,
      hadError: this.hadError,
      manualStop: this.manualStop
    };
  }
}

module.exports = new StreamService();
