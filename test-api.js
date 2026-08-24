/**
 * test-api.js — Quick API Test Script
 * 
 * Run: node test-api.js
 * 
 * Tests all license server endpoints in sequence.
 * Uses Node.js fetch (no curl needed).
 */
require('dotenv').config();

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const API_KEY = process.env.API_KEY;
let ADMIN_TOKEN = '';
let TEST_LICENSE_KEY = '';

async function api(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

function log(label, passed, detail = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`  ${icon} ${label}${detail ? ' — ' + detail : ''}`);
  if (!passed) process.exitCode = 1;
}

async function run() {
  console.log('\n═══════════════════════════════════════════');
  console.log('  MicroLab Pro — License Server API Tests');
  console.log('═══════════════════════════════════════════\n');

  // ─── 1. Admin Login ──────────────────────────────
  console.log('1. Admin Login');
  const login = await api('POST', '/admin/login', {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  });
  log('Login succeeds', login.status === 200 && login.data.success, `Status: ${login.status}`);
  ADMIN_TOKEN = login.data.token || '';

  const adminHeaders = { Authorization: `Bearer ${ADMIN_TOKEN}` };

  // ─── 2. Health Check ─────────────────────────────
  console.log('\n2. Health Check');
  const health = await api('GET', '/admin/health', null, adminHeaders);
  log('Server healthy', health.data.status === 'healthy', `Uptime: ${Math.round(health.data.uptime)}s`);

  // ─── 3. Dashboard Stats ──────────────────────────
  console.log('\n3. Dashboard Stats');
  const stats = await api('GET', '/admin/dashboard-stats', null, adminHeaders);
  log('Stats loaded', stats.status === 200, `Licenses: ${stats.data.totalLicenses}, Customers: ${stats.data.totalCustomers}`);

  // ─── 4. Create License ───────────────────────────
  console.log('\n4. Create License (via Admin API)');
  const create = await api('POST', '/admin/licenses', {
    customerName: 'API Test Lab',
    customerEmail: 'apitest@example.com',
    plan: 'trial',
    durationDays: 14,
    maxActivations: 1,
    numRoles: 2,
  }, adminHeaders);
  log('License created', create.status === 201 && create.data.success, `Key: ${create.data.licenseKey || 'N/A'}`);
  TEST_LICENSE_KEY = create.data.licenseKey || '';

  // ─── 5. List Licenses ────────────────────────────
  console.log('\n5. List Licenses');
  const list = await api('GET', '/admin/licenses', null, adminHeaders);
  log('Licenses listed', list.status === 200 && list.data.total > 0, `Total: ${list.data.total}`);

  // ─── 6. License Activation ───────────────────────
  console.log('\n6. License Activation');
  const activate = await api('POST', '/api/license/activate', {
    licenseKey: TEST_LICENSE_KEY,
    machineId: 'test-machine-script-001',
    machineLabel: 'Test Script PC',
  }, { 'X-API-Key': API_KEY });
  log('Activation succeeds', activate.status === 200 && activate.data.success, `Plan: ${activate.data.plan}`);

  // ─── 7. License Validation ───────────────────────
  console.log('\n7. License Validation');
  const validate = await api('POST', '/api/license/validate', {
    licenseKey: TEST_LICENSE_KEY,
    machineId: 'test-machine-script-001',
  }, { 'X-API-Key': API_KEY });
  log('Validation succeeds', validate.status === 200 && validate.data.valid, `Valid: ${validate.data.valid}`);

  // ─── 8. Second Activation (should fail) ──────────
  console.log('\n8. Second Activation (should fail — max 1)');
  const activate2 = await api('POST', '/api/license/activate', {
    licenseKey: TEST_LICENSE_KEY,
    machineId: 'different-machine-999',
    machineLabel: 'Other PC',
  }, { 'X-API-Key': API_KEY });
  log('Blocked correctly', activate2.status === 400, `Error: ${activate2.data.error || 'N/A'}`);

  // ─── 9. Missing API Key (should fail) ────────────
  console.log('\n9. Missing API Key (should fail)');
  const noKey = await api('POST', '/api/license/activate', {
    licenseKey: TEST_LICENSE_KEY,
    machineId: 'test',
  });
  log('Blocked without API key', noKey.status === 401 || noKey.status === 403, `Status: ${noKey.status}`);

  // ─── 10. Deactivation ────────────────────────────
  console.log('\n10. License Deactivation');
  const deactivate = await api('POST', '/api/license/deactivate', {
    licenseKey: TEST_LICENSE_KEY,
    machineId: 'test-machine-script-001',
  }, { 'X-API-Key': API_KEY });
  log('Deactivation succeeds', deactivate.status === 200 && deactivate.data.success);

  // ─── 11. Delete Test License (cleanup) ────────────
  console.log('\n11. Delete Test License (cleanup)');
  const listAgain = await api('GET', `/admin/licenses?search=apitest@example.com`, null, adminHeaders);
  const testLicense = listAgain.data.licenses?.find(l => l.key === TEST_LICENSE_KEY);
  if (testLicense) {
    // First revoke all activations (required before delete)
    const detail = await api('GET', `/admin/licenses/${testLicense.id}`, null, adminHeaders);
    if (detail.data.activations?.length) {
      for (const act of detail.data.activations) {
        if (!act.isRevoked) {
          await api('PATCH', `/admin/activations/${act.id}/revoke`, {}, adminHeaders);
        }
      }
    }
    // Now delete (activations are cascade-deleted in Prisma)
    const del = await api('DELETE', `/admin/licenses/${testLicense.id}`, null, adminHeaders);
    log('Deleted test license', del.status === 200 && del.data.success);
  } else {
    log('Skipped (not found)', true);
  }

  // ─── Summary ─────────────────────────────────────
  console.log('\n═══════════════════════════════════════════');
  console.log(`  All tests completed. ${process.exitCode ? '❌ Some tests failed!' : '✅ All passed!'}`);
  console.log('═══════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\n❌ Script crashed:', err.message);
  process.exit(1);
});
