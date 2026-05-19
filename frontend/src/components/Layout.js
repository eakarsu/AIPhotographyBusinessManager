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
  { path: '/pricing-calculator', label: 'AI Pricing', icon: '💲' },
  { path: '/style-analyzer', label: 'Style Analyzer', icon: '🎭' },
  { path: '/bookings', label: 'Bookings', icon: '📩' },
  { path: '/shoot-plan-optimize', label: 'Shoot Plan AI', icon: '🗺️' },
  { path: '/gallery-organization-ai', label: 'Gallery Org AI', icon: '🗂️' },
  { path: '/custom-views', label: 'Studio Views', icon: '🎬' },
  // === Batch 06 Gaps & Frontend Mounts ===
  { path: '/cf-agentic-shoot-orchestration', label: 'Agentic shoot orchestration', icon: '✨' },
  { path: '/cf-computer-vision-photo-analysis', label: 'Computer vision photo analysis', icon: '✨' },
  { path: '/cf-client-communication-automation', label: 'Client communication automation', icon: '✨' },
  { path: '/cf-pricing-intelligence', label: 'Pricing intelligence', icon: '✨' },
  { path: '/cf-video-highlight-reel-generation', label: 'Video highlight reel generation', icon: '✨' },
  { path: '/gap-shoots-without-shoot', label: 'Shoots without `/shoot', icon: '✨' },
  { path: '/gap-clients-without-client', label: 'Clients without `/client', icon: '✨' },
  { path: '/gap-galleries-without-gallery', label: 'Galleries without `/gallery', icon: '✨' },
  { path: '/gap-testimonials-without-review', label: 'Testimonials without `/review', icon: '✨' },
  { path: '/gap-limited-storage-integration-integrations-stub', label: 'Limited storage integration (integrations stub', icon: '✨' },
  { path: '/gap-no-client-proofing-workflow-advanced-markup-approv', label: 'No client proofing workflow (advanced markup/approval)', icon: '✨' },
  { path: '/gap-no-photographer-schedule-optimization', label: 'No photographer schedule optimization', icon: '✨' },
  { path: '/gap-no-integration-with-lightroom-capture-one-editing-', label: 'No integration with Lightroom/Capture One (editing tools)', icon: '✨' },
  { path: '/gap-no-marketplace-selling-prints-products', label: 'No marketplace (selling prints, products)', icon: '✨' },
  { path: '/gap-no-notifications-module-grep-0', label: 'No notifications module (grep 0)', icon: '✨' },
  { path: '/gap-no-audit-logging-grep-0', label: 'No audit logging (grep 0)', icon: '✨' },
  { path: '/gap-no-webhooks-for-booking-events', label: 'No webhooks for booking events', icon: '✨' }
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
