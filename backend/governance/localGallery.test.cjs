const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const multer = require('multer');
const { createStaffGalleryRouter, createClientGalleryRouter, imageType, safeName, digest } = require('./localGalleryRouter');
const { renderProofPreview, pngDimensions, verifiedPreview } = require('./proofPreview');
const { createGovernedRouter } = require('./routerFactory');

const caseId = '11111111-1111-4111-8111-111111111111';
const proofId = '22222222-2222-4222-8222-222222222222';
const finalId = '33333333-3333-4333-8333-333333333333';
const proofToken = 'a'.repeat(64);
const finalToken = 'b'.repeat(64);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVQI12P0d3vKgA0wMeAAg1MCACrdAYobYDjAAAAAAElFTkSuQmCC', 'base64');

async function withServer(app, work) {
  const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  try { return await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('image upload accepts stored image formats and removes unsafe filename characters', () => {
  assert.equal(imageType(png), 'image/png');
  assert.equal(imageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), null);
  assert.equal(safeName('folder/photo\nname.png'), 'photo_name.png');
  assert.equal(digest(png).length, 64);
});

test('local preview renderer rejects a corrupt image and verifies watermark metadata and digest', async () => {
  const preview = await renderProofPreview(png, 'image/png', 'P-11111111-10');
  const row = { asset_id:10,case_id:caseId,preview_data:preview.bytes,
    preview_size:preview.bytes.length,mime_type:preview.mimeType,
    preview_sha256:preview.sha256,proof_id:preview.proofId,
    watermark_version:preview.watermarkVersion };
  assert.deepEqual(verifiedPreview(row),preview.bytes);
  assert.throws(() => verifiedPreview({ ...row,preview_sha256:'0'.repeat(64) }),/checksum/);
  const corrupt = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64');
  await assert.rejects(renderProofPreview(corrupt,'image/png','P-11111111-10'),/could not be rendered|could not be decoded/);
});

test('client proof token only exposes rights-approved images; final token gates and audits downloads', async () => {
  const preview = await renderProofPreview(png, 'image/png', 'P-11111111-10');
  const events = [];
  let selection = null;
  const db = {
    query: async (sql, params) => {
      if (sql.includes('FROM governed_gallery_access a JOIN galleries')) {
        const purpose = params[0] === digest(proofToken) ? 'proof' : params[0] === digest(finalToken) ? 'final' : null;
        return purpose ? [{ id: purpose === 'proof' ? proofId : finalId, tenant_id: 'tenant-a', case_id: caseId,
          gallery_id: 4, purpose, expires_at: new Date('2026-11-01'), gallery_title: 'Client gallery' }] : [];
      }
      if (sql.includes('FROM governed_gallery_assets a')) return [
        { id: 10, file_name: 'approved.png', mime_type: 'image/png', file_size: png.length, file_sha256: digest(png), rights_decision: 'approved',
          proof_id: preview.proofId, preview_sha256: preview.sha256, preview_ready: true },
        { id: 11, file_name: 'held.png', mime_type: 'image/png', file_size: png.length, file_sha256: digest(png), rights_decision: 'hold',
          proof_id: 'P-11111111-11', preview_ready: true },
      ];
      if (sql.includes('FROM governed_gallery_deliveries WHERE access_id')) return [{ asset_ids: [10] }];
      if (sql.includes('SELECT asset_ids, submitted_at FROM governed_gallery_proof_selections')) return selection ? [selection] : [];
      if (sql.includes('SELECT id FROM governed_cases') && sql.includes('FOR UPDATE')) return [{ id: caseId }];
      if (sql.includes('SELECT id FROM governed_gallery_deliveries')) return [];
      if (sql.includes('INSERT INTO governed_gallery_proof_selections')) {
        selection = { asset_ids: params[3], version: 1, submitted_at: new Date('2026-10-04') };
        return [selection];
      }
      if (sql.includes('SELECT * FROM governed_gallery_previews')) return [{
        asset_id:10,case_id:caseId,preview_data: preview.bytes,preview_size:preview.bytes.length,
        mime_type: preview.mimeType, preview_sha256: preview.sha256, proof_id: preview.proofId,
        watermark_version:preview.watermarkVersion,
      }];
      if (sql.includes('SELECT file_data, mime_type, file_name, file_size, file_sha256 FROM governed_gallery_assets')) return [{
        file_data: png, mime_type: 'image/png', file_name: 'approved.png', file_size: png.length, file_sha256: digest(png),
      }];
      if (sql.includes('INSERT INTO governed_gallery_events')) { events.push(params[5]); return []; }
      throw new Error(`Unexpected query: ${sql}`);
    },
    transaction: async work => work((sql, params) => db.query(sql, params)),
  };
  const app = express();
  app.use(express.json());
  app.use('/api/client-gallery', createClientGalleryRouter({ express, db }));
  await withServer(app, async base => {
    const request = (path, token, options = {}) => fetch(`${base}/api/client-gallery${path}`, {
      ...options, headers: { 'X-Gallery-Token': token, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const proof = await request('/', proofToken);
    assert.equal(proof.status, 200);
    const proofBody = await proof.json();
    assert.deepEqual(proofBody.assets.map(item => item.id), [10]);
    assert.equal(proofBody.assets[0].proofId, preview.proofId);
    const proofImage = await request('/assets/10', proofToken);
    assert.equal(proofImage.status, 200);
    assert.equal(proofImage.headers.get('x-proof-id'), preview.proofId);
    const previewBytes = Buffer.from(await proofImage.arrayBuffer());
    assert.deepEqual(pngDimensions(previewBytes), { width: 640, height: 480 });
    assert.notDeepEqual(previewBytes, png);
    assert.ok(events.includes('preview_requested'));
    assert.equal((await request('/assets/10/download', proofToken)).status, 403);
    assert.equal((await request('/assets/11', proofToken)).status, 404);
    const badSelection = await request('/selection', proofToken, { method: 'POST', body: JSON.stringify({ assetIds: [11] }) });
    assert.equal(badSelection.status, 403);
    const selected = await request('/selection', proofToken, { method: 'POST', body: JSON.stringify({ assetIds: [10] }) });
    assert.equal(selected.status, 200);
    assert.equal((await selected.json()).actor, 'proof_link_holder');
    const final = await request('/', finalToken);
    assert.equal(final.status, 200);
    assert.deepEqual((await final.json()).assets.map(item => item.id), [10]);
    const download = await request('/assets/10/download', finalToken);
    assert.equal(download.status, 200);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
    assert.ok(events.includes('download_requested'));
    assert.equal((await request('/', 'c'.repeat(64))).status, 403);
  });
});

test('staff upload requires a tenant-bound gallery and rights approval requires both case evidence types', async () => {
  let bound = false;
  let rightsApproved = false;
  let proofSelected = false;
  const events = [];
  const rightsId = '44444444-4444-4444-8444-444444444444';
  const consentId = '55555555-5555-4555-8555-555555555555';
  const db = {
    query: async (sql, params) => {
      if (sql.includes('FROM governed_cases') && sql.includes('subject_ref')) {
        return params[1] === 'tenant-a' ? [{ id: caseId, tenant_id: 'tenant-a', subject_ref: 'gallery:4', state: 'source_registered' }] : [];
      }
      if (sql.includes('FROM galleries g') && sql.includes('governed_gallery_bindings')) return bound ? [{ id: 4, client_id: 5, title: 'Gallery' }] : [];
      if (sql.includes('FROM shoots WHERE id=$1 AND client_id=$2')) return params[0] === 6 && params[1] === 5 ? [{ id: 6 }] : [];
      if (sql.includes('INSERT INTO governed_gallery_assets')) return [{ id: 10, file_name: 'photo.png', mime_type: 'image/png', file_size: png.length, file_sha256: digest(png), shoot_id: 6 }];
      if (sql.includes('INSERT INTO governed_gallery_previews')) return [];
      if (sql.includes('INSERT INTO governed_evidence')) return [];
      if (sql.includes('SELECT id FROM governed_gallery_assets')) return [{ id: 10 }];
      if (sql.includes('FROM governed_gallery_assets a')) return [{ id: 10, file_name: 'photo.png', mime_type: 'image/png', file_size: png.length, file_sha256: digest(png),
        rights_decision: rightsApproved ? 'approved' : null, preview_ready: true }];
      if (sql.includes('FROM governed_evidence WHERE')) return [
        { id: rightsId, kind: 'rights_license' }, { id: consentId, kind: 'consent_release' },
      ];
      if (sql.includes('INSERT INTO governed_gallery_rights_checks')) { rightsApproved = params[4] === 'approved'; return [{ id: 'check-1', asset_id: 10, decision: params[4] }]; }
      if (sql.includes('SELECT id FROM governed_cases') && sql.includes('FOR UPDATE')) return [{ id: caseId }];
      if (sql.includes('SELECT id FROM governed_gallery_deliveries')) return [];
      if (sql.includes('SELECT asset_ids FROM governed_gallery_proof_selections')) return proofSelected ? [{ asset_ids: [10] }] : [];
      if (sql.includes('SELECT asset_ids FROM governed_gallery_deliveries')) return [];
      if (sql.includes('INSERT INTO governed_gallery_access')) return [];
      if (sql.includes('INSERT INTO governed_gallery_deliveries')) return [];
      if (sql.includes('INSERT INTO governed_gallery_events')) { events.push(params[5]); return []; }
      throw new Error(`Unexpected query: ${sql}`);
    },
    transaction: async work => work((sql, params) => db.query(sql, params)),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 42, role: req.headers['x-test-role'] || 'photographer' };
    req.governanceScope = '*';
    next();
  });
  app.use('/api/governed-photography-releases', createStaffGalleryRouter({ express, db, multer }));
  await withServer(app, async base => {
    const root = `${base}/api/governed-photography-releases/cases/${caseId}/local-gallery`;
    const headers = { 'X-Tenant-Id': 'tenant-a' };
    const missingBinding = await fetch(root, { headers });
    assert.equal(missingBinding.status, 409);
    bound = true;
    const wrongTenant = await fetch(root, { headers: { 'X-Tenant-Id': 'tenant-b' } });
    assert.equal(wrongTenant.status, 404);
    const form = new FormData();
    form.append('shootId', '6');
    form.append('photo', new Blob([png], { type: 'image/png' }), 'photo.png');
    const uploaded = await fetch(`${root}/photos`, { method: 'POST', headers, body: form });
    assert.equal(uploaded.status, 201);
    assert.equal((await uploaded.json()).rightsDecision, 'pending');
    const noEvidence = await fetch(`${root}/assets/10/rights`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Test-Role': 'rights_reviewer' },
      body: JSON.stringify({ decision: 'approved', reason: 'Client release checked' }) });
    assert.equal(noEvidence.status, 400);
    const approved = await fetch(`${root}/assets/10/rights`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Test-Role': 'rights_reviewer' },
      body: JSON.stringify({ decision: 'approved', reason: 'Client release checked', rightsEvidenceId: rightsId, consentEvidenceId: consentId }) });
    assert.equal(approved.status, 201);
    const proofLink = await fetch(`${root}/proof-link`, { method: 'POST', headers });
    assert.equal(proofLink.status, 201);
    assert.equal((await proofLink.json()).token.length, 64);
    const prematureFinal = await fetch(`${root}/final-link`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Test-Role': 'studio_manager' },
      body: JSON.stringify({ reason: 'Approved final selection' }) });
    assert.equal(prematureFinal.status, 409);
    proofSelected = true;
    const finalLink = await fetch(`${root}/final-link`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-Test-Role': 'studio_manager' },
      body: JSON.stringify({ reason: 'Approved final selection' }) });
    assert.equal(finalLink.status, 201);
    assert.deepEqual((await finalLink.json()).assetIds, [10]);
    assert.ok(events.includes('photo_uploaded'));
    assert.ok(events.includes('rights_attested'));
    assert.ok(events.includes('final_link_created'));
  });
});

test('generic workflow rejects external publish and render transitions without connectors', async () => {
  const db = {
    query: async sql => sql.includes('FROM governed_tenant_memberships')
      ? [{ role: 'studio_manager', subject_ref_prefix: '*' }] : [],
    transaction: async () => { throw new Error('A provider transition must never reach the database transaction.'); },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/governed-photography-releases', createGovernedRouter({
    express, db,
    auth: (req, _res, next) => { req.user = { id: 42 }; next(); },
    workflow: { config: { connectors: [], states: [], transitions: [] } },
  }));
  await withServer(app, async base => {
    const response = await fetch(`${base}/api/governed-photography-releases/cases/${caseId}/transitions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': 'tenant-a' },
      body: JSON.stringify({ action: 'record_publish', expectedVersion: 1, reason: 'No provider receipt' }),
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'CONNECTOR_UNCONFIGURED');
  });
});
