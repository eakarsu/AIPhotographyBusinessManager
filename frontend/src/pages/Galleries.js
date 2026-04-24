import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyGallery = { title: '', client_id: '', description: '', photo_count: 0, status: 'Draft', delivery_date: '', access_password: '' };

export default function Galleries({ token }) {
  const [items, setItems] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyGallery);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [gRes, cRes] = await Promise.all([
        axios.get(`${API}/api/galleries`, { headers }),
        axios.get(`${API}/api/clients`, { headers })
      ]);
      setItems(gRes.data);
      setClients(cRes.data);
    } catch (err) {
      toast.error('Failed to load galleries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/galleries/${form.id}`, form, { headers });
        toast.success('Gallery updated');
      } else {
        await axios.post(`${API}/api/galleries`, form, { headers });
        toast.success('Gallery created');
      }
      setShowForm(false); setForm(emptyGallery); setEditing(false); setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save gallery');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this gallery?')) return;
    try {
      await axios.delete(`${API}/api/galleries/${id}`, { headers });
      toast.success('Gallery deleted');
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete gallery');
    }
  };

  const handleEdit = (item) => { setForm(item); setEditing(true); setShowForm(true); setSelected(null); };
  const handleNew = () => { setForm(emptyGallery); setEditing(false); setShowForm(true); };

  const statusBadge = (s) => {
    const m = { Delivered: 'badge-success', 'In Review': 'badge-warning', Editing: 'badge-info', Draft: 'badge-draft' };
    return m[s] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading galleries...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Galleries</h1><p>Client photo gallery delivery</p></div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Gallery</button>
      </div>

      {selected && (
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
            <div className="detail-field"><label>Photos</label><div className="value">{selected.photo_count}</div></div>
            <div className="detail-field"><label>Delivery Date</label><div className="value">{selected.delivery_date ? new Date(selected.delivery_date).toLocaleDateString() : 'TBD'}</div></div>
            <div className="detail-field"><label>Access Password</label><div className="value">{selected.access_password || 'None'}</div></div>
            <div className="detail-field"><label>Description</label><div className="value">{selected.description || 'No description'}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{new Date(selected.created_at).toLocaleDateString()}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Client</th><th>Photos</th><th>Status</th><th>Delivery Date</th></tr>
          </thead>
          <tbody>
            {items.map(g => (
              <tr key={g.id} onClick={() => setSelected(g)}>
                <td style={{ fontWeight: 600 }}>{g.title}</td>
                <td>{g.client_name || 'N/A'}</td>
                <td>{g.photo_count}</td>
                <td><span className={`badge ${statusBadge(g.status)}`}>{g.status}</span></td>
                <td>{g.delivery_date ? new Date(g.delivery_date).toLocaleDateString() : 'TBD'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Gallery' : 'New Gallery'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyGallery); }}
          footer={<><button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Gallery title" /></div>
          <div className="form-row">
            <div className="form-group">
              <label>Client</label>
              <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Photo Count</label><input type="number" value={form.photo_count} onChange={e => setForm({...form, photo_count: parseInt(e.target.value) || 0})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Draft</option><option>Editing</option><option>In Review</option><option>Delivered</option>
              </select>
            </div>
            <div className="form-group"><label>Delivery Date</label><input type="date" value={form.delivery_date ? form.delivery_date.substring(0, 10) : ''} onChange={e => setForm({...form, delivery_date: e.target.value})} /></div>
          </div>
          <div className="form-group"><label>Access Password</label><input value={form.access_password || ''} onChange={e => setForm({...form, access_password: e.target.value})} placeholder="Gallery access password" /></div>
          <div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Gallery description..." /></div>
        </Modal>
      )}
    </div>
  );
}
