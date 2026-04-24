import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyTask = { title: '', category: 'General', description: '', due_date: '', priority: 'Medium', related_shoot: '', status: 'To Do' };

export default function Tasks({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyTask);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/tasks`, { headers });
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/tasks/${form.id}`, form, { headers });
        toast.success('Task updated');
      } else {
        await axios.post(`${API}/api/tasks`, form, { headers });
        toast.success('Task created');
      }
      setShowForm(false);
      setForm(emptyTask);
      setEditing(false);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save task');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await axios.delete(`${API}/api/tasks/${id}`, { headers });
      toast.success('Task deleted');
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete task');
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyTask);
    setEditing(false);
    setShowForm(true);
  };

  const handleToggle = async (item) => {
    const newStatus = item.status === 'Completed' ? 'To Do' : 'Completed';
    try {
      await axios.put(`${API}/api/tasks/${item.id}`, { ...item, status: newStatus }, { headers });
      toast.success(newStatus === 'Completed' ? 'Task completed!' : 'Task reopened');
      fetchData();
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const statusBadge = (s) => {
    const map = { 'To Do': 'badge-info', 'In Progress': 'badge-warning', 'Completed': 'badge-success', 'On Hold': 'badge-draft' };
    return map[s] || 'badge-draft';
  };

  const priorityColor = (p) => {
    const map = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' };
    return map[p] || '#6b7280';
  };

  const todoCount = items.filter(t => t.status === 'To Do').length;
  const inProgressCount = items.filter(t => t.status === 'In Progress').length;
  const completedCount = items.filter(t => t.status === 'Completed').length;
  const overdueCount = items.filter(t => {
    if (!t.due_date || t.status === 'Completed') return false;
    return new Date(t.due_date) < new Date();
  }).length;

  if (loading) return <div className="loading"><div className="spinner"></div> Loading tasks...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tasks</h1>
          <p>Manage your to-do list and task priorities</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ Add Task</button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>To Do</h3>
          <div className="stat-value">{todoCount}</div>
        </div>
        <div className="stat-card">
          <h3>In Progress</h3>
          <div className="stat-value">{inProgressCount}</div>
        </div>
        <div className="stat-card">
          <h3>Completed</h3>
          <div className="stat-value">{completedCount}</div>
        </div>
        <div className="stat-card">
          <h3>Overdue</h3>
          <div className="stat-value" style={{ color: overdueCount > 0 ? '#ef4444' : 'inherit' }}>{overdueCount}</div>
        </div>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.title}</h2>
              <span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleToggle(selected)}>
                {selected.status === 'Completed' ? 'Reopen' : 'Complete'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Priority</label><div className="value" style={{ color: priorityColor(selected.priority), fontWeight: 700 }}>{selected.priority}</div></div>
            <div className="detail-field"><label>Due Date</label><div className="value">{selected.due_date ? new Date(selected.due_date).toLocaleDateString() : 'No deadline'}</div></div>
            <div className="detail-field"><label>Related Shoot</label><div className="value">{selected.related_shoot || 'None'}</div></div>
            <div className="detail-field"><label>Description</label><div className="value">{selected.description || 'No description'}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'N/A'}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Task</th>
              <th>Category</th>
              <th>Priority</th>
              <th>Due Date</th>
              <th>Related Shoot</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(t => {
              const isOverdue = t.due_date && t.status !== 'Completed' && new Date(t.due_date) < new Date();
              return (
                <tr key={t.id} onClick={() => setSelected(t)} style={{ opacity: t.status === 'Completed' ? 0.6 : 1 }}>
                  <td onClick={e => { e.stopPropagation(); handleToggle(t); }} style={{ cursor: 'pointer', textAlign: 'center', fontSize: 18 }}>
                    {t.status === 'Completed' ? '\u2705' : '\u2B1C'}
                  </td>
                  <td style={{ fontWeight: 600, textDecoration: t.status === 'Completed' ? 'line-through' : 'none' }}>{t.title}</td>
                  <td>{t.category}</td>
                  <td style={{ color: priorityColor(t.priority), fontWeight: 600 }}>{t.priority}</td>
                  <td style={{ color: isOverdue ? '#ef4444' : 'inherit', fontWeight: isOverdue ? 600 : 400 }}>
                    {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No deadline'}
                    {isOverdue && ' (overdue)'}
                  </td>
                  <td>{t.related_shoot || 'N/A'}</td>
                  <td><span className={`badge ${statusBadge(t.status)}`}>{t.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Task' : 'New Task'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyTask); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyTask); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Task title" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option>General</option><option>Editing</option><option>Delivery</option><option>Communication</option>
                <option>Accounting</option><option>Marketing</option><option>Equipment</option><option>Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option>High</option><option>Medium</option><option>Low</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Due Date</label>
              <input type="date" value={form.due_date ? form.due_date.substring(0, 10) : ''} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>To Do</option><option>In Progress</option><option>Completed</option><option>On Hold</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Related Shoot</label>
            <input value={form.related_shoot} onChange={e => setForm({...form, related_shoot: e.target.value})} placeholder="Related shoot name (optional)" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Task description..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
