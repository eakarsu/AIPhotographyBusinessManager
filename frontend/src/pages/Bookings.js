import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyBooking = { client_name: '', email: '', phone: '', shoot_type: 'Portrait', preferred_date: '', preferred_time: '', location: '', message: '', budget: 0, referral_source: '', status: 'New' };

export default function Bookings({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyBooking);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/bookings`, { headers });
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/bookings/${form.id}`, form, { headers });
        toast.success('Booking updated');
      } else {
        await axios.post(`${API}/api/bookings`, form, { headers });
        toast.success('Booking created');
      }
      setShowForm(false);
      setForm(emptyBooking);
      setEditing(false);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save booking');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this booking request?')) return;
    try {
      await axios.delete(`${API}/api/bookings/${id}`, { headers });
      toast.success('Booking deleted');
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete booking');
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyBooking);
    setEditing(false);
    setShowForm(true);
  };

  const statusBadge = (s) => {
    const map = { New: 'badge-info', Contacted: 'badge-warning', Confirmed: 'badge-success', Declined: 'badge-draft', Completed: 'badge-success' };
    return map[s] || 'badge-draft';
  };

  const newCount = items.filter(b => b.status === 'New').length;
  const confirmedCount = items.filter(b => b.status === 'Confirmed').length;
  const totalBudget = items.filter(b => b.status === 'Confirmed').reduce((sum, b) => sum + Number(b.budget || 0), 0);
  const formatMoney = (amt) => '$' + Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <div className="loading"><div className="spinner"></div> Loading bookings...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Booking Requests</h1>
          <p>Manage client inquiries and booking requests</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Booking</button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>Total Requests</h3>
          <div className="stat-value">{items.length}</div>
        </div>
        <div className="stat-card">
          <h3>New / Pending</h3>
          <div className="stat-value">{newCount}</div>
        </div>
        <div className="stat-card">
          <h3>Confirmed</h3>
          <div className="stat-value">{confirmedCount}</div>
        </div>
        <div className="stat-card">
          <h3>Confirmed Revenue</h3>
          <div className="stat-value">{formatMoney(totalBudget)}</div>
        </div>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.client_name}</h2>
              <span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span>
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
            <div className="detail-field"><label>Shoot Type</label><div className="value">{selected.shoot_type}</div></div>
            <div className="detail-field"><label>Preferred Date</label><div className="value">{selected.preferred_date ? new Date(selected.preferred_date).toLocaleDateString() : 'Flexible'}</div></div>
            <div className="detail-field"><label>Preferred Time</label><div className="value">{selected.preferred_time || 'Flexible'}</div></div>
            <div className="detail-field"><label>Location</label><div className="value">{selected.location || 'TBD'}</div></div>
            <div className="detail-field"><label>Budget</label><div className="value" style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{formatMoney(selected.budget)}</div></div>
            <div className="detail-field"><label>Referral</label><div className="value">{selected.referral_source || 'N/A'}</div></div>
            <div className="detail-field"><label>Message</label><div className="value">{selected.message || 'No message'}</div></div>
            <div className="detail-field"><label>Received</label><div className="value">{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'N/A'}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Email</th>
              <th>Shoot Type</th>
              <th>Preferred Date</th>
              <th>Budget</th>
              <th>Referral</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(b => (
              <tr key={b.id} onClick={() => setSelected(b)}>
                <td style={{ fontWeight: 600 }}>{b.client_name}</td>
                <td>{b.email || 'N/A'}</td>
                <td>{b.shoot_type}</td>
                <td>{b.preferred_date ? new Date(b.preferred_date).toLocaleDateString() : 'Flexible'}</td>
                <td style={{ fontWeight: 600 }}>{formatMoney(b.budget)}</td>
                <td>{b.referral_source || 'N/A'}</td>
                <td><span className={`badge ${statusBadge(b.status)}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Booking' : 'New Booking Request'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyBooking); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyBooking); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label>Client Name</label>
              <input value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} placeholder="Full name" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email address" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Phone number" />
            </div>
            <div className="form-group">
              <label>Shoot Type</label>
              <select value={form.shoot_type} onChange={e => setForm({...form, shoot_type: e.target.value})}>
                <option>Portrait</option><option>Wedding</option><option>Engagement</option><option>Family</option>
                <option>Corporate</option><option>Event</option><option>Product</option><option>Real Estate</option>
                <option>Fashion</option><option>Food</option><option>Sports</option><option>Other</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Preferred Date</label>
              <input type="date" value={form.preferred_date ? form.preferred_date.substring(0, 10) : ''} onChange={e => setForm({...form, preferred_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Preferred Time</label>
              <input type="time" value={form.preferred_time || ''} onChange={e => setForm({...form, preferred_time: e.target.value})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Location</label>
              <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Shoot location" />
            </div>
            <div className="form-group">
              <label>Budget</label>
              <input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0.00" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Referral Source</label>
              <select value={form.referral_source} onChange={e => setForm({...form, referral_source: e.target.value})}>
                <option value="">Select...</option>
                <option>Instagram</option><option>Google</option><option>Website</option><option>Word of Mouth</option>
                <option>Facebook</option><option>Yelp</option><option>Referral</option><option>Repeat Client</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>New</option><option>Contacted</option><option>Confirmed</option><option>Declined</option><option>Completed</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Message</label>
            <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} placeholder="Client's message or notes..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
