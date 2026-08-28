/**
 * AdminDashboard.jsx — Admin KPI Dashboard
 *
 * Shows:
 *   - 4 KPI stat cards (total licenses, active, suspended, customers)
 *   - Plan distribution breakdown
 *   - Recent activations feed
 */
import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertOctagon,
  Users,
  Activity,
  Loader2,
  RefreshCw,
  Monitor,
  UploadCloud,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

const AdminDashboard = () => {
  const { apiFetch } = useAdmin();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  const handleSoftwareUpload = async (e) => {
    e.preventDefault();
    const file = e.target.softwareFile.files[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('softwareFile', file);

    try {
      const res = await apiFetch('/admin/software/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadMessage('Software uploaded successfully!');
      e.target.reset();
    } catch (err) {
      setUploadMessage(err.message);
    } finally {
      setUploading(false);
    }
  };

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/admin/dashboard-stats');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 size={28} className="spin" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error">
        <p>{error}</p>
        <button onClick={loadStats} className="btn-primary" style={{ maxWidth: 200 }}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Licenses', value: stats.totalLicenses, icon: KeyRound, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { label: 'Active', value: stats.activeLicenses, icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Suspended', value: stats.suspendedLicenses, icon: AlertOctagon, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Customers', value: stats.totalCustomers, icon: Users, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  ];

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">License management overview</p>
        </div>
        <button onClick={loadStats} className="admin-btn-icon" title="Refresh">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card">
            <div className="kpi-icon" style={{ background: kpi.bg }}>
              <kpi.icon size={22} style={{ color: kpi.color }} />
            </div>
            <div>
              <p className="kpi-value">{kpi.value}</p>
              <p className="kpi-label">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column: Plan Distribution + Today's Activations */}
      <div className="admin-grid-2">
        {/* Plan Distribution */}
        <div className="admin-card">
          <h3 className="admin-card-title">Plan Distribution</h3>
          {stats.planDistribution && stats.planDistribution.length > 0 ? (
            <div className="plan-bars">
              {stats.planDistribution.map((p) => {
                const pct = stats.totalLicenses > 0 ? Math.round((p.count / stats.totalLicenses) * 100) : 0;
                const colors = {
                  trial: '#f59e0b',
                  monthly: '#3b82f6',
                  yearly: '#10b981',
                  lifetime: '#6366f1',
                };
                return (
                  <div key={p.plan} className="plan-bar-row">
                    <div className="plan-bar-label">
                      <span className="plan-dot" style={{ background: colors[p.plan] || '#64748b' }} />
                      <span className="plan-name">{p.plan}</span>
                      <span className="plan-count">{p.count}</span>
                    </div>
                    <div className="plan-bar-track">
                      <div
                        className="plan-bar-fill"
                        style={{ width: `${pct}%`, background: colors[p.plan] || '#64748b' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="admin-empty">No licenses yet</p>
          )}
        </div>

        {/* Recent Activations */}
        <div className="admin-card">
          <h3 className="admin-card-title">
            Recent Activations
            <span className="admin-badge">{stats.todayActivations} today</span>
          </h3>
          {stats.recentActivations && stats.recentActivations.length > 0 ? (
            <div className="activation-list">
              {stats.recentActivations.map((a) => (
                <div key={a.id} className="activation-item">
                  <div className="activation-icon">
                    <Monitor size={14} />
                  </div>
                  <div className="activation-info">
                    <p className="activation-key">{a.licenseKey}</p>
                    <p className="activation-meta">
                      {a.plan} · {a.machineLabel}
                    </p>
                  </div>
                  <span className="activation-time">
                    {new Date(a.activatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="admin-empty">No activations yet</p>
          )}
        </div>
      </div>

      {/* Software Upload Section */}
      <div className="admin-card" style={{ marginTop: '24px' }}>
        <h3 className="admin-card-title">
          <UploadCloud size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
          Software Updates
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Upload new versions of MicroLab Pro. Users will download the latest version from their trial confirmation page. The system keeps the 3 most recent uploads.
        </p>
        
        <form onSubmit={handleSoftwareUpload} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input 
            type="file" 
            name="softwareFile" 
            required 
            style={{ 
              padding: '8px', 
              border: '1px solid var(--border-color)', 
              borderRadius: '6px',
              flex: 1,
              background: 'var(--card-bg)'
            }} 
          />
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={uploading}
            style={{ minWidth: '120px' }}
          >
            {uploading ? <Loader2 size={16} className="spin" /> : 'Upload'}
          </button>
        </form>
        {uploadMessage && (
          <p style={{ 
            marginTop: '12px', 
            fontSize: '14px', 
            color: uploadMessage.includes('successfully') ? '#10b981' : '#ef4444' 
          }}>
            {uploadMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
