/**
 * apiKeyAuth.js — API Key Authentication Middleware
 *
 * Validates the X-API-Key header on requests from the desktop app.
 * The API key is a shared secret bundled in the Electron app and
 * stored as the API_KEY environment variable on the server.
 */

function apiKeyAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.error('FATAL: API_KEY environment variable is not set.');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
}

module.exports = apiKeyAuth;
