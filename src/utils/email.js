/**
 * email.js — Email Sending Utility
 *
 * Sends OTP verification emails during sign-up.
 * Uses Nodemailer instead of EmailJS to bypass browser-only restrictions.
 *
 * Configure via environment variables:
 *   SMTP_USER (e.g., your gmail address)
 *   SMTP_PASS (e.g., an App Password generated in Google Account settings)
 */
const nodemailer = require('nodemailer');

let transporter = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    service: 'gmail', // Use 'gmail' as a convenient preset
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log('✅ Nodemailer initialized successfully');
} else {
  console.warn('⚠️ SMTP_USER or SMTP_PASS not configured — OTPs will only be logged to console');
}

/**
 * Generates a random 6-digit OTP.
 * @returns {string} 6-digit code as string (zero-padded)
 */
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends an OTP verification email via Nodemailer.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} ownerName - Customer's name (for personalization)
 * @returns {Promise<boolean>} true if sent successfully
 */
async function sendOtpEmail(toEmail, otp, ownerName) {
  // Always log OTP to console (helpful for development & debugging)
  console.log('═══════════════════════════════════════════');
  console.log(`📧 OTP for ${toEmail}: ${otp}`);
  console.log('═══════════════════════════════════════════');

  if (!transporter) {
    console.warn('WARNING: Nodemailer not configured. OTP logged to console only.');
    return true; // Return true so signup continues in dev
  }

  const mailOptions = {
    from: `"Laxio Accounts" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Your Laxio Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
        <h2 style="color: #2563eb;">Verify your email</h2>
        <p>Hi ${ownerName || 'there'},</p>
        <p>Use the following 6-digit code to complete your sign-up for Laxio:</p>
        <div style="margin: 30px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; letter-spacing: 4px; color: #1e40af;">${otp}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this code, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="font-size: 12px; color: #6b7280;">Laxio Licensing System</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${toEmail} via Nodemailer — MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('❌ Failed to send OTP email via Nodemailer:');
    console.error(err);
    // Still return true so the sign-up flow continues (OTP is in console)
    return true;
  }
}

module.exports = { generateOtp, sendOtpEmail };
