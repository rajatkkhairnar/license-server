/**
 * jwt.js — JWT Sign & Verify Helpers
 *
 * Used for two purposes:
 *   1. License tokens (30-day TTL) — sent to Electron app after activation
 *   2. Admin session tokens (8-hour TTL) — for the admin portal
 */
const jwt = require('jsonwebtoken');

const SIGNING_SECRET = process.env.SIGNING_SECRET;

if (!SIGNING_SECRET) {
  console.error('FATAL: SIGNING_SECRET environment variable is not set.');
  process.exit(1);
}

/**
 * Signs a license token (30-day TTL).
 * @param {Object} payload - { licenseKey, plan, machineId, expiresAt, numRoles }
 * @returns {string} Signed JWT
 */
function signLicenseToken(payload) {
  return jwt.sign(payload, SIGNING_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30d',
  });
}

/**
 * Verifies a license token.
 * @param {string} token
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
function verifyLicenseToken(token) {
  try {
    return jwt.verify(token, SIGNING_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

/**
 * Signs an admin session token (8-hour TTL).
 * @param {Object} payload - { username, role: 'admin' }
 * @returns {string} Signed JWT
 */
function signAdminToken(payload) {
  return jwt.sign(payload, SIGNING_SECRET, {
    algorithm: 'HS256',
    expiresIn: '8h',
  });
}

/**
 * Verifies an admin session token.
 * @param {string} token
 * @returns {Object|null} Decoded payload or null if invalid/expired
 */
function verifyAdminToken(token) {
  try {
    return jwt.verify(token, SIGNING_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

module.exports = {
  signLicenseToken,
  verifyLicenseToken,
  signAdminToken,
  verifyAdminToken,
  SIGNING_SECRET,
};
