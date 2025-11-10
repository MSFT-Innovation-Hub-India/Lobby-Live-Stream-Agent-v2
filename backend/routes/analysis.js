const express = require('express');
const router = express.Router();
const frameAnalysisService = require('../services/frameAnalysisService');

// Get all analyzed frames
router.get('/frames', (req, res) => {
  try {
    const frames = frameAnalysisService.getAnalyzedFrames();
    res.json({ 
      success: true,
      frames: frames,
      count: frames.length
    });
  } catch (error) {
    console.error('Error getting analyzed frames:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Get a specific analyzed frame
router.get('/frames/:id', (req, res) => {
  try {
    const frames = frameAnalysisService.getAnalyzedFrames();
    const frame = frames.find(f => f.id === parseInt(req.params.id));
    
    if (!frame) {
      return res.status(404).json({ 
        success: false, 
        message: 'Frame not found' 
      });
    }

    res.json({ 
      success: true,
      frame: frame
    });
  } catch (error) {
    console.error('Error getting frame:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

module.exports = router;
