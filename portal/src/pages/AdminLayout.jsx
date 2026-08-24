/**
 * AdminLayout.jsx — Admin Portal Shell
 *
 * Provides the sidebar navigation + content area for all admin pages.
 * Redirects to /admin/login if no token is present.
 */
import React from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  KeyRound,
  LogOut,
  Shield,
  Activity,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

const AdminLayout = () => {
  const { token, logout } = useAdmin();
  const navigate = useNavigate();

  if (!token) return <Navigate to="/admin/login" replace />;

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `admin-nav-link ${isActive ? 'active' : ''}`;

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <Shield size={20} />
          </div>
          <div>
            <h2 className="admin-brand">MicroLab</h2>
            <p className="admin-brand-sub">Admin Portal</p>
          </div>
        </div>

        <nav className="admin-nav">
          <NavLink to="/admin/dashboard" className={linkClass}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/admin/licenses" className={linkClass}>
            <KeyRound size={18} />
            <span>Licenses</span>
          </NavLink>
        </nav>

        <div className="admin-sidebar-footer">
          <button onClick={handleLogout} className="admin-logout-btn">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
          <div className="admin-health">
            <Activity size={12} />
            <span>Server Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
