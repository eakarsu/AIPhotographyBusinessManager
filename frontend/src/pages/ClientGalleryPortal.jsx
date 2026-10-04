import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import './ClientGalleryPortal.css';

const api = `${process.env.REACT_APP_API_URL || ''}/api/client-gallery`;
const tokenStore = 'client-gallery-access-token';
const message = error => error.response?.data?.message || error.response?.data?.error || error.message;

function ProofImage({ id, name, proofId, token }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    axios.get(`${api}/assets/${id}`, { headers: { 'X-Gallery-Token': token }, responseType: 'blob' })
      .then(response => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, token]);
  return url ? <img src={url} alt={`${name} watermarked proof ${proofId}`} /> : <div className="client-gallery-unavailable">Preview unavailable</div>;
}

export default function ClientGalleryPortal() {
  const [token] = useState(() => {
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (fromLink) {
      sessionStorage.setItem(tokenStore, fromLink);
      window.history.replaceState(null, '', window.location.pathname);
      return fromLink;
    }
    return sessionStorage.getItem(tokenStore) || '';
  });
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(api, { headers: { 'X-Gallery-Token': token } });
      setData(response.data);
      setSelected(Array.isArray(response.data.selection) ? response.data.selection.map(Number) : []);
      setError('');
    } catch (err) { setError(message(err)); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  function toggle(id) {
    setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }

  async function submitSelection() {
    setBusy(true); setError(''); setNotice('');
    try {
      await axios.post(`${api}/selection`, { assetIds: selected }, { headers: { 'X-Gallery-Token': token } });
      setNotice('Your proof selection was recorded for studio review.');
      await load();
    } catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }

  async function download(asset) {
    setBusy(true); setError('');
    try {
      const response = await axios.get(`${api}/assets/${asset.id}/download`, {
        headers: { 'X-Gallery-Token': token }, responseType: 'blob',
      });
      const objectUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = asset.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      setNotice('Download started. The studio records the request and server stream, not receipt on your device.');
    } catch (err) { setError(message(err)); }
    finally { setBusy(false); }
  }

  return <main className="client-gallery-page">
    <h1>Client gallery</h1>
    {!token && <p role="alert">A private gallery link is required. Ask your studio for access.</p>}
    {error && <p className="client-gallery-error" role="alert">{error}</p>}
    {notice && <p className="client-gallery-notice" role="status">{notice}</p>}
    {token && !data && !error && <p>Loading gallery…</p>}
    {data && <>
      <h2>{data.title}</h2>
      <p>{data.purpose === 'proof' ? 'Choose the images you want the studio to finish.' : 'Your final gallery is available for download.'} Access expires {new Date(data.expiresAt).toLocaleString()}.</p>
      <p className="client-gallery-note">This private link controls access. Thumbnails are resized, watermarked proofs with identifiers. The studio provides original files only through final download access. Please keep the link private.</p>
      <div className="client-gallery-grid">{data.assets.map(asset => <article key={asset.id}>
        <ProofImage id={asset.id} name={asset.fileName} proofId={asset.proofId} token={token} />
        <span className="client-gallery-proof-id">{asset.proofId}</span>
        <strong>{asset.fileName}</strong>
        {data.purpose === 'proof' ? <label><input type="checkbox" checked={selected.includes(Number(asset.id))} onChange={() => toggle(Number(asset.id))} /> Select this image</label>
          : <button type="button" disabled={busy} onClick={() => download(asset)}>Download image</button>}
      </article>)}</div>
      {!data.assets.length && <p>No images are currently available under this link. Contact the studio.</p>}
      {data.purpose === 'proof' && <div className="client-gallery-submit">
        <button type="button" disabled={busy || !selected.length} onClick={submitSelection}>Submit {selected.length} selected image{selected.length === 1 ? '' : 's'}</button>
        {data.submittedAt && <p>Last submitted {new Date(data.submittedAt).toLocaleString()}. You may update your selection until the studio issues final access.</p>}
      </div>}
    </>}
  </main>;
}
