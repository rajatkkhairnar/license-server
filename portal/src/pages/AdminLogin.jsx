/**
 * AdminLogin.jsx — Admin Portal Login Page
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

const AdminLogin = () => {
  const { login, loading } = useAdmin();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(form.username, form.password);
    if (result.success) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <>
      <div className="page-bg" />
      <div className="page-container">
        <div className="card" style={{ maxWidth: 400 }}>
          <div className="card-header">
            <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
              <Shield size={26} color="white" />
            </div>
            <h1>Admin Portal</h1>
            <p>MicroLab Pro License Management</p>
          </div>

          {error && (
            <div className="msg-error" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="Admin username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                autoFocus
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
            <button
              type="submit"
              className={`btn-primary ${loading ? 'loading' : ''}`}
              disabled={loading}
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}
            >
              {!loading && <>Sign In <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="card-footer">
            <p>Protected area. Vendor access only.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;
