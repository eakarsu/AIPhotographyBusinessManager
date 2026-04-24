import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/clients', label: 'Clients', icon: '👥' },
  { path: '/galleries', label: 'Galleries', icon: '🖼️' },
  { path: '/contracts', label: 'Contracts', icon: '📋' },
  { path: '/invoices', label: 'Invoices', icon: '💰' },
  { path: '/shoots', label: 'Shoots', icon: '📅' },
  { path: '/packages', label: 'Packages', icon: '📦' },
  { path: '/ai-editing', label: 'AI Editing', icon: '🤖' },
  { path: '/social-media', label: 'Social Media', icon: '📱' },
  { path: '/equipment', label: 'Equipment', icon: '📷' },
  { path: '/expenses', label: 'Expenses', icon: '💳' },
  { path: '/portfolio', label: 'Portfolio', icon: '🎨' },
  { path: '/workflows', label: 'Workflows', icon: '⚡' },
  { path: '/email-templates', label: 'Email Templates', icon: '✉️' },
  { path: '/testimonials', label: 'Testimonials', icon: '⭐' },
  { path: '/analytics', label: 'Analytics', icon: '📈' },
  { path: '/mileage', label: 'Mileage', icon: '🚗' },
  { path: '/bookings', label: 'Bookings', icon: '📩' },
  { path: '/tasks', label: 'Tasks', icon: '✅' },
];

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>📸 PhotoStudio AI</h2>
          <p>Business Manager</p>
        </div>
        <ul className="nav-items">
          {navItems.map(item => (
            <li key={item.path} className="nav-item">
              <Link
                to={item.path}
                className={location.pathname === item.path ? 'active' : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="user-details">
              <div className="name">{user?.name || 'Admin'}</div>
              <div className="role">{user?.role || 'admin'}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={onLogout}>Sign Out</button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
