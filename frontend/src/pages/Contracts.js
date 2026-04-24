import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import AIOutput from '../components/AIOutput';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyContract = { title: '', client_id: '', contract_type: 'Standard', content: '', amount: 0, status: 'Draft', valid_until: '' };

export default function Contracts({ token }) {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyContract);
  const [editing, setEditing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [cRes, clRes] = await Promise.all([
        axios.get(`${API}/api/contracts`, { headers }),
        axios.get(`${API}/api/clients`, { headers })
      ]);
      setItems(cRes.data);
      setClients(clRes.data);
    } catch (err) {
      toast.error('Failed to load contracts');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/contracts/${form.id}`, form, { headers });
        toast.success('Contract updated');
      } else {
        await axios.post(`${API}/api/contracts`, form, { headers });
        toast.success('Contract created');
      }
      setShowForm(false); setForm(emptyContract); setEditing(false); setSelected(null);
      fetchData();
    } catch (err) { toast.error('Failed to save contract'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contract?')) return;
    try {
      await axios.delete(`${API}/api/contracts/${id}`, { headers });
      toast.success('Contract deleted'); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleEdit = (item) => { setForm(item); setEditing(true); setShowForm(true); setSelected(null); };
  const handleNew = () => { setForm(emptyContract); setEditing(false); setShowForm(true); };

  const generateAIContract = async () => {
    setAiLoading(true); setAiResult(null);
    try {
      const clientName = clients.find(c => c.id === parseInt(form.client_id))?.name || 'Client';
      const res = await axios.post(`${API}/api/ai/generate-contract`, {
        client_name: clientName,
        shoot_type: form.contract_type,
        amount: form.amount,
      }, { headers });
      setAiResult(res.data);
      setForm({ ...form, content: res.data.generated_contract });
      toast.success('AI contract generated!');
    } catch (err) { toast.error('AI generation failed'); }
    finally { setAiLoading(false); }
  };

  const statusBadge = (s) => {
    const m = { Signed: 'badge-success', Active: 'badge-info', Draft: 'badge-draft', Expired: 'badge-danger' };
    return m[s] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading contracts...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Contracts</h1><p>Manage photography contracts with AI generation</p></div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Contract</button>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div><h2>{selected.title}</h2><span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span></div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Client</label><div className="value">{selected.client_name || 'N/A'}</div></div>
            <div className="detail-field"><label>Type</label><div className="value">{selected.contract_type}</div></div>
            <div className="detail-field"><label>Amount</label><div className="value">${parseFloat(selected.amount).toLocaleString()}</div></div>
            <div className="detail-field"><label>Valid Until</label><div className="value">{selected.valid_until ? new Date(selected.valid_until).toLocaleDateString() : 'N/A'}</div></div>
          </div>
          {selected.content && (
            <div style={{ marginTop: 20, padding: 20, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8 }}>
              {selected.content}
            </div>
          )}
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Client</th><th>Type</th><th>Amount</th><th>Status</th><th>Valid Until</th></tr></thead>
          <tbody>
            {items.map(c => (
              <tr key={c.id} onClick={() => setSelected(c)}>
                <td style={{ fontWeight: 600 }}>{c.title}</td>
                <td>{c.client_name || 'N/A'}</td>
                <td>{c.contract_type}</td>
                <td>${parseFloat(c.amount).toLocaleString()}</td>
                <td><span className={`badge ${statusBadge(c.status)}`}>{c.status}</span></td>
                <td>{c.valid_until ? new Date(c.valid_until).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Contract' : 'New Contract'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyContract); setAiResult(null); }}
          footer={<><button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setAiResult(null); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Contract title" /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Client</label>
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.contract_type} onChange={e => setForm({...form, contract_type: e.target.value})}>
                <option>Standard</option><option>Wedding</option><option>Corporate</option><option>Commercial</option>
                <option>Portrait</option><option>Fashion</option><option>Event</option><option>Sports</option><option>Fine Art</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Amount ($)</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} /></div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Draft</option><option>Signed</option><option>Active</option><option>Expired</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Valid Until</label><input type="date" value={form.valid_until ? form.valid_until.substring(0, 10) : ''} onChange={e => setForm({...form, valid_until: e.target.value})} /></div>
          <button className="btn btn-success btn-full" onClick={generateAIContract} disabled={aiLoading} style={{ marginBottom: 16 }}>
            {aiLoading ? '🤖 Generating...' : '🤖 Generate Contract with AI'}
          </button>
          <AIOutput response={aiResult?.generated_contract} model={aiResult?.model_used} tokens={aiResult?.tokens_used} loading={aiLoading} title="AI Generated Contract" />
          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Contract Content</label>
            <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="Contract content..." style={{ minHeight: 200 }} />
          </div>
        </Modal>
      )}
    </div>
  );
}
