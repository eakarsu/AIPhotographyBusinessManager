import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyPackage = { name: '', category: 'Portrait', description: '', price: 0, duration_hours: 1, deliverables: '', includes_album: false, includes_prints: false, max_photos: 0, status: 'Active' };

export default function Packages({ token }) {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPackage);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchPackages = async () => {
    try {
      const res = await axios.get(`${API}/api/packages`, { headers });
      setPackages(res.data);
    } catch (err) {
      toast.error('Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPackages(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/packages/${form.id}`, form, { headers });
        toast.success('Package updated');
      } else {
        await axios.post(`${API}/api/packages`, form, { headers });
        toast.success('Package created');
      }
      setShowForm(false);
      setForm(emptyPackage);
      setEditing(false);
      setSelected(null);
      fetchPackages();
    } catch (err) {
      toast.error('Failed to save package');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this package?')) return;
    try {
      await axios.delete(`${API}/api/packages/${id}`, { headers });
      toast.success('Package deleted');
      setSelected(null);
      fetchPackages();
    } catch (err) {
      toast.error('Failed to delete package');
    }
  };

  const handleEdit = (pkg) => {
    setForm(pkg);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyPackage);
    setEditing(false);
    setShowForm(true);
  };

  const getStatusBadge = (status) => {
    const map = { Active: 'badge-success', Inactive: 'badge-warning', Archived: 'badge-draft' };
    return map[status] || 'badge-draft';
  };

  const getCategoryBadge = (cat) => {
    const map = { Portrait: 'badge-info', Wedding: 'badge-success', Corporate: 'badge-info', Commercial: 'badge-warning', Fashion: 'badge-purple', Event: 'badge-warning' };
    return map[cat] || 'badge-draft';
  };

  const formatPrice = (price) => {
    return '$' + Number(price).toLocaleString();
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading packages...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Packages & Pricing</h1>
          <p>Manage photography packages and pricing tiers</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Package</button>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.name}</h2>
              <span className={`badge ${getCategoryBadge(selected.category)}`}>{selected.category}</span>
              <span className={`badge ${getStatusBadge(selected.status)}`} style={{ marginLeft: 8 }}>{selected.status}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Price</label><div className="value">{formatPrice(selected.price)}</div></div>
            <div className="detail-field"><label>Duration</label><div className="value">{selected.duration_hours} hrs</div></div>
            <div className="detail-field"><label>Max Photos</label><div className="value">{selected.max_photos || 'N/A'}</div></div>
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Includes Album</label><div className="value">{selected.includes_album ? 'Yes' : 'No'}</div></div>
            <div className="detail-field"><label>Includes Prints</label><div className="value">{selected.includes_prints ? 'Yes' : 'No'}</div></div>
            <div className="detail-field"><label>Description</label><div className="value">{selected.description || 'N/A'}</div></div>
            <div className="detail-field"><label>Deliverables</label><div className="value">{selected.deliverables || 'N/A'}</div></div>
            <div className="detail-field"><label>Status</label><div className="value">{selected.status}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{new Date(selected.created_at).toLocaleDateString()}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Duration</th>
              <th>Max Photos</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {packages.map(p => (
              <tr key={p.id} onClick={() => setSelected(p)}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td><span className={`badge ${getCategoryBadge(p.category)}`}>{p.category}</span></td>
                <td>{formatPrice(p.price)}</td>
                <td>{p.duration_hours} hrs</td>
                <td>{p.max_photos || 'N/A'}</td>
                <td><span className={`badge ${getStatusBadge(p.status)}`}>{p.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Package' : 'New Package'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyPackage); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyPackage); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Package name" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option>Portrait</option><option>Wedding</option><option>Corporate</option>
                <option>Commercial</option><option>Fashion</option><option>Event</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Active</option><option>Inactive</option><option>Archived</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Price ($)</label>
              <input type="number" value={form.price} onChange={e => setForm({...form, price: Number(e.target.value)})} placeholder="0" />
            </div>
            <div className="form-group">
              <label>Duration (hours)</label>
              <input type="number" value={form.duration_hours} onChange={e => setForm({...form, duration_hours: Number(e.target.value)})} placeholder="1" />
            </div>
          </div>
          <div className="form-group">
            <label>Max Photos</label>
            <input type="number" value={form.max_photos} onChange={e => setForm({...form, max_photos: Number(e.target.value)})} placeholder="0" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Package description..." />
          </div>
          <div className="form-group">
            <label>Deliverables</label>
            <textarea value={form.deliverables} onChange={e => setForm({...form, deliverables: e.target.value})} placeholder="What's included in this package..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={form.includes_album} onChange={e => setForm({...form, includes_album: e.target.checked})} />
                Includes Album
              </label>
            </div>
            <div className="form-group">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={form.includes_prints} onChange={e => setForm({...form, includes_prints: e.target.checked})} />
                Includes Prints
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
