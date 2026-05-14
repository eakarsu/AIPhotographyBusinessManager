import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AIOutput from '../components/AIOutput';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function ShootPlanOptimize({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [form, setForm] = useState({
    title: '',
    type: 'Wedding',
    location: '',
    shoot_date: '',
    duration_hours: 4,
    crew_size: 2,
    budget: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleChange = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post(`${API}/api/ai/shoot-plan-optimize`, form, { headers });
      setResult(res.data);
      toast.success('Shoot plan generated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to optimize shoot plan');
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Shoot Plan Optimizer</h1>
        <p>AI-generated timeline, crew, location, equipment, and weather contingencies</p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label>Shoot Title</label>
              <input value={form.title} onChange={e => handleChange('title', e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={e => handleChange('type', e.target.value)}>
                {['Wedding', 'Portrait', 'Event', 'Commercial', 'Product', 'Family', 'Newborn', 'Real Estate'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={form.location} onChange={e => handleChange('location', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Shoot Date</label>
              <input type="date" value={form.shoot_date} onChange={e => handleChange('shoot_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Duration (hours)</label>
              <input type="number" min={1} value={form.duration_hours} onChange={e => handleChange('duration_hours', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Crew Size</label>
              <input type="number" min={1} value={form.crew_size} onChange={e => handleChange('crew_size', Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Budget ($)</label>
              <input type="number" value={form.budget} onChange={e => handleChange('budget', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes / Brief</label>
            <textarea rows={4} value={form.notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Goals, must-have shots, deliverables, special requests..." />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generating...' : 'Optimize Shoot Plan'}
          </button>
        </form>
      </div>

      {loading && <div style={{ padding: 24, textAlign: 'center' }}>AI working on your plan...</div>}

      {result && (
        <div className="card" style={{ padding: 24 }}>
          <h2>Generated Shoot Plan</h2>
          {result.parsed && (
            <pre style={{ background: '#f9f9f9', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 13 }}>
              {JSON.stringify(result.parsed, null, 2)}
            </pre>
          )}
          <AIOutput response={result.content} model={result.model} tokens={result.usage} title="Shoot Plan" />
        </div>
      )}
    </div>
  );
}
