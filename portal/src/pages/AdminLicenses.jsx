/**
 * AdminLicenses.jsx — License Management Page
 *
 * Full CRUD for licenses:
 *   - Searchable, filterable, paginated table
 *   - Inline status badges + expiry dates
 *   - Edit modal: change status, expiry, maxActivations, notes
 *   - Create new license modal
 *   - View activations + revoke
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  Monitor,
  Copy,
  Check,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

const AdminLicenses = () => {
  const { apiFetch } = useAdmin();

  // ─── List state ──────────────────────────────────────
  const [licenses, setLicenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  // ─── Modals ──────────────────────────────────────────
  const [editModal, setEditModal] = useState(null); // license object or null
  const [detailModal, setDetailModal] = useState(null); // full license with activations
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  // ─── Create form ─────────────────────────────────────
  const [createForm, setCreateForm] = useState({
    customerName: '',
    customerEmail: '',
    plan: 'trial',
    durationDays: '14',
    maxActivations: '1',
    numRoles: '2',
    notes: '',
  });

  // ─── Fetch licenses ──────────────────────────────────
  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(search && { search }),
        ...(filterPlan !== 'all' && { plan: filterPlan }),
        ...(filterStatus !== 'all' && { status: filterStatus }),
      });
      const res = await apiFetch(`/admin/licenses?${params}`);
      const data = await res.json();
      setLicenses(data.licenses || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, page, search, filterPlan, filterStatus]);

  useEffect(() => {
    const timer = setTimeout(fetchLicenses, 300);
    return () => clearTimeout(timer);
  }, [fetchLicenses]);

  // ─── Status badge ────────────────────────────────────
  const StatusBadge = ({ status }) => {
    const map = {
      active: { icon: CheckCircle2, cls: 'badge-green', label: 'Active' },
      suspended: { icon: Ban, cls: 'badge-amber', label: 'Suspended' },
      expired: { icon: Clock, cls: 'badge-red', label: 'Expired' },
      revoked: { icon: AlertTriangle, cls: 'badge-red', label: 'Revoked' },
    };
    const s = map[status] || map.active;
    return (
      <span className={`admin-badge-pill ${s.cls}`}>
        <s.icon size={12} /> {s.label}
      </span>
    );
  };

  // ─── Copy helper ─────────────────────────────────────
  const handleCopy = async (text, id) => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(id);
    setTimeout(() => setCopied(''), 1500);
  };

  // ─── Edit handler ────────────────────────────────────
  const handleEdit = (lic) => {
    setEditModal({
      id: lic.id,
      status: lic.status,
      maxActivations: String(lic.maxActivations),
      numRoles: String(lic.numRoles),
      expiresAt: lic.expiresAt ? new Date(lic.expiresAt).toISOString().split('T')[0] : '',
      notes: lic.notes || '',
      isTrial: lic.isTrial,
    });
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/licenses/${editModal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editModal.status,
          maxActivations: editModal.maxActivations,
          numRoles: editModal.numRoles,
          expiresAt: editModal.expiresAt || null,
          notes: editModal.notes,
          isTrial: editModal.isTrial,
        }),
      });
      if (res.ok) {
        setEditModal(null);
        fetchLicenses();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ─── Detail / activations ────────────────────────────
  const openDetail = async (id) => {
    try {
      const res = await apiFetch(`/admin/licenses/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailModal(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const revokeActivation = async (activationId) => {
    if (!confirm('Revoke this activation? The device will lose access.')) return;
    try {
      await apiFetch(`/admin/activations/${activationId}/revoke`, { method: 'PATCH' });
      // Refresh detail
      if (detailModal) openDetail(detailModal.id);
      fetchLicenses();
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Delete ──────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this license? This cannot be undone.')) return;
    try {
      const res = await apiFetch(`/admin/licenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Delete failed');
        return;
      }
      fetchLicenses();
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Create ──────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/admin/licenses', {
        method: 'POST',
        body: JSON.stringify({
          customerName: createForm.customerName,
          customerEmail: createForm.customerEmail,
          plan: createForm.plan,
          durationDays: parseInt(createForm.durationDays, 10),
          maxActivations: parseInt(createForm.maxActivations, 10),
          numRoles: parseInt(createForm.numRoles, 10),
          notes: createForm.notes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCreateModal(false);
        setCreateForm({ customerName: '', customerEmail: '', plan: 'trial', durationDays: '14', maxActivations: '1', numRoles: '2', notes: '' });
        fetchLicenses();
        alert(`License created: ${data.licenseKey}`);
      } else {
        alert(data.error || 'Failed to create license');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Licenses</h1>
          <p className="admin-page-subtitle">{total} total licenses</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchLicenses} className="admin-btn-icon" title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button onClick={() => setCreateModal(true)} className="admin-btn-primary">
            <Plus size={16} /> New License
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <div className="admin-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search key, name, or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select value={filterPlan} onChange={(e) => { setFilterPlan(e.target.value); setPage(1); }}>
          <option value="all">All Plans</option>
          <option value="trial">Trial</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="lifetime">Lifetime</option>
        </select>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0 }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>License Key</th>
              <th>Customer</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Activations</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="admin-table-loading"><Loader2 size={20} className="spin" /> Loading...</td></tr>
            ) : licenses.length === 0 ? (
              <tr><td colSpan="7" className="admin-table-empty"><KeyRound size={24} style={{ opacity: 0.3 }} /> No licenses found</td></tr>
            ) : (
              licenses.map((lic) => {
                const isExpired = lic.expiresAt && new Date(lic.expiresAt) < new Date();
                return (
                  <tr key={lic.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <code className="license-key-mono">{lic.key}</code>
                        <button
                          onClick={() => handleCopy(lic.key, lic.id)}
                          className="copy-btn-sm"
                          title="Copy"
                        >
                          {copied === lic.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <p className="cell-primary">{lic.customer?.ownerName || lic.customerName || '—'}</p>
                      <p className="cell-secondary">{lic.customer?.email || lic.customerEmail || ''}</p>
                    </td>
                    <td><span className={`plan-pill plan-${lic.plan}`}>{lic.plan}</span></td>
                    <td><StatusBadge status={isExpired && lic.status === 'active' ? 'expired' : lic.status} /></td>
                    <td>
                      {lic.expiresAt ? (
                        <span className={isExpired ? 'text-expired' : ''}>
                          {new Date(lic.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className="activation-count">{lic._count?.activations || 0} / {lic.maxActivations}</span>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button onClick={() => openDetail(lic.id)} className="action-btn" title="View Details"><Eye size={15} /></button>
                        <button onClick={() => handleEdit(lic)} className="action-btn" title="Edit"><Edit size={15} /></button>
                        <button onClick={() => handleDelete(lic.id)} className="action-btn action-btn-danger" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="admin-btn-icon"><ChevronLeft size={18} /></button>
          <span className="page-info">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="admin-btn-icon"><ChevronRight size={18} /></button>
        </div>
      )}

      {/* ═══ Edit Modal ══════════════════════════════════ */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit License</h2>
              <button onClick={() => setEditModal(null)} className="modal-close"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={editModal.status} onChange={(e) => setEditModal({ ...editModal, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="revoked">Revoked</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input type="date" className="form-input" value={editModal.expiresAt} onChange={(e) => setEditModal({ ...editModal, expiresAt: e.target.value })} />
              </div>
              <div className="admin-form-row">
                <div className="form-group">
                  <label className="form-label">Max Devices</label>
                  <input type="number" className="form-input" value={editModal.maxActivations} min="1" onChange={(e) => setEditModal({ ...editModal, maxActivations: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">User Roles</label>
                  <input type="number" className="form-input" value={editModal.numRoles} min="2" max="5" onChange={(e) => setEditModal({ ...editModal, numRoles: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <input type="checkbox" checked={editModal.isTrial} onChange={(e) => setEditModal({ ...editModal, isTrial: e.target.checked })} style={{ marginRight: 8 }} />
                  Trial License
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={editModal.notes} onChange={(e) => setEditModal({ ...editModal, notes: e.target.value })} placeholder="Internal notes..." />
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditModal(null)} className="admin-btn-ghost">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="admin-btn-primary">
                {saving ? <Loader2 size={14} className="spin" /> : null}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Detail Modal ════════════════════════════════ */}
      {detailModal && (
        <div className="modal-overlay" onClick={() => setDetailModal(null)}>
          <div className="modal-card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>License Details</h2>
              <button onClick={() => setDetailModal(null)} className="modal-close"><X size={18} /></button>
            </div>
            <div className="modal-body">
              {/* Key + Customer */}
              <div className="detail-section">
                <div className="detail-row">
                  <span className="detail-label">Key</span>
                  <code className="license-key-mono">{detailModal.key}</code>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Customer</span>
                  <span>{detailModal.customer?.ownerName || detailModal.customerName} ({detailModal.customer?.email || detailModal.customerEmail})</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Lab</span>
                  <span>{detailModal.customer?.labName || '—'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Plan</span>
                  <span className={`plan-pill plan-${detailModal.plan}`}>{detailModal.plan}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <StatusBadge status={detailModal.status} />
                </div>
                <div className="detail-row">
                  <span className="detail-label">Expires</span>
                  <span>{detailModal.expiresAt ? new Date(detailModal.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Never'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Roles</span>
                  <span>{detailModal.numRoles}</span>
                </div>
                {detailModal.notes && (
                  <div className="detail-row">
                    <span className="detail-label">Notes</span>
                    <span>{detailModal.notes}</span>
                  </div>
                )}
              </div>

              {/* Activations */}
              <h3 className="detail-sub-title">
                <Monitor size={16} /> Activations ({detailModal.activations?.length || 0} / {detailModal.maxActivations})
              </h3>
              {detailModal.activations && detailModal.activations.length > 0 ? (
                <table className="admin-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Machine</th>
                      <th>Activated</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailModal.activations.map((act) => (
                      <tr key={act.id}>
                        <td><code style={{ fontSize: 11 }}>{act.machineLabel || act.machineId.substring(0, 20)}</code></td>
                        <td>{new Date(act.activatedAt).toLocaleDateString('en-IN')}</td>
                        <td>
                          {act.isRevoked ? (
                            <span className="admin-badge-pill badge-red"><Ban size={10} /> Revoked</span>
                          ) : (
                            <span className="admin-badge-pill badge-green"><CheckCircle2 size={10} /> Active</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {!act.isRevoked && (
                            <button onClick={() => revokeActivation(act.id)} className="action-btn action-btn-danger" title="Revoke">
                              <Ban size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="admin-empty" style={{ padding: '16px 0' }}>No activations yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Create Modal ════════════════════════════════ */}
      {createModal && (
        <div className="modal-overlay" onClick={() => setCreateModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create License</h2>
              <button onClick={() => setCreateModal(false)} className="modal-close"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input className="form-input" required value={createForm.customerName} onChange={(e) => setCreateForm({ ...createForm, customerName: e.target.value })} placeholder="Dr. Full Name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer Email</label>
                  <input type="email" className="form-input" required value={createForm.customerEmail} onChange={(e) => setCreateForm({ ...createForm, customerEmail: e.target.value })} placeholder="email@clinic.com" />
                </div>
                <div className="admin-form-row">
                  <div className="form-group">
                    <label className="form-label">Plan</label>
                    <select className="form-input" value={createForm.plan} onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })}>
                      <option value="trial">Trial</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="lifetime">Lifetime</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Duration (days)</label>
                    <input type="number" className="form-input" min="1" value={createForm.durationDays} onChange={(e) => setCreateForm({ ...createForm, durationDays: e.target.value })} />
                  </div>
                </div>
                <div className="admin-form-row">
                  <div className="form-group">
                    <label className="form-label">Max Devices</label>
                    <input type="number" className="form-input" min="1" value={createForm.maxActivations} onChange={(e) => setCreateForm({ ...createForm, maxActivations: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">User Roles</label>
                    <input type="number" className="form-input" min="2" max="5" value={createForm.numRoles} onChange={(e) => setCreateForm({ ...createForm, numRoles: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <textarea className="form-input" rows={2} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Internal notes..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setCreateModal(false)} className="admin-btn-ghost">Cancel</button>
                <button type="submit" disabled={saving} className="admin-btn-primary">
                  {saving ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
                  {saving ? 'Creating...' : 'Create License'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLicenses;
