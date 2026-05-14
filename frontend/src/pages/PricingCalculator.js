import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const positioningColor = (p) => {
  const m = { budget: '#9e9e9e', 'mid-range': '#2196f3', premium: '#9c27b0', luxury: '#f57f17' };
  return m[p] || '#2196f3';
};

export default function PricingCalculator({ token }) {
  const [form, setForm] = useState({
    session_type: 'Portrait',
    duration_hours: 2,
    travel_miles: 0,
    num_deliverables: 50,
    market_location: 'US',
    experience_years: 3
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const handleCalculate = async () => {
    setLoading(true); setResult(null);
    try {
      const res = await axios.post(`${API}/api/ai/pricing-estimate`, form, { headers });
      setResult(res.data);
      toast.success('Pricing estimate ready!');
    } catch (err) {
      toast.error('Pricing calculation failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>AI Pricing Calculator</h1><p>Get AI-powered pricing recommendations based on your session details and market positioning</p></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1.5fr' : '1fr', gap: 24 }}>
        <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 8, border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 20px' }}>Session Details</h3>
          <div className="form-group">
            <label>Session Type</label>
            <select value={form.session_type} onChange={e => setForm({...form, session_type: e.target.value})}>
              <option>Portrait</option><option>Wedding</option><option>Corporate</option><option>Commercial</option>
              <option>Family</option><option>Fashion</option><option>Event</option><option>Real Estate</option>
              <option>Product</option><option>Maternity</option><option>Engagement</option><option>Sports</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Duration (hours)</label>
              <input type="number" min="0.5" step="0.5" value={form.duration_hours} onChange={e => setForm({...form, duration_hours: parseFloat(e.target.value) || 1})} />
            </div>
            <div className="form-group">
              <label>Travel Distance (miles)</label>
              <input type="number" min="0" value={form.travel_miles} onChange={e => setForm({...form, travel_miles: parseInt(e.target.value) || 0})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Deliverables (edited photos)</label>
              <input type="number" min="1" value={form.num_deliverables} onChange={e => setForm({...form, num_deliverables: parseInt(e.target.value) || 25})} />
            </div>
            <div className="form-group">
              <label>Experience (years)</label>
              <input type="number" min="0" value={form.experience_years} onChange={e => setForm({...form, experience_years: parseInt(e.target.value) || 1})} />
            </div>
          </div>
          <div className="form-group">
            <label>Market / Location</label>
            <input value={form.market_location} onChange={e => setForm({...form, market_location: e.target.value})} placeholder="e.g. New York, NY" />
          </div>
          <button className="btn btn-primary btn-full" onClick={handleCalculate} disabled={loading}>
            {loading ? 'Calculating...' : 'Calculate AI Pricing'}
          </button>
        </div>

        {result && (
          <div>
            {/* Main price card */}
            <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>Recommended Price</div>
              <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--success)' }}>${(result.recommended_price || 0).toLocaleString()}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Range: ${(result.price_range?.minimum || 0).toLocaleString()} – ${(result.price_range?.maximum || 0).toLocaleString()}
              </div>
              <span style={{ display: 'inline-block', marginTop: 12, padding: '4px 16px', borderRadius: 20, background: positioningColor(result.market_positioning), color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>
                {result.market_positioning} Market
              </span>
            </div>

            {/* Breakdown */}
            {result.pricing_breakdown && Object.keys(result.pricing_breakdown).length > 0 && (
              <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 12px' }}>Price Breakdown</h4>
                {Object.entries(result.pricing_breakdown).map(([key, value]) => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: 600 }}>${(value || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {result.competitive_analysis && (
              <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <strong>Market Analysis:</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{result.competitive_analysis}</p>
              </div>
            )}

            {result.upsell_opportunities?.length > 0 && (
              <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 8px' }}>Upsell Opportunities</h4>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {result.upsell_opportunities.map((u, i) => <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>{u}</li>)}
                </ul>
              </div>
            )}

            {result.package_suggestion && (
              <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 8 }}>
                <strong>Package Suggestion:</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 }}>{result.package_suggestion}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
