import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import AIOutput from '../components/AIOutput';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyEdit = { photo_name: '', edit_type: 'Auto-Enhance', original_settings: {}, status: 'Pending' };

export default function AIEditing({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyEdit);
  const [editing, setEditing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [cullResult, setCullResult] = useState(null);
  const [cullLoading, setCullLoading] = useState(false);
  const [insightResult, setInsightResult] = useState(null);
  const [insightLoading, setInsightLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/ai/edits`, { headers });
      setItems(res.data);
    } catch (err) { toast.error('Failed to load AI edits'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/ai/edits/${form.id}`, form, { headers });
        toast.success('AI edit updated');
      } else {
        await axios.post(`${API}/api/ai/edits`, form, { headers });
        toast.success('AI edit created');
      }
      setShowForm(false); setForm(emptyEdit); setEditing(false); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to save'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this AI edit?')) return;
    try {
      await axios.delete(`${API}/api/ai/edits/${id}`, { headers }); toast.success('Deleted'); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleEdit = (item) => { setForm(item); setEditing(true); setShowForm(true); setSelected(null); };
  const handleNew = () => { setForm(emptyEdit); setEditing(false); setShowForm(true); };

  const analyzePhoto = async () => {
    setAiLoading(true); setAiResult(null);
    try {
      const res = await axios.post(`${API}/api/ai/analyze-photo`, {
        photo_name: form.photo_name,
        edit_type: form.edit_type,
        description: `Photo requiring ${form.edit_type} editing`
      }, { headers });
      setAiResult(res.data);
      toast.success('AI analysis complete!');
    } catch (err) { toast.error('AI analysis failed'); }
    finally { setAiLoading(false); }
  };

  const runAutoCull = async () => {
    setCullLoading(true); setCullResult(null);
    const photos = items.slice(0, 10).map(i => i.photo_name);
    try {
      const res = await axios.post(`${API}/api/ai/auto-cull`, { photos }, { headers });
      setCullResult(res.data);
      toast.success('Auto-culling complete!');
    } catch (err) { toast.error('Auto-cull failed'); }
    finally { setCullLoading(false); }
  };

  const getBusinessInsights = async () => {
    setInsightLoading(true); setInsightResult(null);
    try {
      const res = await axios.post(`${API}/api/ai/business-insights`, {}, { headers });
      setInsightResult(res.data);
      toast.success('Business insights ready!');
    } catch (err) { toast.error('Failed to get insights'); }
    finally { setInsightLoading(false); }
  };

  const statusBadge = (s) => {
    const m = { Completed: 'badge-success', Processing: 'badge-warning', Pending: 'badge-info' };
    return m[s] || 'badge-draft';
  };

  const parseSettings = (s) => {
    if (!s) return {};
    if (typeof s === 'string') try { return JSON.parse(s); } catch { return {}; }
    return s;
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading AI edits...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>AI Auto-Culling & Editing</h1><p>AI-powered photo analysis, culling, and editing suggestions</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-success" onClick={runAutoCull} disabled={cullLoading}>
            {cullLoading ? '🔄 Culling...' : '🎯 Auto-Cull Photos'}
          </button>
          <button className="btn btn-secondary" onClick={getBusinessInsights} disabled={insightLoading}>
            {insightLoading ? '🔄 Analyzing...' : '📊 Business Insights'}
          </button>
          <button className="btn btn-primary" onClick={handleNew}>+ New AI Edit</button>
        </div>
      </div>

      {cullResult && (
        <AIOutput
          response={cullResult.culling_results}
          model={cullResult.model_used}
          tokens={cullResult.tokens_used}
          title={`Auto-Cull Results (${cullResult.photos_reviewed} photos)`}
        />
      )}

      {insightResult && (
        <div style={{ marginTop: 20 }}>
          <div className="dashboard-grid" style={{ marginBottom: 16 }}>
            <div className="stat-card"><div className="card-icon">👥</div><h3>Clients</h3><div className="stat-value">{insightResult.metrics?.clients}</div></div>
            <div className="stat-card"><div className="card-icon">📅</div><h3>Shoots</h3><div className="stat-value">{insightResult.metrics?.shoots}</div></div>
            <div className="stat-card"><div className="card-icon">💰</div><h3>Revenue</h3><div className="stat-value">${insightResult.metrics?.revenue?.toLocaleString()}</div></div>
            <div className="stat-card"><div className="card-icon">🖼️</div><h3>Galleries</h3><div className="stat-value">{insightResult.metrics?.galleries}</div></div>
          </div>
          <AIOutput response={insightResult.insights} model={insightResult.model_used} tokens={insightResult.tokens_used} title="AI Business Insights" />
        </div>
      )}

      {selected && (
        <div className="detail-view" style={{ marginTop: 20 }}>
          <div className="detail-header">
            <div><h2>{selected.photo_name}</h2><span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span></div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Edit Type</label><div className="value">{selected.edit_type}</div></div>
            <div className="detail-field"><label>Status</label><div className="value">{selected.status}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{new Date(selected.created_at).toLocaleDateString()}</div></div>
          </div>
          {selected.original_settings && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Original Settings</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(parseSettings(selected.original_settings)).map(([k, v]) => (
                  <span key={k} style={{ padding: '6px 12px', background: 'var(--bg-input)', borderRadius: 20, fontSize: 12 }}>
                    <strong>{k}:</strong> {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {selected.ai_suggestions && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>AI Suggestions</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(parseSettings(selected.ai_suggestions)).map(([k, v]) => (
                  <span key={k} style={{ padding: '6px 12px', background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)', borderRadius: 20, fontSize: 12, color: 'var(--accent-secondary)' }}>
                    <strong>{k}:</strong> {String(v)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="data-table-container" style={{ marginTop: 20 }}>
        <table className="data-table">
          <thead><tr><th>Photo</th><th>Edit Type</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {items.map(e => (
              <tr key={e.id} onClick={() => setSelected(e)}>
                <td style={{ fontWeight: 600 }}>{e.photo_name}</td>
                <td><span className="badge badge-purple">{e.edit_type}</span></td>
                <td><span className={`badge ${statusBadge(e.status)}`}>{e.status}</span></td>
                <td>{new Date(e.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit AI Edit' : 'New AI Edit'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyEdit); setAiResult(null); }}
          footer={<><button className="btn btn-secondary" onClick={() => { setShowForm(false); setAiResult(null); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-group"><label>Photo Name</label><input value={form.photo_name} onChange={e => setForm({...form, photo_name: e.target.value})} placeholder="e.g. IMG_1234.CR2" /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Edit Type</label>
              <select value={form.edit_type} onChange={e => setForm({...form, edit_type: e.target.value})}>
                <option>Auto-Enhance</option><option>Portrait Retouch</option><option>Color Correction</option>
                <option>HDR Merge</option><option>Low Light Fix</option><option>Background Remove</option>
                <option>Fashion Grade</option><option>Food Enhancement</option><option>Golden Hour Enhance</option>
                <option>Sports Action</option><option>Urban Edit</option><option>Architecture Correct</option>
                <option>Pet Portrait</option><option>Concert Grade</option><option>Lifestyle Preset</option><option>Romantic Edit</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Pending</option><option>Processing</option><option>Completed</option>
              </select>
            </div>
          </div>
          <button className="btn btn-success btn-full" onClick={analyzePhoto} disabled={aiLoading || !form.photo_name} style={{ marginBottom: 16 }}>
            {aiLoading ? '🤖 Analyzing...' : '🤖 Analyze Photo with AI'}
          </button>
          <AIOutput response={aiResult?.analysis} model={aiResult?.model_used} tokens={aiResult?.tokens_used} loading={aiLoading} title="AI Photo Analysis" />
        </Modal>
      )}
    </div>
  );
}
