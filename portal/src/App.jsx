import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminProvider } from './context/AdminContext';

// Public pages
import SignUp from './pages/SignUp';
import SignUpSuccess from './pages/SignUpSuccess';

// Admin pages
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminLicenses from './pages/AdminLicenses';

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/signup" element={<SignUp />} />
      <Route path="/signup/success" element={<SignUpSuccess />} />

      {/* Admin Routes — wrapped in AdminProvider */}
      <Route
        path="/admin/*"
        element={
          <AdminProvider>
            <Routes>
              <Route path="login" element={<AdminLogin />} />
              <Route element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="licenses" element={<AdminLicenses />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="login" replace />} />
            </Routes>
          </AdminProvider>
        }
      />

      {/* Default redirects */}
      <Route path="/" element={<Navigate to="/signup" replace />} />
      <Route path="*" element={<Navigate to="/signup" replace />} />
    </Routes>
  );
}

export default App;
