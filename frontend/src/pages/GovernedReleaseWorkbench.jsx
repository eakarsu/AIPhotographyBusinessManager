import React, { useState } from 'react';
import axios from 'axios';
import LocalGalleryWorkbench from './LocalGalleryWorkbench';

const base = `${process.env.REACT_APP_API_URL || ''}/api/governed-photography-releases`;
const storageKey = 'photography-governed-tenant';
const now = () => new Date().toISOString();
const message = error => error.response?.data?.message || error.response?.data?.error || error.message;

export default function GovernedReleaseWorkbench() {
  const [tenant, setTenant] = useState(localStorage.getItem(storageKey) || '');
  const [policy, setPolicy] = useState(null);
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [subjectRef, setSubjectRef] = useState('');
  const [policyVersion, setPolicyVersion] = useState('v1');
  const [evidence, setEvidence] = useState({ kind: 'source_manifest', sourceRef: '', sourceVersion: '', sha256: '', consentBasis: '' });
  const [assessment, setAssessment] = useState('');
  const [decision, setDecision] = useState({ action: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [assessmentResult, setAssessmentResult] = useState(null);

  function headers(write = false) {
    return { Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'X-Tenant-Id': tenant.trim(), ...(write ? { 'Idempotency-Key': crypto.randomUUID() } : {}) };
  }
  async function request(method, path, body, write = false) {
    return axios({ method, url: `${base}${path}`, data: body, headers: headers(write) });
  }
  async function refresh() {
    if (!tenant.trim()) return;
    try {
      const [p, c] = await Promise.all([request('get', '/policy'), request('get', '/cases')]);
      setPolicy(p.data);
      setCases(Array.isArray(c.data) ? c.data : []);
      setError('');
    } catch (e) { setError(message(e)); }
  }
  async function selectCase(row) {
    setError('');
    try {
      const [detail, events] = await Promise.all([
        request('get', `/cases/${row.id}`), request('get', `/cases/${row.id}/history`),
      ]);
      setSelected(detail.data);
      setHistory(Array.isArray(events.data) ? events.data : []);
    } catch (e) { setError(message(e)); }
  }
  async function mutate(task, success) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice(success); await refresh(); }
    catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  function createCase(event) {
    event.preventDefault();
    mutate(async () => {
      const response = await request('post', '/cases', {
        subjectRef: subjectRef.trim(), policyVersion: policyVersion.trim(),
        effectiveAt: now(), sourceSnapshot: {},
      }, true);
      await selectCase(response.data);
    }, 'Versioned release case created.');
  }
  function addEvidence(event) {
    event.preventDefault();
    mutate(async () => {
      await request('post', `/cases/${selected.id}/evidence`, {
        ...evidence, sha256: evidence.sha256.toLowerCase().trim(), capturedAt: now(),
        metadata: {},
      }, true);
      await selectCase(selected);
    }, 'Evidence reference recorded.');
  }
  function assess(event) {
    event.preventDefault();
    let body;
    try { body = JSON.parse(assessment); }
    catch { setError('Assessment signals must be a JSON object.'); return; }
    mutate(async () => {
      const response = await request('post', `/cases/${selected.id}/assess`, body, true);
      setAssessmentResult(response.data);
      await selectCase(selected);
    }, 'Deterministic assessment recorded for human review.');
  }
  function transition(event) {
    event.preventDefault();
    mutate(async () => {
      await request('post', `/cases/${selected.id}/transitions`, {
        action: decision.action, reason: decision.reason.trim(), expectedVersion: selected.version,
      }, true);
      await selectCase(selected);
    }, 'Transition recorded.');
  }
  const actions = (policy?.transitions || []).filter(item => item.from === selected?.state);
  const providerActions = new Set(['queue_render', 'record_render', 'record_render_failure', 'retry_render', 'record_publish', 'record_export']);
  return <div className="page-content" style={{ padding: 24 }}>
    <h1>Governed photography release</h1>
    <p>Track source assets, rights, consent, proof review and release evidence. This workflow records references and review decisions; it does not upload media, render a proof, deliver a gallery, or confirm publication without configured connectors.</p>
    <p>An operator must apply the governed migration and assign your account a tenant membership and workflow role before this page can load cases.</p>
    <label>Tenant ID <input value={tenant} onChange={e => { setTenant(e.target.value); localStorage.setItem(storageKey, e.target.value); }} placeholder="Your assigned tenant ID" /></label>
    <button type="button" onClick={refresh} disabled={!tenant.trim()}>Refresh</button>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {policy && <p>Required human review: {policy.professionalBoundary}</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(420px, 2fr)', gap: 24 }}>
      <div>
        <h2>Release cases</h2>
        <form onSubmit={createCase}>
          <label>Opaque shoot or gallery reference <input required value={subjectRef} onChange={e => setSubjectRef(e.target.value)} placeholder="gallery:123" /></label>
          <label>Policy version <input required value={policyVersion} onChange={e => setPolicyVersion(e.target.value)} /></label>
          <button disabled={busy || !tenant.trim()} type="submit">Create case</button>
        </form>
        {cases.length === 0 ? <p>No cases in this tenant.</p> : <ul>{cases.map(row =>
          <li key={row.id}><button type="button" onClick={() => selectCase(row)}>{row.subject_ref} · {row.state} · v{row.version}</button></li>
        )}</ul>}
      </div>
      <div>
        {!selected ? <p>Select a release case to inspect its evidence and reviews.</p> : <>
          <h2>{selected.subject_ref}</h2>
          <p>State: {selected.state}; version {selected.version}</p>
          {selected.subject_ref.startsWith('gallery:') && <LocalGalleryWorkbench caseId={selected.id} tenant={tenant.trim()} evidence={selected.evidence || []} />}
          <h3>Evidence references</h3>
          <ul>{(selected.evidence || []).map(item => <li key={item.id}>{item.kind} · {item.source_ref} · {item.source_version} · SHA-256 {item.sha256}</li>)}</ul>
          <form onSubmit={addEvidence}>
            <select value={evidence.kind} onChange={e => setEvidence({ ...evidence, kind: e.target.value })}>
              {(policy?.evidenceKinds || []).map(kind => <option key={kind} value={kind}>{kind}</option>)}
            </select>
            <input required placeholder="Opaque storage reference" value={evidence.sourceRef} onChange={e => setEvidence({ ...evidence, sourceRef: e.target.value })} />
            <input required placeholder="Source version" value={evidence.sourceVersion} onChange={e => setEvidence({ ...evidence, sourceVersion: e.target.value })} />
            <input required minLength="64" maxLength="64" placeholder="SHA-256 digest" value={evidence.sha256} onChange={e => setEvidence({ ...evidence, sha256: e.target.value })} />
            <input placeholder="Consent or processing basis" value={evidence.consentBasis} onChange={e => setEvidence({ ...evidence, consentBasis: e.target.value })} />
            <button disabled={busy} type="submit">Record evidence</button>
          </form>
          <h3>Assess release signals</h3>
          <p>Paste versioned signals from approved sources. This check flags missing or inconsistent signals and never publishes a gallery.</p>
          <form onSubmit={assess}>
            <textarea rows="7" style={{ width: '100%' }} required value={assessment} onChange={e => setAssessment(e.target.value)}
              placeholder='{"sourceVersion":"s1","timelineVersion":"t1","assetVersion":"a1","renderVersion":"r1","rightsStatus":"verified","consentStatus":"verified","moderationStatus":"passed","accessibilityStatus":"passed","markupStatus":"approved","timingFidelity":0.99,"layoutFidelity":0.99,"exportProfile":"web_gallery","policyVersion":"v1"}' />
            <button disabled={busy} type="submit">Assess for review</button>
          </form>
          {assessmentResult && <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(assessmentResult, null, 2)}</pre>}
          <h3>Human decision</h3>
          <form onSubmit={transition}>
            <select required value={decision.action} onChange={e => setDecision({ ...decision, action: e.target.value })}>
              <option value="">Choose action</option>{actions.map(item => <option key={item.action} value={item.action} disabled={providerActions.has(item.action)}>{item.action} → {item.to}{providerActions.has(item.action) ? ' (connector unavailable)' : ''}</option>)}
            </select>
            <input required minLength="8" placeholder="Specific decision reason" value={decision.reason} onChange={e => setDecision({ ...decision, reason: e.target.value })} />
            <button disabled={busy || !actions.length} type="submit">Record decision</button>
          </form>
          <h3>Audit trail</h3>
          <ul>{history.map(item => <li key={item.id}>{item.created_at}: {item.actor_id} · {item.action} · {item.reason}</li>)}</ul>
        </>}
      </div>
    </div>
  </div>;
}
