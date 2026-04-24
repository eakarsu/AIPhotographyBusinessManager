import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyClient = { name: '', email: '', phone: '', address: '', notes: '', category: 'General' };

export default function Clients({ token }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyClient);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API}/api/clients`, { headers });
      setClients(res.data);
    } catch (err) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClients(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/clients/${form.id}`, form, { headers });
        toast.success('Client updated');
      } else {
        await axios.post(`${API}/api/clients`, form, { headers });
        toast.success('Client created');
      }
      setShowForm(false);
      setForm(emptyClient);
      setEditing(false);
      setSelected(null);
      fetchClients();
    } catch (err) {
      toast.error('Failed to save client');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this client?')) return;
    try {
      await axios.delete(`${API}/api/clients/${id}`, { headers });
      toast.success('Client deleted');
      setSelected(null);
      fetchClients();
    } catch (err) {
      toast.error('Failed to delete client');
    }
  };

  const handleEdit = (client) => {
    setForm(client);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyClient);
    setEditing(false);
    setShowForm(true);
  };

  const getBadge = (cat) => {
    const map = { Wedding: 'badge-success', Corporate: 'badge-info', Commercial: 'badge-warning', Fashion: 'badge-purple', Family: 'badge-success', Portrait: 'badge-info', Event: 'badge-warning', Sports: 'badge-danger', 'Fine Art': 'badge-purple' };
    return map[cat] || 'badge-draft';
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading clients...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p>Manage your photography clients</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Client</button>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.name}</h2>
              <span className={`badge ${getBadge(selected.category)}`}>{selected.category}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Email</label><div className="value">{selected.email || 'N/A'}</div></div>
            <div className="detail-field"><label>Phone</label><div className="value">{selected.phone || 'N/A'}</div></div>
            <div className="detail-field"><label>Address</label><div className="value">{selected.address || 'N/A'}</div></div>
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Notes</label><div className="value">{selected.notes || 'No notes'}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{new Date(selected.created_at).toLocaleDateString()}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Category</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} onClick={() => setSelected(c)}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.email}</td>
                <td>{c.phone}</td>
                <td><span className={`badge ${getBadge(c.category)}`}>{c.category}</span></td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Client' : 'New Client'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyClient); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyClient); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Client name" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email address" />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone number" />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Address" />
          </div>
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
              <option>General</option><option>Wedding</option><option>Corporate</option><option>Commercial</option>
              <option>Portrait</option><option>Fashion</option><option>Family</option><option>Event</option>
              <option>Sports</option><option>Fine Art</option>
            </select>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Client notes..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
