import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PhotoThumb from './PhotoThumb';

const API = process.env.REACT_APP_API_URL || '';

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
      .catch(err => setError(err.response?.data?.error || err.message || 'load failed'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchState(galleryId); /* eslint-disable-next-line */ }, [token, galleryId]);

  const toggle = (id) => {
    const next = new Set(selections);
    if (next.has(id)) next.delete(id); else next.add(id);
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
          photo_ids: Array.from(selections),
          submit
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusMsg(res.data.message);
      await fetchState(galleryId);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 24, color: '#cbd5e1' }}>Loading photo selection…</div>;
  if (error)   return <div style={{ padding: 24, color: '#fca5a5' }}>Error: {error}</div>;
  if (!data || !data.active) return <div style={{ padding: 24, color: '#cbd5e1' }}>No galleries available.</div>;

  const scored = data.photos.filter(p => Number.isFinite(p.overallScore) && Number.isFinite(p.focusScore));
  const candidates = [...scored]
    .filter(p => p.overallScore >= 70 && p.focusScore >= 70)
    .sort((a, b) => b.overallScore - a.overallScore || b.focusScore - a.focusScore)
    .slice(0, 12);
  const focusWarnings = scored.filter(p => p.focusScore < 60);
  const filenameCounts = data.photos.reduce((counts, p) => {
    const key = String(p.label || '').trim().toLowerCase();
    if (key) counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const sameName = data.photos.filter(p => filenameCounts[String(p.label || '').trim().toLowerCase()] > 1);

  return (
    <div data-testid="photo-selection-workflow" style={{ background: '#0f172a', borderRadius: 14, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>
            Photo Selection Workflow <span style={{ fontSize: 11, fontWeight: 500, color: '#fbbf24' }}>· staff-only</span>
          </h3>
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

      {data.notice && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#94a3b8' }}>{data.notice}</div>
      )}
      <div style={{ marginBottom: 14, padding: 12, background: '#1e293b', borderRadius: 8 }}>
        <strong>Proof set suggestions from uploaded photos</strong>
        <p style={{ margin: '6px 0', fontSize: 12, color: '#cbd5e1' }}>
          Existing AI scores cover {scored.length} of {data.photos.length} photos. Suggested picks require overall and focus scores of at least 70.
          The photographer controls every selection; verify image quality, rights and consent before sharing.
        </p>
        {candidates.length > 0 && <>
          <p style={{ margin: '4px 0', fontSize: 12 }}>Candidates: {candidates.map(p => `${p.label} (overall ${p.overallScore}, focus ${p.focusScore})`).join('; ')}</p>
          <button type="button" onClick={() => setSelections(new Set(candidates.map(p => p.id)))} style={btnSecondary}>Use suggestions as draft</button>
        </>}
        {focusWarnings.length > 0 && <p style={{ margin: '4px 0', fontSize: 12, color: '#fbbf24' }}>Review possible focus issues: {focusWarnings.map(p => `${p.label} (${p.focusScore})`).join('; ')}</p>}
        {sameName.length > 0 && <p style={{ margin: '4px 0', fontSize: 12, color: '#fbbf24' }}>Repeated filenames; inspect for duplicates: {sameName.map(p => p.label).join('; ')}. Matching names do not prove duplicate content.</p>}
      </div>

      {data.photos.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', background: '#1e293b', borderRadius: 10 }}>
          No uploaded photos are attached to this gallery's client shoots.
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 10
        }}>
          {data.photos.map(p => {
            const checked = selections.has(p.id);
            return (
              <label key={p.id} style={{ cursor: 'pointer' }}>
                <PhotoThumb photo={p} token={token} borderColor={checked ? '#fbbf24' : 'transparent'}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.id)}
                    aria-label={`Select photo ${p.label}`}
                    style={{ position: 'absolute', top: 6, left: 6, width: 18, height: 18, accentColor: '#fbbf24' }}
                  />
                  {checked && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: '#fbbf24', color: '#1f2937',
                      fontSize: 10, fontWeight: 700,
                      padding: '1px 6px', borderRadius: 999
                    }}>★</div>
                  )}
                </PhotoThumb>
              </label>
            );
          })}
        </div>
      )}

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
          Studio submission: <strong>{data.submitted ? 'submitted' : 'draft'}</strong>
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
