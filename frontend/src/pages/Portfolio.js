import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyPortfolio = { title: '', category: 'Portrait', description: '', camera_settings: '', location: '', shoot_date: '', is_featured: false, display_order: 0, status: 'Published' };

export default function Portfolio({ token }) {
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPortfolio);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${API}/api/portfolio`, { headers });
      setPortfolio(res.data);
    } catch (err) {
      toast.error('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPortfolio(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/portfolio/${form.id}`, form, { headers });
        toast.success('Portfolio item updated');
      } else {
        await axios.post(`${API}/api/portfolio`, form, { headers });
        toast.success('Portfolio item created');
      }
      setShowForm(false);
      setForm(emptyPortfolio);
      setEditing(false);
      setSelected(null);
      fetchPortfolio();
    } catch (err) {
      toast.error('Failed to save portfolio item');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this portfolio item?')) return;
    try {
      await axios.delete(`${API}/api/portfolio/${id}`, { headers });
      toast.success('Portfolio item deleted');
      setSelected(null);
      fetchPortfolio();
    } catch (err) {
      toast.error('Failed to delete portfolio item');
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyPortfolio);
    setEditing(false);
    setShowForm(true);
  };

  const getStatusBadge = (status) => {
    const map = { 'Published': 'badge-success', 'Draft': 'badge-draft', 'Archived': 'badge-warning' };
    return map[status] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading portfolio...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Portfolio</h1>
          <p>Manage your photography portfolio showcase</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ Add Portfolio Item</button>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.title}</h2>
              <span className="badge badge-info">{selected.category}</span>
              <span className={`badge ${getStatusBadge(selected.status)}`} style={{ marginLeft: 8 }}>{selected.status}</span>
              {selected.is_featured && <span style={{ marginLeft: 8, color: '#f5a623', fontSize: '1.2em' }}>&#9733;</span>}
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Title</label><div className="value">{selected.title}</div></div>
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Location</label><div className="value">{selected.location || 'N/A'}</div></div>
            <div className="detail-field"><label>Camera Settings</label><div className="value">{selected.camera_settings || 'N/A'}</div></div>
            <div className="detail-field"><label>Shoot Date</label><div className="value">{selected.shoot_date ? new Date(selected.shoot_date).toLocaleDateString() : 'N/A'}</div></div>
            <div className="detail-field"><label>Featured</label><div className="value">{selected.is_featured ? <span style={{ color: '#f5a623' }}>&#9733; Featured</span> : 'No'}</div></div>
            <div className="detail-field"><label>Display Order</label><div className="value">{selected.display_order}</div></div>
            <div className="detail-field"><label>Status</label><div className="value">{selected.status}</div></div>
            <div className="detail-field"><label>Description</label><div className="value">{selected.description || 'No description'}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{new Date(selected.created_at).toLocaleDateString()}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Location</th>
              <th>Camera Settings</th>
              <th>Featured</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map(p => (
              <tr key={p.id} onClick={() => setSelected(p)}>
                <td style={{ fontWeight: 600 }}>{p.title}</td>
                <td>{p.category}</td>
                <td>{p.location || '—'}</td>
                <td>{p.camera_settings || '—'}</td>
                <td>{p.is_featured ? <span style={{ color: '#f5a623' }}>&#9733;</span> : '—'}</td>
                <td><span className={`badge ${getStatusBadge(p.status)}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Portfolio Item' : 'New Portfolio Item'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyPortfolio); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyPortfolio); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-group">
            <label>Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Portfolio item title" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option>Wedding</option><option>Corporate</option><option>Family</option><option>Portrait</option>
                <option>Fashion</option><option>Food</option><option>Product</option><option>Real Estate</option>
                <option>Architecture</option><option>Sports</option><option>Event</option><option>Commercial</option>
                <option>Pet</option><option>Fine Art</option><option>Maternity</option><option>Engagement</option>
              </select>
            </div>
            <div className="form-group">
              <label>Location</label>
              <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Shoot location" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Shoot Date</label>
              <input type="date" value={form.shoot_date} onChange={e => setForm({...form, shoot_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Camera Settings</label>
              <input value={form.camera_settings} onChange={e => setForm({...form, camera_settings: e.target.value})} placeholder="e.g. Canon R5, 85mm f/1.4" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Display Order</label>
              <input type="number" value={form.display_order} onChange={e => setForm({...form, display_order: e.target.value})} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Published</option><option>Draft</option><option>Archived</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_featured} onChange={e => setForm({...form, is_featured: e.target.checked})} />
              Featured Item
            </label>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe this portfolio piece..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
