import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AIOutput from '../components/AIOutput';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const formatMoney = (amount) => {
  const num = parseFloat(amount) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Analytics({ token }) {
  const [dashboard, setDashboard] = useState(null);
  const [shootTypes, setShootTypes] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiModel, setAiModel] = useState(null);
  const [aiTokens, setAiTokens] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/analytics/dashboard`, { headers }),
      axios.get(`${API}/api/analytics/shoot-types`, { headers }),
      axios.get(`${API}/api/analytics/expense-categories`, { headers }),
    ]).then(([dashboardRes, shootTypesRes, expenseCategoriesRes]) => {
      setDashboard(dashboardRes.data);
      setShootTypes(shootTypesRes.data);
      setExpenseCategories(expenseCategoriesRes.data);
    }).catch(() => {
      toast.error('Failed to load analytics');
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const handleGetInsights = async () => {
    setAiLoading(true);
    setAiResponse(null);
    try {
      const res = await axios.get(`${API}/api/ai/business-insights`, { headers });
      setAiResponse(res.data.response || res.data.insights || res.data.text);
      setAiModel(res.data.model);
      setAiTokens(res.data.tokens || res.data.usage);
    } catch (err) {
      toast.error('Failed to get AI insights');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading analytics...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Analytics & Reports</h1>
          <p>Business performance insights and AI analysis</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="card-icon">💵</div>
          <h3>Revenue</h3>
          <div className="stat-value">{formatMoney(dashboard?.revenue)}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">📈</div>
          <h3>Profit</h3>
          <div className="stat-value">{formatMoney(dashboard?.profit)}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">💸</div>
          <h3>Expenses</h3>
          <div className="stat-value">{formatMoney(dashboard?.expenses)}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">👥</div>
          <h3>Active Clients</h3>
          <div className="stat-value">{dashboard?.active_clients || 0}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
        <div className="detail-view">
          <h2 style={{ marginBottom: '16px' }}>Revenue by Shoot Type</h2>
          {shootTypes.length === 0 ? (
            <p style={{ color: 'var(--text-secondary, #666)' }}>No shoot type data available</p>
          ) : (
            shootTypes.map((st, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-color, #e5e7eb)'
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{st.shoot_type || st.name}</span>
                  <span style={{ color: 'var(--text-secondary, #666)', marginLeft: '8px' }}>({st.count} shoots)</span>
                </div>
                <span style={{ fontWeight: 600 }}>{formatMoney(st.revenue || st.total)}</span>
              </div>
            ))
          )}
        </div>

        <div className="detail-view">
          <h2 style={{ marginBottom: '16px' }}>Expenses by Category</h2>
          {expenseCategories.length === 0 ? (
            <p style={{ color: 'var(--text-secondary, #666)' }}>No expense data available</p>
          ) : (
            expenseCategories.map((ec, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--border-color, #e5e7eb)'
              }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{ec.category || ec.name}</span>
                  <span style={{ color: 'var(--text-secondary, #666)', marginLeft: '8px' }}>({ec.count} items)</span>
                </div>
                <span style={{ fontWeight: 600 }}>{formatMoney(ec.total)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button className="btn btn-primary" onClick={handleGetInsights} disabled={aiLoading}>
          🤖 Get AI Business Insights
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <AIOutput
          response={aiResponse}
          model={aiModel}
          tokens={aiTokens}
          loading={aiLoading}
          title="AI Business Insights"
        />
      </div>
    </div>
  );
}
