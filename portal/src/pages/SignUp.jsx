/**
 * SignUp.jsx — 2-Step Sign-Up Page
 *
 * Step 1: Registration form (lab info + credentials)
 * Step 2: OTP verification (6-digit email code)
 *
 * On success → navigates to /signup/success with license key data
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Microscope,
  ArrowRight,
  Mail,
  ArrowLeft,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';

const API_BASE = '';  // Same origin in production; proxied in dev

const SignUp = () => {
  const navigate = useNavigate();

  // ─── Step tracking ────────────────────────────────────
  const [step, setStep] = useState(1); // 1 = form, 2 = OTP

  // ─── Form state ──────────────────────────────────────
  const [form, setForm] = useState({
    labName: '',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    numRoles: '2',
  });
  const [showPassword, setShowPassword] = useState(false);

  // ─── OTP state ───────────────────────────────────────
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef([]);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // ─── UI state ────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ─── Resend cooldown timer ───────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const interval = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // ─── Form change handler ─────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  // ─── Password strength ──────────────────────────────
  const getPasswordStrength = useCallback((pwd) => {
    if (!pwd) return { level: 0, label: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', cls: 'weak' };
    if (score <= 2) return { level: 2, label: 'Medium', cls: 'medium' };
    return { level: 3, label: 'Strong', cls: 'strong' };
  }, []);

  const strength = getPasswordStrength(form.password);

  // ─── Step 1: Submit form & request OTP ────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!form.labName.trim()) return setError('Lab name is required.');
    if (!form.ownerName.trim()) return setError('Owner name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError('Please enter a valid email address.');
    if (!/^\d{10}$/.test(form.phone)) return setError('Phone number must be exactly 10 digits.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/signup/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labName: form.labName.trim(),
          ownerName: form.ownerName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
          numRoles: form.numRoles,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      // Move to Step 2
      setStep(2);
      setResendTimer(60);
      setCanResend(false);
    } catch (err) {
      setError('Could not connect to the server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // ─── OTP input handlers ──────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only last digit
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const digits = pasted.split('');
      setOtp(digits);
      otpRefs.current[5]?.focus();
    }
  };

  // Auto-focus first OTP input when step changes
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  // ─── Step 2: Verify OTP ───────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/signup/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          otp: otpString,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Verification failed. Please try again.');
        return;
      }

      // Success! Navigate to success page with license data
      navigate('/signup/success', {
        state: {
          licenseKey: data.licenseKey,
          expiresAt: data.expiresAt,
          numRoles: data.numRoles,
          email: form.email,
          ownerName: form.ownerName,
        },
      });
    } catch (err) {
      setError('Could not connect to the server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend OTP ──────────────────────────────────────
  const handleResend = async () => {
    setCanResend(false);
    setResendTimer(60);
    setError('');
    setOtp(['', '', '', '', '', '']);

    try {
      const res = await fetch(`${API_BASE}/api/signup/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          labName: form.labName.trim(),
          ownerName: form.ownerName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          password: form.password,
          numRoles: form.numRoles,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to resend OTP.');
      }
    } catch {
      setError('Could not connect to the server.');
    }
  };

  // ─── Mask email for display ──────────────────────────
  const maskedEmail = form.email
    ? form.email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '•'.repeat(Math.min(b.length, 5)) + c)
    : '';

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <>
      <div className="page-bg" />
      <div className="page-container">
        <div className={`card ${step === 1 ? 'card-wide' : ''}`}>
          {/* Header */}
          <div className="card-header">
            <div className="logo-icon">🔬</div>
            <h1>MicroLab Pro</h1>
            <p>{step === 1 ? 'Start your free 14-day trial' : 'Verify your email'}</p>
          </div>

          {/* Step Indicator */}
          <div className="step-indicator">
            <div className={`step-dot ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`} />
            <div className={`step-dot ${step >= 2 ? 'active' : ''}`} />
          </div>

          {/* Error Message */}
          {error && <div className="msg-error">{error}</div>}

          {/* ─── Step 1: Registration Form ──────────────── */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp}>
              <div className="form-group">
                <label className="form-label">Lab Name</label>
                <input
                  type="text"
                  name="labName"
                  className="form-input"
                  placeholder="e.g. MicroPath Diagnostics"
                  value={form.labName}
                  onChange={handleChange}
                  autoFocus
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Owner Name</label>
                  <input
                    type="text"
                    name="ownerName"
                    className="form-input"
                    placeholder="Dr. Full Name"
                    value={form.ownerName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone (10 digits)</label>
                  <input
                    type="tel"
                    name="phone"
                    className="form-input"
                    placeholder="9876543210"
                    maxLength={10}
                    value={form.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="you@clinic.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      className="form-input"
                      placeholder="Min. 8 characters"
                      value={form.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      style={{ paddingRight: '40px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text-dim)',
                        padding: '4px',
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.password && (
                    <>
                      <div className="password-strength">
                        {[1, 2, 3].map((n) => (
                          <div
                            key={n}
                            className={`strength-bar ${n <= strength.level ? strength.cls : ''}`}
                          />
                        ))}
                      </div>
                      <div className={`strength-label ${strength.cls}`}>
                        {strength.label}
                      </div>
                    </>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    className="form-input"
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Number of User Accounts</label>
                <div className="radio-group">
                  <div className="radio-option">
                    <input
                      type="radio"
                      name="numRoles"
                      value="2"
                      id="roles-2"
                      checked={form.numRoles === '2'}
                      onChange={handleChange}
                    />
                    <label htmlFor="roles-2">
                      <strong>2 Users</strong>
                      <br />
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Admin + 1 Staff</span>
                    </label>
                  </div>
                  <div className="radio-option">
                    <input
                      type="radio"
                      name="numRoles"
                      value="3"
                      id="roles-3"
                      checked={form.numRoles === '3'}
                      onChange={handleChange}
                    />
                    <label htmlFor="roles-3">
                      <strong>3 Users</strong>
                      <br />
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Admin + 2 Staff</span>
                    </label>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className={`btn-primary ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {!loading && (
                  <>
                    Continue <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ─── Step 2: OTP Verification ───────────────── */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp}>
              <div className="msg-info">
                <Mail size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                We've sent a 6-digit code to<br />
                <strong>{maskedEmail}</strong>
              </div>

              {/* OTP Inputs */}
              <div className="otp-container" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    className={`otp-digit ${digit ? 'filled' : ''}`}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    ref={(el) => (otpRefs.current[i] = el)}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              <button
                type="submit"
                className={`btn-primary ${loading ? 'loading' : ''}`}
                disabled={loading || otp.join('').length !== 6}
              >
                {!loading && (
                  <>
                    <Shield size={16} />
                    Verify & Get License Key
                  </>
                )}
              </button>

              {/* Resend Row */}
              <div className="resend-row">
                {canResend ? (
                  <button type="button" className="btn-ghost" onClick={handleResend}>
                    Resend Code
                  </button>
                ) : (
                  <span>Resend code in <strong>{resendTimer}s</strong></span>
                )}
              </div>

              {/* Back Button */}
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setError(''); }}
                >
                  <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Back to form
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="card-footer">
            <p>
              Already have a key? Just open MicroLab Pro and enter it.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUp;
