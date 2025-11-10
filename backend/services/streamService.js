const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class StreamService {
  constructor() {
    this.ffmpegProcess = null;
    this.streamDir = path.join(__dirname, '..', 'stream');
    this.isStreaming = false;
  }

  // Start FFmpeg to convert RTSP to HLS
  startStream(rtspUrl) {
    if (this.isStreaming) {
      console.log('Stream is already running');
      return { success: true, message: 'Stream is already running' };
    }

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
    this.ffmpegProcess = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '10',
      '-hls_flags', 'delete_segments+append_list',
      '-hls_allow_cache', '0',
      '-hls_segment_filename', path.join(this.streamDir, 'segment%d.ts'),
      hlsPath
    ]);

    this.ffmpegProcess.stderr.on('data', (data) => {
      // FFmpeg outputs to stderr, we'll keep it minimal
      console.log(`FFmpeg: ${data.toString().substring(0, 100)}`);
    });

    this.ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process exited with code ${code}`);
      this.isStreaming = false;
    });

    this.ffmpegProcess.on('error', (error) => {
      console.error(`FFmpeg error: ${error.message}`);
      this.isStreaming = false;
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
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
      this.isStreaming = false;
      return { success: true, message: 'Stream stopped' };
    }
    return { success: false, message: 'No stream is running' };
  }

  // Get stream status
  getStatus() {
    return {
      isStreaming: this.isStreaming,
      streamUrl: this.isStreaming ? '/stream/stream.m3u8' : null
    };
  }
}

module.exports = new StreamService();
