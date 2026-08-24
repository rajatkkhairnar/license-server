/**
 * licenseService.js — Core License Operations
 *
 * Handles:
 *   - activate: Bind a license to a machine (with trial abuse check)
 *   - validate: Check if a license is still active
 *   - deactivate: Revoke a machine activation (free up a slot)
 *   - generateKey: Create a new license (vendor-generated, from admin portal)
 */
const { PrismaClient } = require('@prisma/client');
const { signLicenseToken } = require('../utils/jwt');
const { generateLicenseKey } = require('../utils/generateKey');

const prisma = new PrismaClient();

/**
 * Activate a license on a specific machine.
 *
 * Checks:
 *   1. Key exists and is active
 *   2. Not expired
 *   3. Activation slots available
 *   4. Machine not already activated on this license
 *   5. (Trial only) Machine hasn't used ANY trial before
 *
 * @param {Object} data - { licenseKey, machineId, machineLabel? }
 * @returns {Object} { success, token, plan, expiresAt, numRoles } or { success: false, error }
 */
async function activateLicense({ licenseKey, machineId, machineLabel }) {
  if (!licenseKey || !machineId) {
    return { success: false, error: 'License key and machine ID are required.' };
  }

  // --- Find the license ---
  const license = await prisma.license.findUnique({
    where: { key: licenseKey.toUpperCase() },
    include: { activations: true },
  });

  if (!license) {
    return { success: false, error: 'License key not found.', reason: 'not_found' };
  }

  if (license.status === 'suspended') {
    return { success: false, error: 'This license has been suspended. Contact support.', reason: 'license_suspended' };
  }

  if (license.status === 'expired') {
    return { success: false, error: 'This license has expired.', reason: 'license_expired' };
  }

  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    // Auto-expire if past date
    await prisma.license.update({ where: { id: license.id }, data: { status: 'expired' } });
    return { success: false, error: 'This license has expired.', reason: 'license_expired' };
  }

  // --- Check if machine is already activated on THIS license ---
  const existingActivation = license.activations.find(
    (a) => a.machineId === machineId && !a.isRevoked
  );
  if (existingActivation) {
    // Re-issue token (re-activation on same machine is allowed)
    await prisma.activation.update({
      where: { id: existingActivation.id },
      data: { lastSeenAt: new Date() },
    });

    const token = signLicenseToken({
      licenseKey: license.key,
      plan: license.plan,
      machineId,
      expiresAt: license.expiresAt?.toISOString() || null,
      numRoles: license.numRoles,
    });

    return {
      success: true,
      token,
      plan: license.plan,
      expiresAt: license.expiresAt?.toISOString() || null,
      numRoles: license.numRoles,
    };
  }

  // --- Check activation limit ---
  const activeCount = license.activations.filter((a) => !a.isRevoked).length;
  if (activeCount >= license.maxActivations) {
    return {
      success: false,
      error: `Maximum activations reached (${license.maxActivations}). Deactivate another machine first or contact support.`,
      reason: 'max_activations',
    };
  }

  // --- Trial abuse check: has this machine used ANY trial before? ---
  if (license.isTrial) {
    const previousTrialActivation = await prisma.activation.findFirst({
      where: {
        machineId,
        isRevoked: false,
        license: { isTrial: true },
      },
    });

    if (previousTrialActivation) {
      return {
        success: false,
        error: 'This device has already used a trial license. Please purchase a full license.',
        reason: 'trial_abuse',
      };
    }
  }

  // --- Create activation ---
  await prisma.$transaction([
    prisma.activation.create({
      data: {
        licenseId: license.id,
        machineId,
        machineLabel: machineLabel || null,
      },
    }),
    prisma.license.update({
      where: { id: license.id },
      data: { activationCount: { increment: 1 } },
    }),
  ]);

  // --- Sign & return JWT ---
  const token = signLicenseToken({
    licenseKey: license.key,
    plan: license.plan,
    machineId,
    expiresAt: license.expiresAt?.toISOString() || null,
    numRoles: license.numRoles,
  });

  return {
    success: true,
    token,
    plan: license.plan,
    expiresAt: license.expiresAt?.toISOString() || null,
    numRoles: license.numRoles,
  };
}

/**
 * Validate a license for a specific machine.
 * Called periodically by the desktop app to refresh status.
 *
 * @param {Object} data - { licenseKey, machineId }
 * @returns {Object} { valid, plan, expiresAt } or { valid: false, reason }
 */
async function validateLicense({ licenseKey, machineId }) {
  if (!licenseKey || !machineId) {
    return { valid: false, reason: 'missing_params' };
  }

  const license = await prisma.license.findUnique({
    where: { key: licenseKey.toUpperCase() },
    include: {
      activations: {
        where: { machineId, isRevoked: false },
      },
    },
  });

  if (!license) {
    return { valid: false, reason: 'not_found' };
  }

  if (license.status === 'suspended') {
    return { valid: false, reason: 'license_suspended' };
  }

  // Check if activation exists for this machine
  const activation = license.activations[0];
  if (!activation) {
    return { valid: false, reason: 'activation_revoked' };
  }

  // Check expiry
  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    // Don't auto-update status here — let admin portal handle it
    // But tell the client it's expired
    return { valid: false, reason: 'license_expired' };
  }

  // --- Update lastSeenAt ---
  await prisma.activation.update({
    where: { id: activation.id },
    data: { lastSeenAt: new Date() },
  });

  // --- Re-issue fresh token ---
  const token = signLicenseToken({
    licenseKey: license.key,
    plan: license.plan,
    machineId,
    expiresAt: license.expiresAt?.toISOString() || null,
    numRoles: license.numRoles,
  });

  return {
    valid: true,
    plan: license.plan,
    expiresAt: license.expiresAt?.toISOString() || null,
    numRoles: license.numRoles,
    token, // Fresh token for the client to store
  };
}

/**
 * Deactivate a license from a specific machine.
 * Frees up an activation slot so the key can be used elsewhere.
 *
 * @param {Object} data - { licenseKey, machineId }
 * @returns {Object} { success } or { success: false, error }
 */
async function deactivateLicense({ licenseKey, machineId }) {
  if (!licenseKey || !machineId) {
    return { success: false, error: 'License key and machine ID are required.' };
  }

  const license = await prisma.license.findUnique({
    where: { key: licenseKey.toUpperCase() },
  });

  if (!license) {
    return { success: false, error: 'License key not found.' };
  }

  // Find the activation
  const activation = await prisma.activation.findFirst({
    where: {
      licenseId: license.id,
      machineId,
      isRevoked: false,
    },
  });

  if (!activation) {
    return { success: false, error: 'No active activation found for this machine.' };
  }

  // Revoke and decrement
  await prisma.$transaction([
    prisma.activation.update({
      where: { id: activation.id },
      data: { isRevoked: true },
    }),
    prisma.license.update({
      where: { id: license.id },
      data: { activationCount: { decrement: 1 } },
    }),
  ]);

  return { success: true };
}

/**
 * Generate a new license key (vendor-created from admin portal).
 *
 * @param {Object} data - { plan, customerName?, customerEmail?, maxActivations, numRoles, expiresAt?, notes? }
 * @returns {Object} { success, license }
 */
async function generateNewLicense(data) {
  const {
    plan = 'offline',
    customerName,
    customerEmail,
    maxActivations = 1,
    numRoles = 2,
    durationDays,
    expiresAt,
    notes,
  } = data;

  // Calculate expiry: prefer explicit expiresAt, else compute from durationDays
  let computedExpiry = null;
  if (expiresAt) {
    computedExpiry = new Date(expiresAt);
  } else if (durationDays) {
    computedExpiry = new Date();
    computedExpiry.setDate(computedExpiry.getDate() + parseInt(durationDays, 10));
  }

  const key = generateLicenseKey();

  const license = await prisma.license.create({
    data: {
      key,
      plan,
      status: 'active',
      isTrial: plan === 'trial',
      maxActivations: parseInt(maxActivations, 10) || 1,
      numRoles: parseInt(numRoles, 10) || 2,
      customerName: customerName || null,
      customerEmail: customerEmail || null,
      expiresAt: computedExpiry,
      notes: notes || null,
    },
  });

  return { success: true, licenseKey: license.key, license };
}

module.exports = {
  activateLicense,
  validateLicense,
  deactivateLicense,
  generateNewLicense,
};
