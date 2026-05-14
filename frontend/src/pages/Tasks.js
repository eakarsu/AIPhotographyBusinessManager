import React, { useState, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function Tasks({ token }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const handleFilesSelected = (e) => {
    const files = Array.from(e.target.files).slice(0, 5);
    setSelectedFiles(files);
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) return toast.error('Select at least 1 portfolio photo');
    setLoading(true); setResult(null);
    try {
      const formData = new FormData();
      selectedFiles.forEach(f => formData.append('photos', f));
      const res = await axios.post(`${API}/api/ai/style-analyzer`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
      toast.success('Style analysis complete!');
    } catch (err) {
      toast.error('Style analysis failed: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>AI Style Analyzer</h1>
          <p>Upload portfolio photos to discover your distinctive photography style signature</p>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 24, maxWidth: 600 }}>
        <h3 style={{ margin: '0 0 16px' }}>Upload Portfolio Photos</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
          Upload 2-5 of your best portfolio photos. The AI will analyze lighting, composition, color tones, and identify your unique style signature.
        </p>
        <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFilesSelected} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>Select Photos (max 5)</button>
          {selectedFiles.length > 0 && (
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              {selectedFiles.length} photo(s): {selectedFiles.map(f => f.name).join(', ')}
            </span>
          )}
        </div>
        {selectedFiles.length > 0 && (
          <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={handleAnalyze} disabled={loading}>
            {loading ? 'Analyzing Style...' : 'Analyze My Style with AI'}
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }}></div>
          <p>AI is analyzing your photography style...</p>
        </div>
      )}

      {result && !loading && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))', padding: 32, borderRadius: 12, marginBottom: 24, color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, opacity: 0.8 }}>Your Style Signature</div>
            <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.4 }}>{result.style_signature}</div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {(result.style_tags || []).map((tag, i) => (
                <span key={i} style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12 }}>{tag}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {result.lighting_preferences && (
              <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>Lighting Style</h4>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{result.lighting_preferences.primary_style}</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {(result.lighting_preferences.characteristics || []).map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            {result.color_palette && (
              <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>Color and Editing</h4>
                <div style={{ marginBottom: 6 }}><strong>Editing Style:</strong> {result.color_palette.editing_style}</div>
                <div style={{ marginBottom: 6 }}><strong>Color Grading:</strong> {result.color_palette.color_grading}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {(result.color_palette.dominant_tones || []).map((t, i) => (
                    <span key={i} style={{ padding: '3px 10px', background: 'var(--bg-input)', borderRadius: 12, fontSize: 12 }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {result.composition_patterns && (
              <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>Composition</h4>
                <div style={{ marginBottom: 6 }}><strong>Framing:</strong> {result.composition_patterns.preferred_framing}</div>
                <div style={{ marginBottom: 6 }}><strong>Depth of Field:</strong> {result.composition_patterns.depth_of_field}</div>
                <div style={{ marginBottom: 6 }}><strong>Perspective:</strong> {result.composition_patterns.perspective}</div>
                <div><strong>Rule of Thirds:</strong> {result.composition_patterns.rule_of_thirds_usage}</div>
              </div>
            )}
            <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>Best Genre Fit</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(result.genre_fit || []).map((g, i) => (
                  <span key={i} style={{ padding: '4px 12px', background: 'var(--bg-input)', borderRadius: 20, fontSize: 13 }}>{g}</span>
                ))}
              </div>
              {result.mood_and_emotion && (
                <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 14, fontStyle: 'italic' }}>"{result.mood_and_emotion}"</div>
              )}
            </div>
            {result.client_appeal && (
              <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>Ideal Client</h4>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>{result.client_appeal}</p>
              </div>
            )}
            {result.differentiation && (
              <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px', color: 'var(--accent)' }}>What Makes You Unique</h4>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>{result.differentiation}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
