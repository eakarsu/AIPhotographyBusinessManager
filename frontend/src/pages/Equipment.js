import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyEquipment = { name: '', category: 'Camera', brand: '', model: '', serial_number: '', purchase_date: '', purchase_price: 0, condition: 'Excellent', notes: '', status: 'Available' };

export default function Equipment({ token }) {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyEquipment);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchEquipment = async () => {
    try {
      const res = await axios.get(`${API}/api/equipment`, { headers });
      setEquipment(res.data);
    } catch (err) {
      toast.error('Failed to load equipment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEquipment(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/equipment/${form.id}`, form, { headers });
        toast.success('Equipment updated');
      } else {
        await axios.post(`${API}/api/equipment`, form, { headers });
        toast.success('Equipment created');
      }
      setShowForm(false);
      setForm(emptyEquipment);
      setEditing(false);
      setSelected(null);
      fetchEquipment();
    } catch (err) {
      toast.error('Failed to save equipment');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this equipment?')) return;
    try {
      await axios.delete(`${API}/api/equipment/${id}`, { headers });
      toast.success('Equipment deleted');
      setSelected(null);
      fetchEquipment();
    } catch (err) {
      toast.error('Failed to delete equipment');
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyEquipment);
    setEditing(false);
    setShowForm(true);
  };

  const getStatusBadge = (status) => {
    const map = { 'Available': 'badge-success', 'In Use': 'badge-info', 'In Repair': 'badge-warning', 'Retired': 'badge-draft' };
    return map[status] || 'badge-draft';
  };

  const getCategoryBadge = (cat) => {
    const map = { Camera: 'badge-purple', Lens: 'badge-info', Lighting: 'badge-warning', Drone: 'badge-success' };
    return map[cat] || 'badge-draft';
  };

  const formatPrice = (price) => {
    return '$' + Number(price).toLocaleString();
  };

  if (loading) return <div className="loading"><div className="spinner"></div> Loading equipment...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Equipment</h1>
          <p>Track and manage your photography gear</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ Add Equipment</button>
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
            <div className="detail-field"><label>Brand</label><div className="value">{selected.brand || 'N/A'}</div></div>
            <div className="detail-field"><label>Model</label><div className="value">{selected.model || 'N/A'}</div></div>
            <div className="detail-field"><label>Serial Number</label><div className="value">{selected.serial_number || 'N/A'}</div></div>
            <div className="detail-field"><label>Category</label><div className="value">{selected.category}</div></div>
            <div className="detail-field"><label>Purchase Date</label><div className="value">{selected.purchase_date ? new Date(selected.purchase_date).toLocaleDateString() : 'N/A'}</div></div>
            <div className="detail-field"><label>Purchase Price</label><div className="value">{formatPrice(selected.purchase_price)}</div></div>
            <div className="detail-field"><label>Condition</label><div className="value">{selected.condition}</div></div>
            <div className="detail-field"><label>Status</label><div className="value">{selected.status}</div></div>
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
              <th>Brand</th>
              <th>Category</th>
              <th>Purchase Price</th>
              <th>Condition</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map(e => (
              <tr key={e.id} onClick={() => setSelected(e)}>
                <td style={{ fontWeight: 600 }}>{e.name}</td>
                <td>{e.brand}</td>
                <td><span className={`badge ${getCategoryBadge(e.category)}`}>{e.category}</span></td>
                <td>{formatPrice(e.purchase_price)}</td>
                <td>{e.condition}</td>
                <td><span className={`badge ${getStatusBadge(e.status)}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Equipment' : 'New Equipment'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyEquipment); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyEquipment); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-group">
            <label>Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Equipment name" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Brand</label>
              <input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} placeholder="Brand" />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input value={form.model} onChange={e => setForm({...form, model: e.target.value})} placeholder="Model" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                <option>Camera</option><option>Lens</option><option>Lighting</option><option>Modifier</option>
                <option>Drone</option><option>Support</option><option>Bag</option><option>Storage</option><option>Computer</option>
              </select>
            </div>
            <div className="form-group">
              <label>Serial Number</label>
              <input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="Serial number" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Purchase Date</label>
              <input type="date" value={form.purchase_date} onChange={e => setForm({...form, purchase_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Purchase Price</label>
              <input type="number" value={form.purchase_price} onChange={e => setForm({...form, purchase_price: e.target.value})} placeholder="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Condition</label>
              <select value={form.condition} onChange={e => setForm({...form, condition: e.target.value})}>
                <option>Excellent</option><option>Good</option><option>Fair</option><option>Needs Repair</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Available</option><option>In Use</option><option>In Repair</option><option>Retired</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Equipment notes..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
