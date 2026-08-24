/**
 * rateLimiter.js — Rate Limiting Configurations
 *
 * Defines rate limiters for different route groups:
 *   - signupLimiter: 3 requests/hour per IP (prevents trial spam)
 *   - publicApiLimiter: 10 requests/minute per IP (desktop app calls)
 *   - adminLimiter: 60 requests/minute per IP (admin portal)
 */
const rateLimit = require('express-rate-limit');

/** Sign-up: max 3 attempts per IP per hour */
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many sign-up attempts from this IP. Please try again in an hour.',
  },
});

/** Public API (activate/validate/deactivate): 10 requests/min per IP */
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please wait a moment.',
  },
});

/** Admin portal: 60 requests/min per IP */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many admin requests. Please slow down.',
  },
});

module.exports = { signupLimiter, publicApiLimiter, adminLimiter };
