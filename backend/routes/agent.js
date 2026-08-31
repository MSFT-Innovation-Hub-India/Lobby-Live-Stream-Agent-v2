const express = require('express');
const router = express.Router();
const frameAnalysisService = require('../services/frameAnalysisService');

router.post('/chat', async (req, res) => {
  try {
    const { question, history = [] } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    const frames = frameAnalysisService.getAnalyzedFrames();
    const config = frameAnalysisService.getActiveScenarioConfig();
    const intervalSec = frameAnalysisService.captureIntervalMs / 1000;
    const now = Date.now();

    // Sort oldest→newest
    const sortedFrames = [...frames].sort((a, b) => a.timestamp - b.timestamp);

    // Pre-compute analytics so the SLM doesn't have to do math
    const computeStats = (filtered) => {
      const queues = filtered.map(f => f.analysis?.queue_count).filter(v => typeof v === 'number');
      const tokens = filtered.map(f => f.analysis?.token_number).filter(v => v != null && v !== 'N/A');
      const greenAlerts = filtered.filter(f => f.analysis?.alert_severity === 'green').length;
      const redAlerts = filtered.filter(f => f.analysis?.alert_severity === 'red').length;
      const avg = queues.length > 0 ? (queues.reduce((a, b) => a + b, 0) / queues.length).toFixed(1) : 'N/A';
      const max = queues.length > 0 ? Math.max(...queues) : 'N/A';
      const min = queues.length > 0 ? Math.min(...queues) : 'N/A';
      const latest = filtered.length > 0 ? filtered[filtered.length - 1] : null;
      return { count: filtered.length, avg, max, min, greenAlerts, redAlerts, latestToken: latest?.analysis?.token_number ?? 'N/A', latestQueue: latest?.analysis?.queue_count ?? 'N/A', tokens };
    };

    const allStats = computeStats(sortedFrames);
    const last5min = sortedFrames.filter(f => (now - f.timestamp) <= 5 * 60 * 1000);
    const last10min = sortedFrames.filter(f => (now - f.timestamp) <= 10 * 60 * 1000);
    const stats5 = computeStats(last5min);
    const stats10 = computeStats(last10min);

    const fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const nowStr = fmtTime(now);
    const oldest = sortedFrames.length > 0 ? fmtTime(sortedFrames[0].timestamp) : 'N/A';
    const newest = sortedFrames.length > 0 ? fmtTime(sortedFrames[sortedFrames.length - 1].timestamp) : 'N/A';

    const summary = `CURRENT STATUS (as of ${nowStr}):
- Latest token number displayed: ${allStats.latestToken}
- Current people in queue: ${allStats.latestQueue}
- Total observations: ${allStats.count} (from ${oldest} to ${newest})

LAST 5 MINUTES (${stats5.count} observations):
- Average queue length: ${stats5.avg}
- Maximum queue length: ${stats5.max}
- Minimum queue length: ${stats5.min}
- Latest token number: ${stats5.latestToken}
- Green alerts (queue crowding): ${stats5.greenAlerts}
- Red alerts (emergency/person fallen): ${stats5.redAlerts}

LAST 10 MINUTES (${stats10.count} observations):
- Average queue length: ${stats10.avg}
- Maximum queue length: ${stats10.max}
- Minimum queue length: ${stats10.min}
- Latest token number: ${stats10.latestToken}
- Green alerts (queue crowding): ${stats10.greenAlerts}
- Red alerts (emergency/person fallen): ${stats10.redAlerts}

ALL TIME (${allStats.count} observations):
- Average queue length: ${allStats.avg}
- Maximum queue length: ${allStats.max}
- Minimum queue length: ${allStats.min}
- Token numbers seen: ${allStats.tokens.join(', ') || 'none'}
- Green alerts total: ${allStats.greenAlerts}
- Red alerts total: ${allStats.redAlerts}`;

    const systemPrompt = `You are a helpful assistant for a government service center (Aadhar / Digital India). Answer questions about queue activity, token numbers, and alerts using the summary below.

${summary}

Location: ${config?.name || 'Service Center'}

Rules:
- Use the pre-computed numbers above to answer. Do not guess or make up data.
- "Current" or "latest" = the most recent observation.
- Green alert = queue crowding. Red alert = emergency (person fallen).
- Be concise. Use plain, non-technical language.
- If the answer is 0, say so clearly (e.g. "No one is currently in the queue" or "No alerts were raised").`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-10),
      { role: 'user', content: question }
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch(`${frameAnalysisService.slmUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: frameAnalysisService.vllmModel,
          messages,
          max_tokens: 500,
          temperature: 0.3
        })
      });

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content || 'Unable to generate a response.';

      res.json({ success: true, answer, framesAnalyzed: sortedFrames.length });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
      const msg = error.name === 'AbortError' ? 'Request timed out' : error.message;
    console.error('Agent chat error:', msg);
    res.status(500).json({ success: false, error: msg });
  }
});

module.exports = router;
