/**
 * server.js — License Server Entry Point
 *
 * Express server for the MicroLab Pro licensing system.
 * Handles:
 *   - Public API: customer sign-up (OTP) + license activation/validation
 *   - Admin API: license management portal backend
 *   - Static files: serves the built React portal SPA
 *
 * Environment variables required:
 *   DATABASE_URL, SIGNING_SECRET, API_KEY, ADMIN_USERNAME, ADMIN_PASSWORD
 *   Optional: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, PORT
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const publicRoutes = require('./src/routes/publicRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ──────────────────────────────────────────────────────

// Trust proxy (Railway / reverse proxy) for accurate rate limiting
app.set('trust proxy', 1);

// CORS — allow all origins in dev, restrict in production if needed
app.use(cors());

// Parse JSON bodies (limit 1MB for logo/image data)
app.use(express.json({ limit: '1mb' }));

// Request logging (minimal)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // Only log API and admin routes (skip static files)
    if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
      console.log(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ─── API Routes ─────────────────────────────────────────────────────

// Public API (sign-up + license operations)
app.use('/api', publicRoutes);

// Admin portal API
app.use('/admin', adminRoutes);

// ─── Static Files (Portal SPA) ─────────────────────────────────────

// Serve the built React portal (after running `npm run build:portal`)
const portalBuildPath = path.join(__dirname, 'portal', 'dist');
app.use(express.static(portalBuildPath));

// SPA fallback — serve index.html for any non-API route
// This handles client-side routing for both /signup and /portal/*
app.get('*', (req, res) => {
  // Don't serve index.html for API routes that don't exist
  if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(portalBuildPath, 'index.html'));
});

// ─── Error Handler ──────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start Server ───────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  🔬 MicroLab Pro License Server`);
    console.log(`  📡 Running on port ${PORT}`);
    console.log(`  🕐 Started at ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
  });
}

// Export for Vercel Serverless
module.exports = app;
