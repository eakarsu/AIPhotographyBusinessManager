import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyTemplate = { name: '', category: 'General', subject: '', body: '', variables: '', status: 'Active' };

export default function EmailTemplates({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyTemplate);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/emails`, { headers });
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load email templates');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/emails/${form.id}`, form, { headers });
        toast.success('Template updated');
      } else {
        await axios.post(`${API}/api/emails`, form, { headers });
        toast.success('Template created');
      }
      setShowForm(false); setForm(emptyTemplate); setEditing(false); setSelected(null);
      fetchData();
    } catch (err) { toast.error('Failed to save template'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`${API}/api/emails/${id}`, { headers });
      toast.success('Template deleted'); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleEdit = (item) => { setForm(item); setEditing(true); setShowForm(true); setSelected(null); };
  const handleNew = () => { setForm(emptyTemplate); setEditing(false); setShowForm(true); };

  const statusBadge = (s) => {
    const m = { Active: 'badge-success', Inactive: 'badge-warning', Draft: 'badge-draft' };
    return m[s] || 'badge-draft';
  };

  const categoryBadge = (c) => {
    const m = { Booking: 'badge-info', Delivery: 'badge-success', Billing: 'badge-warning', Contract: 'badge-purple', 'Follow-up': 'badge-info', Marketing: 'badge-success', Onboarding: 'badge-purple' };
    return m[c] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading email templates...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Email Templates</h1><p>Manage client communication templates</p></div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Template</button>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div><h2>{selected.name}</h2><span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span></div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Category</label><div className="value"><span className={`badge ${categoryBadge(selected.category)}`}>{selected.category}</span></div></div>
            <div className="detail-field"><label>Subject</label><div className="value">{selected.subject}</div></div>
          </div>
          {selected.body && (
            <div style={{ marginTop: 20, padding: 20, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.8 }}>
              {selected.body}
            </div>
          )}
          {selected.variables && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Variables</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selected.variables.split(',').map((v, i) => (
                  <span key={i} style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(108,92,231,0.1)', fontSize: 13 }}>
                    {v.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Category</th><th>Subject</th><th>Status</th></tr></thead>
          <tbody>
            {items.map(t => (
              <tr key={t.id} onClick={() => setSelected(t)}>
                <td style={{ fontWeight: 600 }}>{t.name}</td>
                <td><span className={`badge ${categoryBadge(t.category)}`}>{t.category}</span></td>
                <td>{t.subject}</td>
                <td><span className={`badge ${statusBadge(t.status)}`}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Template' : 'New Template'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyTemplate); }}
          footer={<><button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-group"><label>Name</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Template name" /></div>
          <div className="form-group"><label>Subject</label><input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Email subject line" /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option>Booking</option><option>Delivery</option><option>Billing</option><option>Contract</option>
                <option>Follow-up</option><option>Marketing</option><option>Onboarding</option><option>General</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Active</option><option>Inactive</option><option>Draft</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Body</label>
            <textarea value={form.body} onChange={e => setForm({...form, body: e.target.value})} placeholder="Email body content..." style={{ minHeight: 200 }} />
          </div>
          <div className="form-group"><label>Variables (comma separated)</label><input value={form.variables} onChange={e => setForm({...form, variables: e.target.value})} placeholder="e.g. client_name, shoot_date, package_name" /></div>
        </Modal>
      )}
    </div>
  );
}
