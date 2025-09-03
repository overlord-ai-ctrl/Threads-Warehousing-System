const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Environment validation
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

// Validate required environment variables
if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required in cloud environment');
}
if (!SUPABASE_SERVICE_KEY) {
  throw new Error('SUPABASE_SERVICE_KEY is required in cloud environment');
}

console.log(`🚀 Threads Ops Cloud starting in ${NODE_ENV} mode at ${APP_URL}`);

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV
  });
});

// Readiness check endpoint
app.get('/readyz', (req, res) => {
  // Placeholder for printer and queue status
  const printers = false; // TODO: implement printer health check
  const queues = {
    depth: 0,
    status: 'healthy'
  };

  res.json({
    ok: printers ? false : true,
    printers: printers,
    queues: queues,
    timestamp: new Date().toISOString()
  });
});

// Basic routes
app.get('/', (req, res) => {
  res.json({
    name: 'Threads Ops Cloud',
    version: process.env.npm_package_version || '1.0.0',
    status: 'running',
    environment: env.NODE_ENV
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Cloud server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Threads Ops Cloud running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/healthz`);
  console.log(`🔗 Ready: http://localhost:${PORT}/readyz`);
});

module.exports = app;
