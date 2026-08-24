/**
 * publicRoutes.js — Public API Routes
 *
 * These routes are accessible without admin authentication.
 *
 * Sign-up routes (no auth):
 *   POST /api/signup/request-otp  — Send OTP email
 *   POST /api/signup/verify-otp   — Verify OTP + create account
 *
 * License routes (X-API-Key required):
 *   POST /api/license/activate    — Activate license on a machine
 *   POST /api/license/validate    — Validate license is still active
 *   POST /api/license/deactivate  — Deactivate from a machine
 */
const express = require('express');
const router = express.Router();

const apiKeyAuth = require('../middleware/apiKeyAuth');
const { signupLimiter, publicApiLimiter } = require('../middleware/rateLimiter');
const { requestOtp, verifyOtp } = require('../services/signupService');
const { activateLicense, validateLicense, deactivateLicense } = require('../services/licenseService');

// ─── Sign-Up Routes ─────────────────────────────────────────────────

/**
 * POST /api/signup/request-otp
 * Step 1: Validate form data + send OTP email.
 */
router.post('/signup/request-otp', signupLimiter, async (req, res) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = await requestOtp(req.body, clientIp);

    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Error in request-otp:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/signup/verify-otp
 * Step 2: Verify OTP + create Customer + generate trial License.
 */
router.post('/signup/verify-otp', signupLimiter, async (req, res) => {
  try {
    const result = await verifyOtp(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(201).json(result);
  } catch (err) {
    console.error('Error in verify-otp:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ─── License Routes (X-API-Key required) ────────────────────────────

/**
 * POST /api/license/activate
 * Activate a license on a specific machine. Returns a signed JWT token.
 */
router.post('/license/activate', publicApiLimiter, apiKeyAuth, async (req, res) => {
  try {
    const result = await activateLicense(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Error in activate:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

/**
 * POST /api/license/validate
 * Validate a license and get a fresh token.
 */
router.post('/license/validate', publicApiLimiter, apiKeyAuth, async (req, res) => {
  try {
    const result = await validateLicense(req.body);

    if (!result.valid) {
      return res.status(403).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Error in validate:', err);
    return res.status(500).json({ valid: false, reason: 'server_error' });
  }
});

/**
 * POST /api/license/deactivate
 * Deactivate a license from a specific machine (free up slot).
 */
router.post('/license/deactivate', publicApiLimiter, apiKeyAuth, async (req, res) => {
  try {
    const result = await deactivateLicense(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('Error in deactivate:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

module.exports = router;
