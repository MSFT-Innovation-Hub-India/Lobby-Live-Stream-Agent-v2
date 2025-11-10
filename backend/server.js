const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/stream', express.static(path.join(__dirname, 'stream')));
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

app.listen(PORT, () => {
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
