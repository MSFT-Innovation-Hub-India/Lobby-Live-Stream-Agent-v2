const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/stream', (req, res, next) => {
  // Prevent caching for HLS playlist and segments so the player always gets fresh data
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  // Set correct MIME types for HLS
  if (req.path.endsWith('.m3u8')) {
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
  } else if (req.path.endsWith('.ts')) {
    res.set('Content-Type', 'video/mp2t');
  }
  next();
}, express.static(path.join(__dirname, 'stream')));
app.use('/captures', express.static(path.join(__dirname, 'captures')));

// Import routes
const streamRoutes = require('./routes/stream');
const analysisRoutes = require('./routes/analysis');

// Use routes
app.use('/api/stream', streamRoutes);
app.use('/api/analysis', analysisRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Stream endpoint: http://localhost:${PORT}/api/stream`);
  console.log(`Analysis endpoint: http://localhost:${PORT}/api/analysis`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
