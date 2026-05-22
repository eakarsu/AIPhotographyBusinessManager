import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function GalleryViewer({ token }) {
  const [data, setData] = useState(null);
  const [galleryId, setGalleryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = galleryId ? `?gallery_id=${galleryId}` : '';
    axios
      .get(`${API}/api/custom-views/gallery-viewer${q}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (!cancelled) {
          setData(res.data);
          if (!galleryId && res.data.active) setGalleryId(res.data.active.id);
          setError(null);
        }
      })
      .catch(err => { if (!cancelled) setError(err.message || 'load failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, galleryId]);

  if (loading) return <div style={{ padding: 24, color: '#cbd5e1' }}>Loading gallery…</div>;
  if (error)   return <div style={{ padding: 24, color: '#fca5a5' }}>Error: {error}</div>;
  if (!data || !data.active) return <div style={{ padding: 24, color: '#cbd5e1' }}>No galleries available.</div>;

  return (
    <div data-testid="gallery-viewer" style={{ background: '#0f172a', borderRadius: 14, padding: 18, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>Gallery Viewer</h3>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            {data.active.title} · client: {data.active.client_name || '—'} · {data.photos.length} photos · {data.favoriteCount} favorited
          </div>
        </div>
        <select
          value={galleryId || ''}
          onChange={e => setGalleryId(parseInt(e.target.value, 10))}
          style={selectStyle}
        >
          {data.galleries.map(g => (
            <option key={g.id} value={g.id}>{g.title}</option>
          ))}
        </select>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10
      }}>
        {data.photos.map(p => (
          <div key={p.index} style={{
            position: 'relative',
            aspectRatio: '1 / 1',
            borderRadius: 10,
            overflow: 'hidden',
            background: p.thumbnail,
            boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
            border: p.favorited ? '2px solid #fbbf24' : '2px solid transparent'
          }}>
            <div style={{
              position: 'absolute', bottom: 4, left: 6,
              fontSize: 10, color: '#fff',
              background: 'rgba(0,0,0,0.45)', padding: '1px 6px', borderRadius: 4
            }}>{p.label}</div>
            {p.favorited && (
              <div style={{
                position: 'absolute', top: 6, right: 6,
                background: '#fbbf24', color: '#1f2937',
                fontSize: 11, fontWeight: 700,
                padding: '2px 6px', borderRadius: 999
              }}>★ Favorited</div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 12, fontSize: 12, color: '#94a3b8',
        display: 'flex', gap: 16, flexWrap: 'wrap'
      }}>
        <span>Total: <strong style={{ color: '#e2e8f0' }}>{data.photos.length}</strong></span>
        <span>★ Favorites: <strong style={{ color: '#fbbf24' }}>{data.favoriteCount}</strong></span>
        <span>Status: <strong style={{ color: '#e2e8f0' }}>{data.active.status}</strong></span>
        <span>Submitted: <strong style={{ color: data.submitted ? '#10ac84' : '#94a3b8' }}>{String(!!data.submitted)}</strong></span>
      </div>
    </div>
  );
}

const selectStyle = {
  background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155',
  borderRadius: 6, padding: '6px 10px', minWidth: 220
};
