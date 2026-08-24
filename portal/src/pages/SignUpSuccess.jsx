/**
 * SignUpSuccess.jsx — Post-Registration Success Page
 *
 * Displays:
 *   - The generated license key (monospace, copyable)
 *   - Trial expiry date
 *   - Step-by-step instructions for using the key
 *   - Contact & download links
 *
 * Receives data via React Router location.state from SignUp.jsx
 */
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Copy,
  Check,
  Calendar,
  Download,
  MessageCircle,
  ArrowRight,
} from 'lucide-react';

const SignUpSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Get data from navigation state
  const {
    licenseKey = 'MLAB-XXXX-XXXX-XXXX',
    expiresAt,
    numRoles = 2,
    ownerName = '',
  } = location.state || {};

  // If no state (direct access), redirect to sign-up
  if (!location.state) {
    return (
      <>
        <div className="page-bg" />
        <div className="page-container">
          <div className="card">
            <div className="card-header">
              <div className="logo-icon">🔬</div>
              <h1>MicroLab Pro</h1>
              <p>No license data found</p>
            </div>
            <div className="msg-info">
              It looks like you came here directly. Please complete the sign-up process first.
            </div>
            <button className="btn-primary" onClick={() => navigate('/signup')}>
              Go to Sign Up <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </>
    );
  }

  // Format expiry date
  const expiryDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '14 days from now';

  // Copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = licenseKey;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      <div className="page-bg" />
      <div className="page-container">
        <div className="card">
          {/* Success Header */}
          <div className="card-header">
            <div className="success-icon">
              <CheckCircle size={32} color="#10b981" />
            </div>
            <h1>You're all set{ownerName ? `, ${ownerName.split(' ')[0]}` : ''}!</h1>
            <p>Your trial license is ready</p>
          </div>

          {/* License Key Box */}
          <div className="license-key-box" onClick={handleCopy} title="Click to copy">
            <div className="license-key-text">{licenseKey}</div>
            <div className={`copy-hint ${copied ? 'copied' : ''}`}>
              {copied ? (
                <><Check size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Copied to clipboard!</>
              ) : (
                <><Copy size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Click to copy</>
              )}
            </div>
          </div>

          {/* Expiry Badge */}
          <div style={{ textAlign: 'center' }}>
            <span className="expiry-badge">
              <Calendar size={14} />
              Trial expires: {expiryDate}
            </span>
          </div>

          {/* Instructions */}
          <ol className="instructions-list">
            <li>
              <span className="step-number">1</span>
              <span>Download and install <strong>MicroLab Pro</strong> on your computer</span>
            </li>
            <li>
              <span className="step-number">2</span>
              <span>Launch the app — you'll see a license activation screen</span>
            </li>
            <li>
              <span className="step-number">3</span>
              <span>Paste your license key <strong>{licenseKey.substring(0, 9)}...</strong> and click Activate</span>
            </li>
            <li>
              <span className="step-number">4</span>
              <span>
                Log in with the default credentials:<br />
                <code style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: '#93c5fd',
                }}>admin / admin123</code>
                {numRoles >= 3 && (
                  <> and <code style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    color: '#93c5fd',
                  }}>staff / staff123</code></>
                )}
              </span>
            </li>
          </ol>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ textDecoration: 'none', flex: 1 }}
            >
              <Download size={16} />
              Download App
            </a>
            <button
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                flex: 1,
              }}
              onClick={() => {
                const text = encodeURIComponent(
                  `Hi, I just signed up for MicroLab Pro trial. My license key is: ${licenseKey}`
                );
                window.open(`https://wa.me/?text=${text}`, '_blank');
              }}
            >
              <MessageCircle size={16} />
              Contact Vendor
            </button>
          </div>

          {/* Footer */}
          <div className="card-footer">
            <p>
              Save your license key securely. You'll need it if you reinstall.
            </p>
            <p style={{ marginTop: '6px' }}>
              To purchase a full license after your trial,{' '}
              <a href="https://wa.me/" target="_blank" rel="noopener noreferrer">
                contact us via WhatsApp →
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUpSuccess;
