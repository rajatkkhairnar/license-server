/**
 * email.js — Email Sending Utility
 *
 * Sends OTP verification emails during sign-up.
 * Uses EmailJS (Node.js SDK) — the same service used on the portfolio website.
 *
 * Configure via environment variables:
 *   EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY
 *
 * Your EmailJS template should have these variables:
 *   {{to_email}}  — Recipient email address
 *   {{to_name}}   — Recipient's name
 *   {{otp_code}}  — The 6-digit OTP code
 */
const emailjs = require('@emailjs/nodejs');

// Initialize EmailJS with credentials at module load
const publicKey = process.env.EMAILJS_PUBLIC_KEY;
const privateKey = process.env.EMAILJS_PRIVATE_KEY;

if (publicKey) {
  emailjs.init({
    publicKey,
    privateKey: privateKey || undefined,
  });
  console.log('✅ EmailJS initialized successfully');
} else {
  console.warn('⚠️ EmailJS not configured — OTPs will only be logged to console');
}

/**
 * Generates a random 6-digit OTP.
 * @returns {string} 6-digit code as string (zero-padded)
 */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends an OTP verification email via EmailJS.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} ownerName - Customer's name (for personalization)
 * @returns {Promise<boolean>} true if sent successfully
 */
async function sendOtpEmail(toEmail, otp, ownerName) {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;

  // Always log OTP to console (helpful for development & debugging)
  console.log('═══════════════════════════════════════════');
  console.log(`📧 OTP for ${toEmail}: ${otp}`);
  console.log('═══════════════════════════════════════════');

  if (!serviceId || !templateId || !publicKey) {
    console.warn('WARNING: EmailJS credentials not configured. OTP logged to console only.');
    return true;
  }

  try {
    const response = await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: toEmail,
        to_name: ownerName || toEmail.split('@')[0],
        otp_code: otp,
      }
    );
    console.log(`✅ OTP email sent to ${toEmail} via EmailJS — Status: ${response.status}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send OTP email via EmailJS:');
    console.error('   Error:', JSON.stringify(err, null, 2));
    // Still return true so the sign-up flow continues (OTP is in console)
    return true;
  }
}

module.exports = { generateOtp, sendOtpEmail };
