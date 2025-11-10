const express = require('express');
const router = express.Router();
const streamService = require('../services/streamService');
const frameAnalysisService = require('../services/frameAnalysisService');

// Start streaming
router.post('/start', (req, res) => {
  try {
    const { rtspUrl } = req.body;
    
    if (!rtspUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'RTSP URL is required' 
      });
    }

    // Start the stream
    const streamResult = streamService.startStream(rtspUrl);
    
    // Start frame capture and analysis
    const captureResult = frameAnalysisService.startCapture(rtspUrl);

    res.json({ 
      success: true,
      message: 'Stream and frame capture started',
      stream: streamResult,
      capture: captureResult
    });
  } catch (error) {
    console.error('Error starting stream:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Stop streaming
router.post('/stop', (req, res) => {
  try {
    const streamResult = streamService.stopStream();
    const captureResult = frameAnalysisService.stopCapture();

    res.json({ 
      success: true,
      message: 'Stream and frame capture stopped',
      stream: streamResult,
      capture: captureResult
    });
  } catch (error) {
    console.error('Error stopping stream:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get stream status
router.get('/status', (req, res) => {
  try {
    const streamStatus = streamService.getStatus();
    const captureStatus = frameAnalysisService.getStatus();

    res.json({ 
      success: true,
      stream: streamStatus,
      capture: captureStatus
    });
  } catch (error) {
    console.error('Error getting stream status:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
