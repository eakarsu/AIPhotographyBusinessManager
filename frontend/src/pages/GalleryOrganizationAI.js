import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import AIOutput from '../components/AIOutput';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function GalleryOrganizationAI({ token }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [galleryId, setGalleryId] = useState('');
  const [photosText, setPhotosText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const body = {};
      if (galleryId) body.gallery_id = galleryId;
      if (photosText.trim()) {
        body.photos = photosText
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
          .map(name => ({ name }));
      }
      const res = await axios.post(`${API}/api/ai/gallery-organization-ai`, body, { headers });
      setResult(res.data);
      toast.success('Gallery organized');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Gallery organization failed');
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Gallery Organization AI</h1>
        <p>Group photos, tag highlights, find duplicates, and pick covers</p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Gallery ID (optional, pulls photos from DB)</label>
            <input value={galleryId} onChange={e => setGalleryId(e.target.value)} placeholder="e.g., gallery-123" />
          </div>
          <div className="form-group">
            <label>Or paste photo names (one per line)</label>
            <textarea rows={6} value={photosText} onChange={e => setPhotosText(e.target.value)} placeholder="ceremony_001.jpg\nceremony_002.jpg\nreception_001.jpg" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || (!galleryId && !photosText.trim())}>
            {loading ? 'Organizing...' : 'Organize Gallery'}
          </button>
        </form>
      </div>

      {loading && <div style={{ padding: 24, textAlign: 'center' }}>AI organizing your gallery...</div>}

      {result && (
        <div className="card" style={{ padding: 24 }}>
          <h2>Organization Result</h2>
          {result.parsed && (
            <div style={{ marginBottom: 20 }}>
              {result.parsed.groupings && (
                <div>
                  <h3>Groupings</h3>
                  <pre style={{ background: '#f9f9f9', padding: 12, borderRadius: 6, fontSize: 12 }}>
                    {JSON.stringify(result.parsed.groupings, null, 2)}
                  </pre>
                </div>
              )}
              {result.parsed.highlight_picks && (
                <div>
                  <h3>Highlight Picks</h3>
                  <ul>{(result.parsed.highlight_picks || []).map((h, i) => <li key={i}>{typeof h === 'string' ? h : JSON.stringify(h)}</li>)}</ul>
                </div>
              )}
              {result.parsed.duplicates && (
                <div>
                  <h3>Duplicates</h3>
                  <ul>{(result.parsed.duplicates || []).map((d, i) => <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>)}</ul>
                </div>
              )}
              {result.parsed.cover_candidates && (
                <div>
                  <h3>Cover Candidates</h3>
                  <ul>{(result.parsed.cover_candidates || []).map((c, i) => <li key={i}>{typeof c === 'string' ? c : JSON.stringify(c)}</li>)}</ul>
                </div>
              )}
            </div>
          )}
          <AIOutput response={result.content} model={result.model} tokens={result.usage} title="Gallery Organization" />
        </div>
      )}
    </div>
  );
}
