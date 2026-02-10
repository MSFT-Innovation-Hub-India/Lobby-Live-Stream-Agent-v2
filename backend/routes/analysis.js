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

// Get all available scenarios
router.get('/scenarios', (req, res) => {
  try {
    const scenarios = frameAnalysisService.getAvailableScenarios();
    res.json({ success: true, scenarios });
  } catch (error) {
    console.error('Error getting scenarios:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get active scenario config
router.get('/scenarios/active', (req, res) => {
  try {
    const config = frameAnalysisService.getActiveScenarioConfig();
    res.json({ success: true, config, activeScenario: frameAnalysisService.promptProfile });
  } catch (error) {
    console.error('Error getting active scenario:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Switch active scenario
router.post('/scenarios/switch', (req, res) => {
  try {
    const { scenarioId } = req.body;
    if (!scenarioId) {
      return res.status(400).json({ success: false, message: 'scenarioId is required' });
    }
    const result = frameAnalysisService.switchScenario(scenarioId);
    res.json(result);
  } catch (error) {
    console.error('Error switching scenario:', error);
    res.status(500).json({ success: false, message: error.message });
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
