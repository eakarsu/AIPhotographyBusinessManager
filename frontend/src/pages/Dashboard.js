import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function Dashboard({ token }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API}/api/clients`, { headers }),
      axios.get(`${API}/api/galleries`, { headers }),
      axios.get(`${API}/api/contracts`, { headers }),
      axios.get(`${API}/api/invoices`, { headers }),
      axios.get(`${API}/api/shoots`, { headers }),
      axios.get(`${API}/api/ai/edits`, { headers }),
      axios.get(`${API}/api/social`, { headers }),
      axios.get(`${API}/api/packages`, { headers }),
      axios.get(`${API}/api/equipment`, { headers }),
      axios.get(`${API}/api/expenses`, { headers }),
      axios.get(`${API}/api/portfolio`, { headers }),
      axios.get(`${API}/api/workflows`, { headers }),
      axios.get(`${API}/api/emails`, { headers }),
      axios.get(`${API}/api/testimonials`, { headers }),
      axios.get(`${API}/api/bookings`, { headers }),
    ]).then(([clients, galleries, contracts, invoices, shoots, aiEdits, social, packages, equipment, expenses, portfolio, workflows, emails, testimonials, bookings]) => {
      const totalRevenue = invoices.data.reduce((sum, i) => sum + parseFloat(i.total || 0), 0);
      const paidRevenue = invoices.data.filter(i => i.status === 'Paid').reduce((sum, i) => sum + parseFloat(i.total || 0), 0);
      const totalExpenses = expenses.data.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
      setStats({
        clients: clients.data.length,
        galleries: galleries.data.length,
        contracts: contracts.data.length,
        invoices: invoices.data.length,
        shoots: shoots.data.length,
        aiEdits: aiEdits.data.length,
        social: social.data.length,
        packages: packages.data.length,
        equipment: equipment.data.length,
        expenses: expenses.data.length,
        portfolio: portfolio.data.length,
        workflows: workflows.data.length,
        emails: emails.data.length,
        testimonials: testimonials.data.length,
        totalRevenue,
        paidRevenue,
        totalExpenses,
        profit: paidRevenue - totalExpenses,
        upcomingShoots: shoots.data.filter(s => s.status === 'Scheduled').length,
        pendingInvoices: invoices.data.filter(i => i.status === 'Pending').length,
        activeContracts: contracts.data.filter(c => c.status === 'Active' || c.status === 'Signed').length,
        activeWorkflows: workflows.data.filter(w => w.status === 'In Progress').length,
        avgRating: testimonials.data.length > 0 ? (testimonials.data.reduce((s, t) => s + (t.rating || 0), 0) / testimonials.data.length).toFixed(1) : '0',
        equipmentValue: equipment.data.reduce((s, e) => s + parseFloat(e.purchase_price || 0), 0),
        bookings: bookings.data.length,
        newBookings: bookings.data.filter(b => b.status === 'New').length,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="loading"><div className="spinner"></div> Loading dashboard...</div>;
  }

  const features = [
    { path: '/clients', icon: '👥', title: 'Client Management', desc: 'Manage client profiles, contacts, and history', count: `${stats.clients} clients` },
    { path: '/galleries', icon: '🖼️', title: 'Gallery Delivery', desc: 'Create and deliver photo galleries to clients', count: `${stats.galleries} galleries` },
    { path: '/contracts', icon: '📋', title: 'Contracts', desc: 'Generate and manage contracts with AI assistance', count: `${stats.contracts} contracts` },
    { path: '/invoices', icon: '💰', title: 'Invoices', desc: 'Create invoices, track payments, manage billing', count: `${stats.invoices} invoices` },
    { path: '/shoots', icon: '📅', title: 'Shoot Scheduling', desc: 'Schedule and manage photography sessions', count: `${stats.shoots} shoots` },
    { path: '/packages', icon: '📦', title: 'Packages & Pricing', desc: 'Photography packages and pricing tiers', count: `${stats.packages} packages` },
    { path: '/ai-editing', icon: '🤖', title: 'AI Auto-Culling & Editing', desc: 'AI-powered photo culling and editing suggestions', count: `${stats.aiEdits} edits` },
    { path: '/social-media', icon: '📱', title: 'Social Media', desc: 'Schedule posts and generate AI captions', count: `${stats.social} posts` },
    { path: '/equipment', icon: '📷', title: 'Equipment', desc: 'Track camera gear and equipment inventory', count: `${stats.equipment} items` },
    { path: '/expenses', icon: '💳', title: 'Expenses', desc: 'Track expenses and tax deductions', count: `${stats.expenses} expenses` },
    { path: '/portfolio', icon: '🎨', title: 'Portfolio', desc: 'Manage your photography portfolio showcase', count: `${stats.portfolio} pieces` },
    { path: '/workflows', icon: '⚡', title: 'Workflows', desc: 'Track project workflows and production', count: `${stats.workflows} workflows` },
    { path: '/email-templates', icon: '✉️', title: 'Email Templates', desc: 'Client communication email templates', count: `${stats.emails} templates` },
    { path: '/testimonials', icon: '⭐', title: 'Testimonials', desc: 'Client reviews and testimonials', count: `${stats.testimonials} reviews` },
    { path: '/analytics', icon: '📈', title: 'Analytics & Reports', desc: 'Business performance insights with AI analysis', count: `$${stats.totalRevenue?.toLocaleString()} revenue` },
    { path: '/pricing-calculator', icon: '💲', title: 'AI Pricing Calculator', desc: 'Get AI-powered pricing recommendations with market positioning analysis', count: 'AI Tool' },
    { path: '/style-analyzer', icon: '🎭', title: 'AI Style Analyzer', desc: 'Upload portfolio photos to discover your distinctive photography style signature', count: 'Vision AI' },
    { path: '/bookings', icon: '📩', title: 'Booking Requests', desc: 'Manage client inquiries and booking requests', count: `${stats.bookings} requests` },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back! Here's your business overview.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card" onClick={() => navigate('/invoices')}>
          <div className="card-icon">💵</div>
          <h3>Total Revenue</h3>
          <div className="stat-value">${stats.totalRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div className="stat-sub">${stats.paidRevenue?.toLocaleString('en-US', { minimumFractionDigits: 2 })} collected</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/analytics')}>
          <div className="card-icon">📊</div>
          <h3>Net Profit</h3>
          <div className="stat-value" style={{ color: stats.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>${stats.profit?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div className="stat-sub">${stats.totalExpenses?.toLocaleString()} in expenses</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/shoots')}>
          <div className="card-icon">📅</div>
          <h3>Upcoming Shoots</h3>
          <div className="stat-value">{stats.upcomingShoots}</div>
          <div className="stat-sub">{stats.shoots} total shoots</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/invoices')}>
          <div className="card-icon">⏳</div>
          <h3>Pending Invoices</h3>
          <div className="stat-value">{stats.pendingInvoices}</div>
          <div className="stat-sub">{stats.invoices} total invoices</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/workflows')}>
          <div className="card-icon">⚡</div>
          <h3>Active Workflows</h3>
          <div className="stat-value">{stats.activeWorkflows}</div>
          <div className="stat-sub">{stats.workflows} total workflows</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/testimonials')}>
          <div className="card-icon">⭐</div>
          <h3>Avg Rating</h3>
          <div className="stat-value">{stats.avgRating}</div>
          <div className="stat-sub">{stats.testimonials} reviews</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/equipment')}>
          <div className="card-icon">📷</div>
          <h3>Equipment Value</h3>
          <div className="stat-value">${stats.equipmentValue?.toLocaleString()}</div>
          <div className="stat-sub">{stats.equipment} items tracked</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/clients')}>
          <div className="card-icon">👥</div>
          <h3>Total Clients</h3>
          <div className="stat-value">{stats.clients}</div>
          <div className="stat-sub">{stats.activeContracts} active contracts</div>
        </div>
      </div>

      <div className="page-header" style={{ marginTop: '16px' }}>
        <h1 style={{ fontSize: '22px' }}>All Features ({features.length})</h1>
      </div>

      <div className="feature-grid">
        {features.map(f => (
          <div key={f.path} className="feature-card" onClick={() => navigate(f.path)}>
            <div className="card-icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <div className="card-count">{f.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
