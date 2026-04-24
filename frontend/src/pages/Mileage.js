import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyTrip = { trip_date: '', from_location: '', to_location: '', miles: 0, purpose: 'Client Shoot', client_name: '', is_round_trip: false, notes: '' };
const IRS_RATE = 0.70; // 2025 IRS standard mileage rate

export default function Mileage({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyTrip);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/mileage`, { headers });
      setItems(res.data);
    } catch (err) {
      toast.error('Failed to load mileage');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/mileage/${form.id}`, form, { headers });
        toast.success('Trip updated');
      } else {
        await axios.post(`${API}/api/mileage`, form, { headers });
        toast.success('Trip logged');
      }
      setShowForm(false);
      setForm(emptyTrip);
      setEditing(false);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save trip');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trip?')) return;
    try {
      await axios.delete(`${API}/api/mileage/${id}`, { headers });
      toast.success('Trip deleted');
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete trip');
    }
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyTrip);
    setEditing(false);
    setShowForm(true);
  };

  const totalMiles = items.reduce((sum, t) => sum + Number(t.miles) * (t.is_round_trip ? 2 : 1), 0);
  const totalDeduction = totalMiles * IRS_RATE;
  const now = new Date();
  const thisMonthMiles = items.filter(t => {
    if (!t.trip_date) return false;
    const d = new Date(t.trip_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((sum, t) => sum + Number(t.miles) * (t.is_round_trip ? 2 : 1), 0);
  const tripCount = items.length;

  const formatMoney = (amt) => '$' + Number(amt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) return <div className="loading"><div className="spinner"></div> Loading mileage...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mileage Tracker</h1>
          <p>Track business travel for tax deductions</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ Log Trip</button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <h3>Total Miles</h3>
          <div className="stat-value">{totalMiles.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <h3>Tax Deduction</h3>
          <div className="stat-value">{formatMoney(totalDeduction)}</div>
        </div>
        <div className="stat-card">
          <h3>This Month</h3>
          <div className="stat-value">{thisMonthMiles.toLocaleString()} mi</div>
        </div>
        <div className="stat-card">
          <h3>Total Trips</h3>
          <div className="stat-value">{tripCount}</div>
        </div>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.from_location} → {selected.to_location}</h2>
              <span className="badge badge-info">{selected.purpose}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Date</label><div className="value">{selected.trip_date ? new Date(selected.trip_date).toLocaleDateString() : 'N/A'}</div></div>
            <div className="detail-field"><label>Miles</label><div className="value" style={{ fontSize: 20, fontWeight: 700 }}>{Number(selected.miles) * (selected.is_round_trip ? 2 : 1)}</div></div>
            <div className="detail-field"><label>Client</label><div className="value">{selected.client_name || 'N/A'}</div></div>
            <div className="detail-field"><label>Round Trip</label><div className="value">{selected.is_round_trip ? 'Yes' : 'No'}</div></div>
            <div className="detail-field"><label>Deduction</label><div className="value" style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{formatMoney(Number(selected.miles) * (selected.is_round_trip ? 2 : 1) * IRS_RATE)}</div></div>
            <div className="detail-field"><label>Purpose</label><div className="value">{selected.purpose}</div></div>
            <div className="detail-field"><label>Notes</label><div className="value">{selected.notes || 'No notes'}</div></div>
            <div className="detail-field"><label>Logged</label><div className="value">{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'N/A'}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>From</th>
              <th>To</th>
              <th>Miles</th>
              <th>Purpose</th>
              <th>Client</th>
              <th>Round Trip</th>
              <th>Deduction</th>
            </tr>
          </thead>
          <tbody>
            {items.map(t => {
              const effectiveMiles = Number(t.miles) * (t.is_round_trip ? 2 : 1);
              return (
                <tr key={t.id} onClick={() => setSelected(t)}>
                  <td>{t.trip_date ? new Date(t.trip_date).toLocaleDateString() : 'N/A'}</td>
                  <td>{t.from_location}</td>
                  <td>{t.to_location}</td>
                  <td style={{ fontWeight: 600 }}>{effectiveMiles}</td>
                  <td>{t.purpose}</td>
                  <td>{t.client_name || 'N/A'}</td>
                  <td>{t.is_round_trip ? 'Yes' : 'No'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>{formatMoney(effectiveMiles * IRS_RATE)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Trip' : 'Log New Trip'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyTrip); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyTrip); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Log Trip'}</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label>Trip Date</label>
              <input type="date" value={form.trip_date ? form.trip_date.substring(0, 10) : ''} onChange={e => setForm({...form, trip_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Miles (one way)</label>
              <input type="number" value={form.miles} onChange={e => setForm({...form, miles: e.target.value})} placeholder="0" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>From</label>
              <input value={form.from_location} onChange={e => setForm({...form, from_location: e.target.value})} placeholder="Starting location" />
            </div>
            <div className="form-group">
              <label>To</label>
              <input value={form.to_location} onChange={e => setForm({...form, to_location: e.target.value})} placeholder="Destination" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Purpose</label>
              <select value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})}>
                <option>Client Shoot</option><option>Scouting</option><option>Equipment Pickup</option>
                <option>Meeting</option><option>Delivery</option><option>Studio</option><option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Client Name</label>
              <input value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} placeholder="Client name (optional)" />
            </div>
          </div>
          <div className="form-group">
            <label>Round Trip</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
              <input
                type="checkbox"
                checked={form.is_round_trip}
                onChange={e => setForm({...form, is_round_trip: e.target.checked})}
                style={{ width: 18, height: 18 }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>This was a round trip (miles will be doubled)</span>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Trip notes..." />
          </div>
        </Modal>
      )}
    </div>
  );
}
