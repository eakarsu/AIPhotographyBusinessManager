import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyForm = { client_id: '', rating: 5, review_text: '', shoot_type: '', is_featured: false, source: 'Website', status: 'Published' };

const shootTypes = ['Wedding', 'Corporate', 'Family', 'Portrait', 'Fashion', 'Food', 'Product', 'Event', 'Sports', 'Architecture', 'Pet', 'Commercial', 'Fine Art', 'Maternity', 'Engagement', 'Real Estate'];
const sources = ['Google', 'Website', 'Instagram', 'Facebook', 'LinkedIn', 'Yelp', 'Email'];
const statuses = ['Published', 'Pending', 'Hidden'];

const renderStars = (rating) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

export default function Testimonials({ token }) {
  const [testimonials, setTestimonials] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const [testimonialsRes, clientsRes] = await Promise.all([
        axios.get(`${API}/api/testimonials`, { headers }),
        axios.get(`${API}/api/clients`, { headers }),
      ]);
      setTestimonials(testimonialsRes.data);
      setClients(clientsRes.data);
    } catch (err) {
      toast.error('Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/testimonials/${form.id}`, form, { headers });
        toast.success('Testimonial updated');
      } else {
        await axios.post(`${API}/api/testimonials`, form, { headers });
        toast.success('Testimonial created');
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditing(false);
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to save testimonial');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this testimonial?')) return;
    try {
      await axios.delete(`${API}/api/testimonials/${id}`, { headers });
      toast.success('Testimonial deleted');
      setSelected(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to delete testimonial');
    }
  };

  const handleEdit = (testimonial) => {
    setForm(testimonial);
    setEditing(true);
    setShowForm(true);
    setSelected(null);
  };

  const handleNew = () => {
    setForm(emptyForm);
    setEditing(false);
    setShowForm(true);
  };

  const getStatusBadge = (status) => {
    const map = { Published: 'badge-success', Pending: 'badge-warning', Hidden: 'badge-draft' };
    return map[status] || 'badge-draft';
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown';
  };

  const avgRating = testimonials.length > 0
    ? (testimonials.reduce((sum, t) => sum + (t.rating || 0), 0) / testimonials.length).toFixed(1)
    : '0.0';
  const featuredCount = testimonials.filter(t => t.is_featured).length;
  const fiveStarCount = testimonials.filter(t => t.rating === 5).length;

  if (loading) return <div className="loading"><div className="spinner"></div> Loading testimonials...</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Testimonials</h1>
          <p>Client reviews and testimonials</p>
        </div>
        <button className="btn btn-primary" onClick={handleNew}>+ Add Testimonial</button>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="card-icon">⭐</div>
          <h3>Average Rating</h3>
          <div className="stat-value">{avgRating}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">💬</div>
          <h3>Total Reviews</h3>
          <div className="stat-value">{testimonials.length}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">🌟</div>
          <h3>Featured Count</h3>
          <div className="stat-value">{featuredCount}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">🏆</div>
          <h3>5-Star Reviews</h3>
          <div className="stat-value">{fiveStarCount}</div>
        </div>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{selected.client_name || getClientName(selected.client_id)}</h2>
              <span className={`badge ${getStatusBadge(selected.status)}`}>{selected.status}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div style={{ fontSize: '32px', color: '#f59e0b', marginBottom: '16px' }}>
            {renderStars(selected.rating)}
          </div>
          <div style={{
            borderLeft: '4px solid var(--accent-color, #6366f1)',
            paddingLeft: '20px',
            margin: '16px 0',
            fontStyle: 'italic',
            fontSize: '16px',
            lineHeight: '1.6',
            color: 'var(--text-secondary, #666)'
          }}>
            {selected.review_text || 'No review text'}
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Shoot Type</label><div className="value">{selected.shoot_type || 'N/A'}</div></div>
            <div className="detail-field"><label>Source</label><div className="value">{selected.source || 'N/A'}</div></div>
            <div className="detail-field"><label>Featured</label><div className="value">{selected.is_featured ? 'Yes' : 'No'}</div></div>
            <div className="detail-field"><label>Status</label><div className="value">{selected.status}</div></div>
            <div className="detail-field"><label>Created</label><div className="value">{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'N/A'}</div></div>
          </div>
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Rating</th>
              <th>Shoot Type</th>
              <th>Source</th>
              <th>Featured</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {testimonials.map(t => (
              <tr key={t.id} onClick={() => setSelected(t)}>
                <td style={{ fontWeight: 600 }}>{t.client_name || getClientName(t.client_id)}</td>
                <td style={{ color: '#f59e0b' }}>{renderStars(t.rating)}</td>
                <td>{t.shoot_type || 'N/A'}</td>
                <td>{t.source}</td>
                <td>{t.is_featured ? 'Yes' : 'No'}</td>
                <td><span className={`badge ${getStatusBadge(t.status)}`}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Testimonial' : 'New Testimonial'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyForm); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(false); setForm(emptyForm); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="form-group">
            <label>Client</label>
            <select value={form.client_id} onChange={e => setForm({...form, client_id: e.target.value})}>
              <option value="">Select a client...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Rating</label>
              <select value={form.rating} onChange={e => setForm({...form, rating: parseInt(e.target.value)})}>
                {[5,4,3,2,1].map(n => (
                  <option key={n} value={n}>{renderStars(n)} ({n})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Shoot Type</label>
              <select value={form.shoot_type} onChange={e => setForm({...form, shoot_type: e.target.value})}>
                <option value="">Select type...</option>
                {shootTypes.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Review Text</label>
            <textarea value={form.review_text} onChange={e => setForm({...form, review_text: e.target.value})} placeholder="Client review text..." rows={4} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Source</label>
              <select value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                {sources.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_featured} onChange={e => setForm({...form, is_featured: e.target.checked})} />
              Featured Testimonial
            </label>
          </div>
        </Modal>
      )}
    </div>
  );
}
