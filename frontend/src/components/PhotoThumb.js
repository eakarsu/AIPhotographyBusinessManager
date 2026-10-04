import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

// Loads real uploaded photo bytes from GET /api/photos/:id/data with auth and
// revokes the object URL on unmount. No placeholder imagery is generated.
export default function PhotoThumb({ photo, token, borderColor = 'transparent', children }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    axios
      .get(`${API}${photo.thumbnailUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      })
      .then(res => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.thumbnailUrl, token]);

  return (
    <div style={{
      position: 'relative',
      aspectRatio: '1 / 1',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#1e293b',
      border: `2px solid ${borderColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {url && (
        <img
          src={url}
          alt={photo.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {!url && !failed && <span style={{ fontSize: 11, color: '#64748b' }}>Loading…</span>}
      {failed && (
        <span style={{ fontSize: 11, color: '#94a3b8', padding: 6, textAlign: 'center' }}>
          Image unavailable
        </span>
      )}
      <div style={{
        position: 'absolute', bottom: 4, left: 6, fontSize: 10, color: '#fff',
        background: 'rgba(0,0,0,0.45)', padding: '1px 6px', borderRadius: 4,
        maxWidth: 'calc(100% - 12px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
      }}>{photo.label}</div>
      {children}
    </div>
  );
}
