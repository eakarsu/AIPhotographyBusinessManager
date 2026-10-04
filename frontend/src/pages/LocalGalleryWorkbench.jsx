import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import './LocalGalleryWorkbench.css';

const apiBase = `${process.env.REACT_APP_API_URL || ''}/api/governed-photography-releases`;
const errorText = error => error.response?.data?.message || error.response?.data?.error || error.message;

function StaffImage({ caseId, assetId, tenant, label }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    axios.get(`${apiBase}/cases/${caseId}/local-gallery/assets/${assetId}/preview`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'X-Tenant-Id': tenant },
      responseType: 'blob',
    }).then(response => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(response.data);
      setUrl(objectUrl);
    }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [caseId, assetId, tenant]);
  return url ? <img className="local-gallery-thumb" src={url} alt={label} /> : <div className="local-gallery-thumb local-gallery-empty">Preview unavailable</div>;
}

export default function LocalGalleryWorkbench({ caseId, tenant, evidence = [] }) {
  const [data, setData] = useState(null);
  const [shootId, setShootId] = useState('');
  const [photo, setPhoto] = useState(null);
  const [rightsDraft, setRightsDraft] = useState({});
  const [newLink, setNewLink] = useState(null);
  const [finalReason, setFinalReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const headers = useCallback(() => ({
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    'X-Tenant-Id': tenant,
    'Idempotency-Key': window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  }), [tenant]);
  const path = `/cases/${caseId}/local-gallery`;
  const load = useCallback(async () => {
    if (!tenant || !caseId) return;
    try {
      const response = await axios.get(`${apiBase}/cases/${caseId}/local-gallery`, { headers: headers() });
      setData(response.data);
      setShootId(current => current || String(response.data.shoots[0]?.id || ''));
      setError('');
    } catch (err) { setError(errorText(err)); }
  }, [caseId, tenant, headers]);
  useEffect(() => { setData(null); setNewLink(null); load(); }, [load]);

  async function run(action, success) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(success); await load(); }
    catch (err) { setError(errorText(err)); }
    finally { setBusy(false); }
  }

  function upload(event) {
    event.preventDefault();
    if (!photo || !shootId) return;
    run(async () => {
      const form = new FormData();
      form.append('shootId', shootId);
      form.append('photo', photo);
      await axios.post(`${apiBase}${path}/photos`, form, { headers: headers() });
      setPhoto(null);
      event.target.reset();
    }, 'Image uploaded to the local governed store. Rights and consent still need review.');
  }

  function decideRights(assetId, decision) {
    const draft = rightsDraft[assetId] || {};
    run(async () => {
      await axios.post(`${apiBase}${path}/assets/${assetId}/rights`, {
        decision, reason: String(draft.reason || '').trim(),
        ...(decision === 'approved' ? {
          rightsEvidenceId: draft.rightsEvidenceId,
          consentEvidenceId: draft.consentEvidenceId,
        } : {}),
      }, { headers: headers() });
    }, decision === 'approved' ? 'Rights and consent attested by the reviewer.' : 'Image placed on rights hold.');
  }

  function issueLink(kind) {
    run(async () => {
      const response = await axios.post(`${apiBase}${path}/${kind}-link`, kind === 'final' ? { reason: finalReason.trim() } : {}, { headers: headers() });
      const url = `${window.location.origin}/client-gallery#token=${response.data.token}`;
      setNewLink({ kind, url, expiresAt: response.data.expiresAt });
      if (kind === 'final') setFinalReason('');
    }, `${kind === 'proof' ? 'Proof' : 'Final'} access link created. Copy it now; no message was sent.`);
  }

  function revoke(accessId) {
    run(async () => {
      await axios.post(`${apiBase}${path}/access/${accessId}/revoke`, {}, { headers: headers() });
      setNewLink(null);
    }, 'Access link revoked.');
  }

  function renderMissingPreview(assetId) {
    run(async () => {
      await axios.post(`${apiBase}${path}/assets/${assetId}/render-preview`, {}, { headers: headers() });
    }, 'A watermarked proof preview was rendered from the stored image.');
  }

  const updateRights = (id, key, value) => setRightsDraft(current => ({ ...current, [id]: { ...(current[id] || {}), [key]: value } }));
  const rightsEvidence = evidence.filter(item => item.kind === 'rights_license');
  const consentEvidence = evidence.filter(item => item.kind === 'consent_release');
  const approvedCount = data?.assets.filter(item => item.rights_decision === 'approved' && item.preview_ready).length || 0;

  return <section className="local-gallery-workbench">
    <h3>Local gallery proof and delivery</h3>
    <p>Images are stored in this app’s Postgres database. An operator must first bind the gallery and client to this tenant. A share link is handed off manually; object storage, CDN, and messaging are unconfigured. Client previews are resized, metadata-stripped PNGs with a visible PROOF mark and identifier; final downloads use approved originals.</p>
    {error && <p className="local-gallery-error" role="alert">{error}</p>}
    {notice && <p className="local-gallery-notice" role="status">{notice}</p>}
    {!data ? <button type="button" onClick={load}>Load local gallery</button> : <>
      <p><strong>{data.gallery.title}</strong> · {data.assets.length} uploaded · {approvedCount} rights approved · {data.proofSelection ? `${data.proofSelection.asset_ids.length} client picks submitted` : 'no client picks yet'} · {data.deliveries.length ? 'final access created' : 'no final access'}</p>
      {['photographer', 'studio_manager'].includes(data.role) && <form onSubmit={upload} className="local-gallery-upload">
        <label>Client shoot <select required value={shootId} onChange={event => setShootId(event.target.value)}><option value="">Choose a shoot</option>{data.shoots.map(shoot => <option key={shoot.id} value={shoot.id}>{shoot.title} (#{shoot.id})</option>)}</select></label>
        <label>Image (JPEG, PNG, or WebP; max 15 MB) <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setPhoto(event.target.files?.[0] || null)} /></label>
        <button disabled={busy || !shootId || !photo}>Upload image</button>
      </form>}
      {!data.shoots.length && <p>Add a shoot for this gallery’s client before uploading.</p>}
      <p>Use the case evidence form above to record opaque <strong>rights_license</strong> and <strong>consent_release</strong> references. A rights reviewer must link both to each approved image.</p>
      <div className="local-gallery-grid">{data.assets.map(asset => {
        const draft = rightsDraft[asset.id] || {};
        return <article key={asset.id}>
          <StaffImage caseId={caseId} assetId={asset.id} tenant={tenant} label={`${asset.file_name} proof ${asset.proof_id || asset.id}`} />
          <strong>{asset.file_name}</strong>
          <small>{asset.proof_id || `Image #${asset.id}`} · shoot {asset.shoot_id} · original SHA-256 {asset.file_sha256}</small>
          {!asset.preview_ready && <p>Safe proof preview missing. This image cannot appear under a client link.</p>}
          {!asset.preview_ready && ['photographer', 'studio_manager'].includes(data.role) && <button type="button" disabled={busy} onClick={() => renderMissingPreview(asset.id)}>Render proof preview</button>}
          <p>Rights: <strong>{asset.rights_decision || 'pending'}</strong>{asset.reviewed_by && ` · reviewer ${asset.reviewed_by}`}</p>
          {data.role === 'rights_reviewer' && <div className="local-gallery-rights">
            <label>License evidence <select value={draft.rightsEvidenceId || ''} onChange={event => updateRights(asset.id, 'rightsEvidenceId', event.target.value)}><option value="">Choose evidence</option>{rightsEvidence.map(item => <option key={item.id} value={item.id}>{item.source_ref} · {item.source_version}</option>)}</select></label>
            <label>Consent evidence <select value={draft.consentEvidenceId || ''} onChange={event => updateRights(asset.id, 'consentEvidenceId', event.target.value)}><option value="">Choose evidence</option>{consentEvidence.map(item => <option key={item.id} value={item.id}>{item.source_ref} · {item.source_version}</option>)}</select></label>
            <label>Decision reason <input minLength="8" maxLength="2000" value={draft.reason || ''} onChange={event => updateRights(asset.id, 'reason', event.target.value)} /></label>
            <div className="local-gallery-actions">
              <button type="button" disabled={busy || !draft.rightsEvidenceId || !draft.consentEvidenceId || String(draft.reason || '').trim().length < 8} onClick={() => decideRights(asset.id, 'approved')}>Attest rights and consent</button>
              <button type="button" disabled={busy || String(draft.reason || '').trim().length < 8} onClick={() => decideRights(asset.id, 'hold')}>Place on hold</button>
            </div>
          </div>}
        </article>;
      })}</div>
      {!data.assets.length && <p>No governed images have been uploaded to this case.</p>}
      <div className="local-gallery-actions">
        {['photographer', 'studio_manager'].includes(data.role) && <button type="button" disabled={busy || approvedCount === 0 || data.deliveries.length > 0} onClick={() => issueLink('proof')}>Create client proof link</button>}
        {data.role === 'studio_manager' && <div><label>Final delivery reason <input minLength="8" maxLength="2000" value={finalReason} onChange={event => setFinalReason(event.target.value)} placeholder="Approved selected images and rights evidence" /></label><button type="button" disabled={busy || !data.proofSelection || finalReason.trim().length < 8} onClick={() => issueLink('final')}>Create final gallery link</button></div>}
      </div>
      {newLink && <div className="local-gallery-link">
        <strong>{newLink.kind === 'proof' ? 'Client proof' : 'Final gallery'} link — shown once</strong>
        <input readOnly value={newLink.url} onFocus={event => event.target.select()} aria-label="Gallery access link" />
        <p>Expires {new Date(newLink.expiresAt).toLocaleString()}. Send it through your approved channel. Link creation does not confirm receipt.</p>
      </div>}
      <h4>Access links</h4>
      <ul>{data.access.map(access => <li key={access.id}>{access.purpose} · {access.revoked_at ? 'revoked' : `expires ${new Date(access.expires_at).toLocaleString()}`} {data.role === 'studio_manager' && !access.revoked_at && <button type="button" disabled={busy} onClick={() => revoke(access.id)}>Revoke</button>}</li>)}</ul>
      <h4>Download and decision audit</h4>
      <ul>{data.history.map(item => <li key={item.id}>{new Date(item.created_at).toLocaleString()} · {item.event_type.replaceAll('_', ' ')} · {item.actor_ref}{item.asset_id && ` · image ${item.asset_id}`}</li>)}</ul>
      {!data.history.length && <p>No local gallery events yet.</p>}
    </>}
  </section>;
}
