import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyWorkflow = { title: '', client_id: '', workflow_type: 'Standard', current_step: 1, due_date: '', priority: 'Medium', status: 'In Progress', notes: '' };

export default function Workflows({ token }) {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyWorkflow);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [wRes, cRes] = await Promise.all([
        axios.get(`${API}/api/workflows`, { headers }),
        axios.get(`${API}/api/clients`, { headers })
      ]);
      setItems(wRes.data);
      setClients(cRes.data);
    } catch (err) {
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/workflows/${form.id}`, form, { headers });
        toast.success('Workflow updated');
      } else {
        await axios.post(`${API}/api/workflows`, form, { headers });
        toast.success('Workflow created');
      }
      setShowForm(false); setForm(emptyWorkflow); setEditing(false); setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save workflow');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this workflow?')) return;
    try {
      await axios.delete(`${API}/api/workflows/${id}`, { headers });
      toast.success('Workflow deleted');
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete workflow');
    }
  };

  const handleEdit = (item) => { setForm(item); setEditing(true); setShowForm(true); setSelected(null); };
  const handleNew = () => { setForm(emptyWorkflow); setEditing(false); setShowForm(true); };

  const parseSteps = (steps) => typeof steps === 'string' ? JSON.parse(steps) : steps || [];

  const statusBadge = (s) => {
    const m = { 'Not Started': 'badge-draft', 'In Progress': 'badge-info', 'On Hold': 'badge-warning', Completed: 'badge-success' };
    return m[s] || 'badge-draft';
  };

  const priorityBadge = (p) => {
    const m = { Low: 'badge-draft', Medium: 'badge-info', High: 'badge-warning', Urgent: 'badge-danger' };
    return m[p] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading workflows...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Workflows</h1><p>Track project workflows and production pipeline</p></div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Workflow</button>
      </div>

      {selected && (() => {
        const steps = parseSteps(selected.steps);
        return (
          <div className="detail-view">
            <div className="detail-header">
              <div>
                <h2>{selected.title}</h2>
                <span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span>
              </div>
              <div className="detail-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
              </div>
            </div>
            <div className="detail-grid">
              <div className="detail-field"><label>Client</label><div className="value">{selected.client_name || 'N/A'}</div></div>
              <div className="detail-field"><label>Type</label><div className="value">{selected.workflow_type}</div></div>
              <div className="detail-field"><label>Priority</label><div className="value"><span className={`badge ${priorityBadge(selected.priority)}`}>{selected.priority}</span></div></div>
              <div className="detail-field"><label>Due Date</label><div className="value">{selected.due_date ? new Date(selected.due_date).toLocaleDateString() : 'TBD'}</div></div>
              <div className="detail-field"><label>Progress</label><div className="value">Step {selected.current_step} of {steps.length}</div></div>
              <div className="detail-field"><label>Notes</label><div className="value">{selected.notes || 'No notes'}</div></div>
            </div>

            {steps.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <label style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>Step Tracker</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', padding: '0.5rem 0' }}>
                  {steps.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isCompleted = stepNum < selected.current_step;
                    const isCurrent = stepNum === selected.current_step;
                    const circleColor = isCompleted ? '#22c55e' : isCurrent ? '#8b5cf6' : '#9ca3af';
                    const textColor = isCompleted ? '#22c55e' : isCurrent ? '#8b5cf6' : '#6b7280';
                    const lineColor = isCompleted ? '#22c55e' : '#e5e7eb';
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            backgroundColor: (isCompleted || isCurrent) ? circleColor : 'transparent',
                            border: `3px solid ${circleColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: (isCompleted || isCurrent) ? '#fff' : '#9ca3af',
                            fontWeight: 700, fontSize: '0.8rem'
                          }}>
                            {isCompleted ? '\u2713' : stepNum}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: textColor, marginTop: '0.35rem', textAlign: 'center', fontWeight: isCurrent ? 600 : 400 }}>
                            {step}
                          </span>
                        </div>
                        {idx < steps.length - 1 && (
                          <div style={{ width: '40px', height: '3px', backgroundColor: lineColor, marginBottom: '1.2rem' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Client</th><th>Type</th><th>Progress</th><th>Priority</th><th>Due Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.map(w => {
              const steps = parseSteps(w.steps);
              return (
                <tr key={w.id} onClick={() => setSelected(w)}>
                  <td style={{ fontWeight: 600 }}>{w.title}</td>
                  <td>{w.client_name || 'N/A'}</td>
                  <td>{w.workflow_type}</td>
                  <td>Step {w.current_step} of {steps.length}</td>
                  <td><span className={`badge ${priorityBadge(w.priority)}`}>{w.priority}</span></td>
                  <td>{w.due_date ? new Date(w.due_date).toLocaleDateString() : 'TBD'}</td>
                  <td><span className={`badge ${statusBadge(w.status)}`}>{w.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Workflow' : 'New Workflow'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyWorkflow); }}
          footer={<><button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Workflow title" /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Client</label>
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Workflow Type</label>
              <select value={form.workflow_type} onChange={e => setForm({...form, workflow_type: e.target.value})}>
                <option>Standard</option><option>Wedding</option><option>Corporate</option><option>Commercial</option><option>Portrait</option><option>Fashion</option><option>Event</option><option>Sports</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Current Step</label><input type="number" min="1" value={form.current_step} onChange={e => setForm({...form, current_step: parseInt(e.target.value) || 1})} /></div>
            <div className="form-group"><label>Due Date</label><input type="date" value={form.due_date ? form.due_date.substring(0, 10) : ''} onChange={e => setForm({...form, due_date: e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Not Started</option><option>In Progress</option><option>On Hold</option><option>Completed</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Workflow notes..." /></div>
        </Modal>
      )}
    </div>
  );
}
