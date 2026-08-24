/**
 * generateKey.js — License Key Generator
 *
 * Generates license keys in the format: MLAB-XXXX-XXXX-XXXX
 * where X = random uppercase alphanumeric character.
 */
const crypto = require('crypto');

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous: 0/O, 1/I

/**
 * Generates a random segment of the given length.
 * @param {number} length
 * @returns {string}
 */
function randomSegment(length) {
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i] % CHARSET.length];
  }
  return result;
}

/**
 * Generates a license key in the format MLAB-XXXX-XXXX-XXXX.
 * @returns {string}
 */
function generateLicenseKey() {
  return `MLAB-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`;
}

module.exports = { generateLicenseKey };
