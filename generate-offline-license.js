/**
 * generate-offline-license.js — Generate a license.json for offline use
 * 
 * Use this when the license server is not deployed yet but you need to
 * give a customer a working trial key.
 * 
 * Usage:
 *   node generate-offline-license.js
 *   node generate-offline-license.js --days 30
 *   node generate-offline-license.js --days 14 --plan trial --roles 2
 * 
 * This creates a license.json file that the customer places in:
 *   - Dev mode: MicroLab-Pro/ (project root)
 *   - Production: %APPDATA%/microlab-pro/ (or wherever userData is)
 * 
 * The app will work offline for the full duration without needing
 * the license server to be running.
 */
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Configuration ──────────────────────────────────────────────────
// This MUST match the SIGNING_SECRET in your .env and license.cjs
const SIGNING_SECRET = process.env.LICENSE_SIGNING_SECRET 
  || 'YgNdpRUdTaL85bjXCcP4G7RjoE65xr3oUZ3j7WFriA61mPs2B9Hfy3LmioVIbs9W';

// ─── Parse CLI Arguments ────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, defaultVal) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
}

const durationDays = parseInt(getArg('days', '14'), 10);
const plan = getArg('plan', 'trial');
const numRoles = parseInt(getArg('roles', '2'), 10);
const customerName = getArg('name', 'Offline Customer');
const outputDir = getArg('output', '.');

// ─── Generate License ───────────────────────────────────────────────

// Generate a random license key
function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  const segment = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join('');
  return `MLAB-${segment()}-${segment()}-${segment()}`;
}

const licenseKey = generateKey();
const now = new Date();
const expiresAt = new Date(now);
expiresAt.setDate(expiresAt.getDate() + durationDays);

// Sign a JWT (same as the server would)
const token = jwt.sign(
  {
    licenseKey,
    plan,
    machineId: 'offline-any-machine', // Won't be checked locally
    expiresAt: expiresAt.toISOString(),
    numRoles,
  },
  SIGNING_SECRET,
  {
    algorithm: 'HS256',
    expiresIn: '90d', // Long JWT expiry for offline use
  }
);

// Build the license.json content (same format as license.cjs writes)
const licenseData = {
  licenseKey,
  token,
  plan,
  numRoles,
  expiresAt: expiresAt.toISOString(),
  tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  lastValidatedAt: now.toISOString(),
};

// ─── Write File ─────────────────────────────────────────────────────

const outputPath = path.join(outputDir, 'license.json');
fs.writeFileSync(outputPath, JSON.stringify(licenseData, null, 2), 'utf-8');

// ─── Output ─────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════');
console.log('  🔑 Offline License Generated Successfully');
console.log('═══════════════════════════════════════════════════════\n');
console.log(`  Key:        ${licenseKey}`);
console.log(`  Plan:       ${plan}`);
console.log(`  Roles:      ${numRoles}`);
console.log(`  Expires:    ${expiresAt.toLocaleDateString()} (${durationDays} days)`);
console.log(`  Customer:   ${customerName}`);
console.log(`  Output:     ${path.resolve(outputPath)}`);
console.log('\n───────────────────────────────────────────────────────');
console.log('  📋 Instructions for the customer:');
console.log('  1. Close MicroLab Pro if it\'s running');
console.log('  2. Copy license.json to: %APPDATA%\\microlab-pro\\');
console.log('  3. Reopen MicroLab Pro — it will start normally');
console.log('───────────────────────────────────────────────────────\n');
