import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import Modal from '../components/Modal';
import AIOutput from '../components/AIOutput';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const emptyPost = { platform: 'Instagram', caption: '', hashtags: '', image_url: '', scheduled_date: '', status: 'Draft', engagement_likes: 0, engagement_comments: 0, engagement_shares: 0 };

export default function SocialMedia({ token }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPost);
  const [editing, setEditing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/api/social`, { headers });
      setItems(res.data);
    } catch (err) { toast.error('Failed to load social posts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`${API}/api/social/${form.id}`, form, { headers });
        toast.success('Post updated');
      } else {
        await axios.post(`${API}/api/social`, form, { headers });
        toast.success('Post created');
      }
      setShowForm(false); setForm(emptyPost); setEditing(false); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to save post'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API}/api/social/${id}`, { headers }); toast.success('Post deleted'); setSelected(null); fetchData();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleEdit = (item) => { setForm(item); setEditing(true); setShowForm(true); setSelected(null); };
  const handleNew = () => { setForm(emptyPost); setEditing(false); setShowForm(true); };

  const generateAICaption = async () => {
    setAiLoading(true); setAiResult(null);
    try {
      const res = await axios.post(`${API}/api/ai/generate-caption`, {
        platform: form.platform,
        photo_description: form.caption || 'Professional photography post',
        style: 'Professional and engaging',
        hashtags_count: 15
      }, { headers });
      setAiResult(res.data);
      if (res.data.caption) {
        // Extract caption part (before hashtags section)
        setForm({ ...form, caption: res.data.caption.split('#')[0].trim() });
      }
      toast.success('AI caption generated!');
    } catch (err) { toast.error('AI generation failed'); }
    finally { setAiLoading(false); }
  };

  const statusBadge = (s) => {
    const m = { Published: 'badge-success', Scheduled: 'badge-info', Draft: 'badge-draft', Failed: 'badge-danger' };
    return m[s] || 'badge-draft';
  };

  const platformIcon = (p) => {
    const m = { Instagram: '📷', Facebook: '👤', Twitter: '🐦', TikTok: '🎵', Pinterest: '📌', LinkedIn: '💼' };
    return m[p] || '📱';
  };

  const totalEngagement = (post) => (post.engagement_likes || 0) + (post.engagement_comments || 0) + (post.engagement_shares || 0);

  if (loading) return <div className="loading"><div className="spinner"></div> Loading social posts...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h1>Social Media</h1><p>Schedule posts, generate captions, and track engagement</p></div>
        <button className="btn btn-primary" onClick={handleNew}>+ New Post</button>
      </div>

      {/* Engagement Stats */}
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="card-icon">❤️</div>
          <h3>Total Likes</h3>
          <div className="stat-value">{items.reduce((s, p) => s + (p.engagement_likes || 0), 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">💬</div>
          <h3>Total Comments</h3>
          <div className="stat-value">{items.reduce((s, p) => s + (p.engagement_comments || 0), 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">🔄</div>
          <h3>Total Shares</h3>
          <div className="stat-value">{items.reduce((s, p) => s + (p.engagement_shares || 0), 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="card-icon">📊</div>
          <h3>Total Engagement</h3>
          <div className="stat-value">{items.reduce((s, p) => s + totalEngagement(p), 0).toLocaleString()}</div>
        </div>
      </div>

      {selected && (
        <div className="detail-view">
          <div className="detail-header">
            <div>
              <h2>{platformIcon(selected.platform)} {selected.platform} Post</h2>
              <span className={`badge ${statusBadge(selected.status)}`}>{selected.status}</span>
            </div>
            <div className="detail-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selected.id)}>Delete</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            <div className="detail-field"><label>Platform</label><div className="value">{platformIcon(selected.platform)} {selected.platform}</div></div>
            <div className="detail-field"><label>Scheduled</label><div className="value">{selected.scheduled_date ? new Date(selected.scheduled_date).toLocaleString() : 'Not scheduled'}</div></div>
            <div className="detail-field"><label>Likes</label><div className="value" style={{ color: 'var(--danger)' }}>❤️ {selected.engagement_likes || 0}</div></div>
            <div className="detail-field"><label>Comments</label><div className="value" style={{ color: 'var(--info)' }}>💬 {selected.engagement_comments || 0}</div></div>
            <div className="detail-field"><label>Shares</label><div className="value" style={{ color: 'var(--success)' }}>🔄 {selected.engagement_shares || 0}</div></div>
            <div className="detail-field"><label>Total Engagement</label><div className="value" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-secondary)' }}>{totalEngagement(selected)}</div></div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Caption</label>
            <div style={{ padding: 16, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', lineHeight: 1.8, fontSize: 14 }}>{selected.caption}</div>
          </div>
          {selected.hashtags && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Hashtags</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selected.hashtags.split(/\s+/).filter(h => h.startsWith('#')).map((h, i) => (
                  <span key={i} style={{ padding: '4px 10px', background: 'rgba(108,92,231,0.1)', borderRadius: 20, fontSize: 12, color: 'var(--accent-secondary)' }}>{h}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="data-table-container">
        <table className="data-table">
          <thead><tr><th>Platform</th><th>Caption</th><th>Status</th><th>Scheduled</th><th>Engagement</th></tr></thead>
          <tbody>
            {items.map(p => (
              <tr key={p.id} onClick={() => setSelected(p)}>
                <td style={{ fontWeight: 600 }}>{platformIcon(p.platform)} {p.platform}</td>
                <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.caption}</td>
                <td><span className={`badge ${statusBadge(p.status)}`}>{p.status}</span></td>
                <td>{p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <span style={{ color: 'var(--danger)', marginRight: 8 }}>❤️ {p.engagement_likes || 0}</span>
                  <span style={{ color: 'var(--info)', marginRight: 8 }}>💬 {p.engagement_comments || 0}</span>
                  <span style={{ color: 'var(--success)' }}>🔄 {p.engagement_shares || 0}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Post' : 'New Social Post'}
          onClose={() => { setShowForm(false); setEditing(false); setForm(emptyPost); setAiResult(null); }}
          footer={<><button className="btn btn-secondary" onClick={() => { setShowForm(false); setAiResult(null); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button></>}
        >
          <div className="form-row">
            <div className="form-group">
              <label>Platform</label>
              <select value={form.platform} onChange={e => setForm({...form, platform: e.target.value})}>
                <option>Instagram</option><option>Facebook</option><option>Twitter</option><option>TikTok</option><option>Pinterest</option><option>LinkedIn</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option>Draft</option><option>Scheduled</option><option>Published</option><option>Failed</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Scheduled Date</label><input type="datetime-local" value={form.scheduled_date ? form.scheduled_date.substring(0, 16) : ''} onChange={e => setForm({...form, scheduled_date: e.target.value})} /></div>
          <button className="btn btn-success btn-full" onClick={generateAICaption} disabled={aiLoading} style={{ marginBottom: 16 }}>
            {aiLoading ? '🤖 Generating...' : '🤖 Generate Caption with AI'}
          </button>
          <AIOutput response={aiResult?.caption} model={aiResult?.model_used} tokens={aiResult?.tokens_used} loading={aiLoading} title="AI Generated Caption" />
          <div className="form-group" style={{ marginTop: 16 }}><label>Caption</label><textarea value={form.caption} onChange={e => setForm({...form, caption: e.target.value})} placeholder="Write your caption..." style={{ minHeight: 120 }} /></div>
          <div className="form-group"><label>Hashtags</label><textarea value={form.hashtags || ''} onChange={e => setForm({...form, hashtags: e.target.value})} placeholder="#photography #portrait ..." /></div>
          {editing && (
            <div className="form-row" style={{ marginTop: 8 }}>
              <div className="form-group"><label>Likes</label><input type="number" value={form.engagement_likes || 0} onChange={e => setForm({...form, engagement_likes: parseInt(e.target.value) || 0})} /></div>
              <div className="form-group"><label>Comments</label><input type="number" value={form.engagement_comments || 0} onChange={e => setForm({...form, engagement_comments: parseInt(e.target.value) || 0})} /></div>
              <div className="form-group"><label>Shares</label><input type="number" value={form.engagement_shares || 0} onChange={e => setForm({...form, engagement_shares: parseInt(e.target.value) || 0})} /></div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
