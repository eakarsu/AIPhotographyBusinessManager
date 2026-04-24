import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyShoot = { title: '', client_id: '', shoot_date: '', start_time: '', end_time: '', location: '', shoot_type: 'Portrait', status: 'Scheduled', notes: '', package_name: '', price: 0 };

export default function Shoots({ token }) {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyShoot);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [sRes, cRes] = await Promise.all([
        axios.get(`${API}/api/shoots`, { headers }),
        axios.get(`${API}/api/clients`, { headers })
      ]);
      setItems(sRes.data); setClients(cRes.data);
    } catch (err) { toast.error('Failed to load shoots'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/shoots/${form.id}`, form, { headers });
        toast.success('Shoot updated');
      } else {
        await axios.post(`${API}/api/shoots`, form, { headers });
        toast.success('Shoot created');
      }
      setShowForm(false); setForm(emptyShoot); setEditing(false); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to save shoot'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this shoot?')) return;
    try {
      await axios.delete(`${API}/api/shoots/${id}`, { headers }); toast.success('Shoot deleted'); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleEdit = (item) => { setForm(item); setEditing(true); setShowForm(true); setSelected(null); };
  const handleNew = () => { setForm(emptyShoot); setEditing(false); setShowForm(true); };

  const statusBadge = (s) => {
    const m = { Completed: 'badge-success', Scheduled: 'badge-info', Cancelled: 'badge-danger', 'In Progress': 'badge-warning' };
    return m[s] || 'badge-draft';
  };

  const typeBadge = (t) => {
    const m = { Wedding: 'badge-success', Corporate: 'badge-info', Commercial: 'badge-warning', Fashion: 'badge-purple', Portrait: 'badge-info', Event: 'badge-warning', Sports: 'badge-danger' };
    return m[t] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading shoots...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Shoot Scheduling</h1><p>Manage photography sessions and events</p></div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Shoot</button>
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
            <div className="detail-field"><label>Date</label><div className="value">{selected.shoot_date ? new Date(selected.shoot_date).toLocaleDateString() : 'TBD'}</div></div>
            <div className="detail-field"><label>Time</label><div className="value">{selected.start_time} - {selected.end_time}</div></div>
            <div className="detail-field"><label>Location</label><div className="value">{selected.location || 'TBD'}</div></div>
            <div className="detail-field"><label>Type</label><div className="value"><span className={`badge ${typeBadge(selected.shoot_type)}`}>{selected.shoot_type}</span></div></div>
            <div className="detail-field"><label>Package</label><div className="value">{selected.package_name || 'N/A'}</div></div>
            <div className="detail-field"><label>Price</label><div className="value" style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>${parseFloat(selected.price || 0).toLocaleString()}</div></div>
            <div className="detail-field"><label>Notes</label><div className="value">{selected.notes || 'No notes'}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Title</th><th>Client</th><th>Date</th><th>Type</th><th>Location</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>
            {items.map(s => (
              <tr key={s.id} onClick={() => setSelected(s)}>
                <td style={{ fontWeight: 600 }}>{s.title}</td>
                <td>{s.client_name || 'N/A'}</td>
                <td>{s.shoot_date ? new Date(s.shoot_date).toLocaleDateString() : 'TBD'}</td>
                <td><span className={`badge ${typeBadge(s.shoot_type)}`}>{s.shoot_type}</span></td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.location}</td>
                <td>${parseFloat(s.price || 0).toLocaleString()}</td>
                <td><span className={`badge ${statusBadge(s.status)}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Shoot' : 'New Shoot'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyShoot); }}
          footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Shoot title" /></div>
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
              <select value={form.shoot_type} onChange={e => setForm({...form, shoot_type: e.target.value})}>
                <option>Portrait</option><option>Wedding</option><option>Corporate</option><option>Commercial</option>
                <option>Fashion</option><option>Family</option><option>Event</option><option>Sports</option>
                <option>Maternity</option><option>Engagement</option><option>Real Estate</option><option>Food</option>
                <option>Product</option><option>Architecture</option><option>Pet</option><option>Fine Art</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Date</label><input type="date" value={form.shoot_date ? form.shoot_date.substring(0, 10) : ''} onChange={e => setForm({...form, shoot_date: e.target.value})} /></div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Scheduled</option><option>In Progress</option><option>Completed</option><option>Cancelled</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Start Time</label><input type="time" value={form.start_time || ''} onChange={e => setForm({...form, start_time: e.target.value})} /></div>
            <div className="form-group"><label>End Time</label><input type="time" value={form.end_time || ''} onChange={e => setForm({...form, end_time: e.target.value})} /></div>
          </div>
          <div className="form-group"><label>Location</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Shoot location" /></div>
          <div className="form-row">
            <div className="form-group"><label>Package</label><input value={form.package_name || ''} onChange={e => setForm({...form, package_name: e.target.value})} placeholder="Package name" /></div>
            <div className="form-group"><label>Price ($)</label><input type="number" value={form.price} onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})} /></div>
          </div>
          <div className="form-group"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Shoot notes..." /></div>
        </Modal>
      )}
    </div>
  );
}
