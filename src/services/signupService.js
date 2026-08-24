/**
 * signupService.js — Customer Sign-Up Service
 *
 * Handles the 2-step sign-up flow:
 *   Step 1: requestOtp — Validates fields, sends OTP email, stores pending registration
 *   Step 2: verifyOtp  — Verifies OTP, creates Customer + trial License
 *
 * Anti-abuse measures:
 *   - Email uniqueness (DB constraint)
 *   - OTP verification (must prove email ownership)
 *   - IP tracking (stored on Customer for admin visibility)
 *   - Machine ID blocking (checked at activation time, not here)
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { generateOtp, sendOtpEmail } = require('../utils/email');
const { generateLicenseKey } = require('../utils/generateKey');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;
const OTP_TTL_MINUTES = 10;
const TRIAL_DAYS = 14;

/**
 * Step 1: Request OTP
 * Validates input, checks for duplicate email, sends OTP, stores pending data.
 *
 * @param {Object} data - { labName, ownerName, email, phone, password, numRoles }
 * @param {string} clientIp - IP address of the requester
 * @returns {Object} { success, message } or { success: false, error }
 */
async function requestOtp(data, clientIp) {
  const { labName, ownerName, email, phone, password, numRoles } = data;

  // --- Validation ---
  if (!labName || !ownerName || !email || !phone || !password) {
    return { success: false, error: 'All fields are required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Invalid email address.' };
  }

  if (!/^\d{10}$/.test(phone)) {
    return { success: false, error: 'Phone number must be exactly 10 digits.' };
  }

  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters.' };
  }

  const roleCount = parseInt(numRoles, 10);
  if (isNaN(roleCount) || roleCount < 2 || roleCount > 3) {
    return { success: false, error: 'Number of roles must be 2 or 3.' };
  }

  // --- Check for duplicate email ---
  const existingCustomer = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
  if (existingCustomer) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  // --- Invalidate previous unused OTPs for this email ---
  await prisma.otpToken.updateMany({
    where: { email: email.toLowerCase(), used: false },
    data: { used: true },
  });

  // --- Generate & store OTP ---
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Store registration data as JSON payload (temporary, until OTP is verified)
  const payload = JSON.stringify({
    labName: labName.trim(),
    ownerName: ownerName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    password, // Will be hashed after OTP verification
    numRoles: roleCount,
    signupIp: clientIp,
  });

  await prisma.otpToken.create({
    data: {
      email: email.toLowerCase(),
      otp,
      payload,
      expiresAt,
    },
  });

  // --- Send OTP email ---
  const sent = await sendOtpEmail(email, otp, ownerName);
  if (!sent) {
    return { success: false, error: 'Failed to send verification email. Please try again.' };
  }

  return { success: true, message: 'OTP sent to your email. It expires in 10 minutes.' };
}

/**
 * Step 2: Verify OTP
 * Checks the OTP, creates the Customer record, and generates a trial license.
 *
 * @param {Object} data - { email, otp }
 * @returns {Object} { success, licenseKey, expiresAt, numRoles } or { success: false, error }
 */
async function verifyOtp(data) {
  const { email, otp } = data;

  if (!email || !otp) {
    return { success: false, error: 'Email and OTP are required.' };
  }

  // --- Find the latest unused OTP for this email ---
  const otpRecord = await prisma.otpToken.findFirst({
    where: {
      email: email.toLowerCase(),
      otp,
      used: false,
      expiresAt: { gt: new Date() }, // Not expired
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRecord) {
    return { success: false, error: 'Invalid or expired OTP. Please request a new one.' };
  }

  // --- Parse the stored registration data ---
  let regData;
  try {
    regData = JSON.parse(otpRecord.payload);
  } catch {
    return { success: false, error: 'Corrupted registration data. Please sign up again.' };
  }

  // --- Double-check email isn't taken (race condition guard) ---
  const existingCustomer = await prisma.customer.findUnique({
    where: { email: regData.email },
  });
  if (existingCustomer) {
    await prisma.otpToken.update({ where: { id: otpRecord.id }, data: { used: true } });
    return { success: false, error: 'An account with this email already exists.' };
  }

  // --- Hash password ---
  const hashedPassword = await bcrypt.hash(regData.password, BCRYPT_ROUNDS);

  // --- Create Customer + License in a transaction ---
  const trialExpiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const licenseKey = generateLicenseKey();

  const result = await prisma.$transaction(async (tx) => {
    // Mark OTP as used
    await tx.otpToken.update({ where: { id: otpRecord.id }, data: { used: true } });

    // Create customer
    const customer = await tx.customer.create({
      data: {
        labName: regData.labName,
        ownerName: regData.ownerName,
        email: regData.email,
        phone: regData.phone,
        password: hashedPassword,
        emailVerified: true,
        numRoles: regData.numRoles,
        signupIp: regData.signupIp,
      },
    });

    // Create trial license
    const license = await tx.license.create({
      data: {
        key: licenseKey,
        customerId: customer.id,
        plan: 'offline',
        status: 'active',
        isTrial: true,
        maxActivations: 1,
        numRoles: regData.numRoles,
        customerName: regData.ownerName,
        customerEmail: regData.email,
        expiresAt: trialExpiresAt,
        notes: `Trial — auto-generated at sign-up (IP: ${regData.signupIp || 'unknown'})`,
      },
    });

    return { customer, license };
  });

  return {
    success: true,
    licenseKey,
    expiresAt: trialExpiresAt.toISOString(),
    numRoles: regData.numRoles,
  };
}

module.exports = { requestOtp, verifyOtp };
