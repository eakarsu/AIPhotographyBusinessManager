import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function PhotoSelectionWorkflow({ token }) {
  const [data, setData] = useState(null);
  const [galleryId, setGalleryId] = useState(null);
  const [selections, setSelections] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);

  const fetchState = (gid) => {
    setLoading(true);
    const q = gid ? `?gallery_id=${gid}` : '';
    return axios
      .get(`${API}/api/custom-views/photo-selection${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        setData(res.data);
        if (!gid && res.data.active) setGalleryId(res.data.active.id);
        setSelections(new Set(res.data.selections || []));
        setError(null);
      })
      .catch(err => setError(err.message || 'load failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchState(galleryId); /* eslint-disable-next-line */ }, [token, galleryId]);

  const toggle = (idx) => {
    const next = new Set(selections);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    setSelections(next);
  };

  const save = async (submit) => {
    if (!galleryId) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `${API}/api/custom-views/photo-selection`,
        {
          gallery_id: galleryId,
          selections: Array.from(selections),
          submit
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusMsg(res.data.clientVisibleState);
      await fetchState(galleryId);
    } catch (e) {
      setError(e.message || 'save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#cbd5e1' }}>Loading photo selection…</div>;
  if (error)   return <div style={{ padding: 24, color: '#fca5a5' }}>Error: {error}</div>;
  if (!data || !data.active) return <div style={{ padding: 24, color: '#cbd5e1' }}>No galleries available.</div>;

  return (
    <div data-testid="photo-selection-workflow" style={{ background: '#0f172a', borderRadius: 14, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>Photo Selection Workflow</h3>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {data.active.title} · {selections.size}/{data.photos.length} selected
          </div>
        </div>
        <select value={galleryId || ''} onChange={e => setGalleryId(parseInt(e.target.value, 10))} style={selectStyle}>
          {data.galleries.map(g => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 10
      }}>
        {data.photos.map(p => {
          const checked = selections.has(p.index);
          return (
            <label key={p.index} style={{
              position: 'relative',
              aspectRatio: '1 / 1',
              borderRadius: 10,
              overflow: 'hidden',
              background: p.thumbnail,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
              border: checked ? '2px solid #fbbf24' : '2px solid transparent'
            }}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.index)}
                aria-label={`Select photo ${p.label}`}
                style={{
                  position: 'absolute', top: 6, left: 6, width: 18, height: 18, accentColor: '#fbbf24'
                }}
              />
              <div style={{
                position: 'absolute', bottom: 4, left: 6,
                fontSize: 10, color: '#fff',
                background: 'rgba(0,0,0,0.45)', padding: '1px 6px', borderRadius: 4
              }}>{p.label}</div>
              {checked && (
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  background: '#fbbf24', color: '#1f2937',
                  fontSize: 10, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 999
                }}>★</div>
              )}
            </label>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => save(false)} disabled={saving} style={btnSecondary}>
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button onClick={() => save(true)} disabled={saving} style={btnPrimary}>
          {saving ? 'Submitting…' : 'Submit Selection'}
        </button>
        <div style={{
          marginLeft: 'auto', fontSize: 12,
          color: data.submitted ? '#10ac84' : '#94a3b8'
        }}>
          Client view: <strong>{data.submitted ? 'submitted' : 'draft only'}</strong>
        </div>
      </div>

      {statusMsg && <div style={{ marginTop: 10, fontSize: 12, color: '#cbd5e1' }}>{statusMsg}</div>}
    </div>
  );
}

const selectStyle = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 6, padding: '6px 10px', minWidth: 220
};
const btnPrimary = {
  background: '#5f27cd', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 14px', fontWeight: 600, cursor: 'pointer'
};
const btnSecondary = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 8, padding: '8px 14px', fontWeight: 600, cursor: 'pointer'
};
