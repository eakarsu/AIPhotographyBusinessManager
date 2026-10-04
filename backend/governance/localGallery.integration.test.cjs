'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const multer = require('multer');
const { createStaffGalleryRouter, createClientGalleryRouter } = require('./localGalleryRouter');
const { pngDimensions, sha256 } = require('./proofPreview');

const source = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVQI12P0d3vKgA0wMeAAg1MCACrdAYobYDjAAAAAAElFTkSuQmCC', 'base64');
const secondSource = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFUlEQVQI12MUW+zFgA0wMeAAg1MCAM8mARMrM6LjAAAAAElFTkSuQmCC', 'base64');

test('Postgres gallery flow serves watermarked previews and gates originals by rights and final link', {
  skip: process.env.RUN_GALLERY_DB_TEST !== '1' && 'requires a disposable migrated PostgreSQL database and ImageMagick',
}, async () => {
  const pool = require('../db');
  const database = (await pool.query('SELECT current_database() AS name')).rows[0].name;
  if (!/^codex_photo_preview_test_/.test(database)) {
    await pool.end();
    throw new Error('integration test refuses a non-disposable database');
  }
  const db = {
    query: async (sql, params) => (await pool.query(sql, params)).rows,
    transaction: async work => {
      const connection = await pool.connect();
      try {
        await connection.query('BEGIN');
        const result = await work(async (sql, params) => (await connection.query(sql, params)).rows);
        await connection.query('COMMIT');
        return result;
      } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
      } finally { connection.release(); }
    },
  };
  const tenant = 'tenant-proof-test';
  const caseId = crypto.randomUUID();
  const clientId = (await pool.query('INSERT INTO clients DEFAULT VALUES RETURNING id')).rows[0].id;
  const galleryId = (await pool.query('INSERT INTO galleries(client_id,title) VALUES ($1,$2) RETURNING id',
    [clientId,'Verified proof gallery'])).rows[0].id;
  const shootId = (await pool.query('INSERT INTO shoots(client_id,title,shoot_date) VALUES ($1,$2,CURRENT_DATE) RETURNING id',
    [clientId,'Studio shoot'])).rows[0].id;
  await pool.query(
    `INSERT INTO governed_cases(id,tenant_id,idempotency_key,case_type,subject_ref,state,policy_version,effective_at,created_by)
     VALUES ($1,$2,'preview-case','versioned_photography_proof_release',$3,'source_registered','v1',NOW(),'staff-1')`,
    [caseId,tenant,`gallery:${galleryId}`]
  );
  await pool.query('INSERT INTO governed_client_bindings(client_id,tenant_id,bound_by) VALUES ($1,$2,$3)',
    [clientId,tenant,'operator']);
  await pool.query('INSERT INTO governed_gallery_bindings(gallery_id,client_id,tenant_id,bound_by) VALUES ($1,$2,$3,$4)',
    [galleryId,clientId,tenant,'operator']);
  const rightsId = crypto.randomUUID();
  const consentId = crypto.randomUUID();
  for (const [id,kind] of [[rightsId,'rights_license'],[consentId,'consent_release']]) {
    await pool.query(
      `INSERT INTO governed_evidence(id,tenant_id,case_id,idempotency_key,kind,source_ref,source_version,
        sha256,captured_at,metadata,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'v1',$7,NOW(),'{}'::jsonb,'reviewer')`,
      [id,tenant,caseId,`evidence-${kind}`,kind,`vault:${kind}`,sha256(Buffer.from(kind))]
    );
  }

  const app = express();
  app.use(express.json());
  app.use('/staff', (req, _res, next) => {
    req.user = { id:'staff-1', role:req.get('X-Test-Role') || 'photographer' };
    req.governanceScope = '*';
    next();
  }, createStaffGalleryRouter({ express, db, multer }));
  app.use('/client', createClientGalleryRouter({ express, db }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  const staffPath = `/staff/cases/${caseId}/local-gallery`;
  const staff = (path, options = {}) => fetch(`${root}${staffPath}${path}`, {
    ...options, headers:{ 'X-Tenant-Id':tenant, ...options.headers },
  });
  const client = (path, token, options = {}) => fetch(`${root}/client${path}`, {
    ...options, headers:{ 'X-Gallery-Token':token, ...options.headers },
  });
  const jsonPost = (path, role, body) => staff(path, {
    method:'POST',headers:{ 'Content-Type':'application/json','X-Test-Role':role },body:JSON.stringify(body),
  });

  try {
    const form = new FormData();
    form.set('shootId',String(shootId));
    form.set('photo',new Blob([source],{ type:'image/png' }),'fixture.png');
    const uploaded = await staff('/photos',{ method:'POST',body:form });
    assert.equal(uploaded.status,201,await uploaded.clone().text());
    const asset = await uploaded.json();
    const assetId = Number(asset.id);
    assert.match(asset.proofId,/^P-[A-F0-9]{8}-\d+$/);
    assert.match(asset.previewSha256,/^[a-f0-9]{64}$/);
    const manifest = await staff('');
    assert.equal(manifest.status,200);
    const listed = await manifest.json();
    assert.equal(listed.assets[0].preview_ready,true);
    assert.equal(listed.assets[0].rights_decision,null);
    assert.equal((await staff('/proof-link',{ method:'POST' })).status,409);
    assert.equal((await staff('',{ headers:{ 'X-Tenant-Id':'other-tenant' } })).status,404);
    const staffPreview = await staff(`/assets/${assetId}/preview`);
    assert.equal(staffPreview.status,200);
    const preview = Buffer.from(await staffPreview.arrayBuffer());
    assert.deepEqual(pngDimensions(preview),{ width:640,height:480 });
    assert.equal(sha256(preview),asset.previewSha256);
    assert.notDeepEqual(preview,source);
    await assert.rejects(pool.query('UPDATE governed_gallery_previews SET preview_data=$1 WHERE asset_id=$2',
      [source,assetId]),/append-only/);
    assert.equal((await staff(`/assets/${assetId}/render-preview`,{ method:'POST' })).status,200);

    const approved = await jsonPost(`/assets/${assetId}/rights`,'rights_reviewer',{
      decision:'approved',reason:'License and release reviewed',rightsEvidenceId:rightsId,consentEvidenceId:consentId,
    });
    assert.equal(approved.status,201,await approved.clone().text());
    const proof = await staff('/proof-link',{ method:'POST' });
    assert.equal(proof.status,201,await proof.clone().text());
    const proofToken = (await proof.json()).token;
    const clientList = await client('/',proofToken);
    assert.equal(clientList.status,200);
    const proofAsset = (await clientList.json()).assets[0];
    assert.equal(proofAsset.proofId,asset.proofId);
    assert.equal(proofAsset.previewSha256,asset.previewSha256);
    const clientPreview = await client(`/assets/${assetId}`,proofToken);
    assert.equal(clientPreview.status,200);
    assert.equal(clientPreview.headers.get('x-proof-id'),asset.proofId);
    assert.deepEqual(Buffer.from(await clientPreview.arrayBuffer()),preview);
    assert.equal((await client(`/assets/${assetId}/download`,proofToken)).status,403);
    assert.equal((await client(`/assets/${assetId}`, 'c'.repeat(64))).status,403);
    const selected = await client('/selection',proofToken,{
      method:'POST',headers:{ 'Content-Type':'application/json' },body:JSON.stringify({assetIds:[assetId]}),
    });
    assert.equal(selected.status,200,await selected.clone().text());
    const final = await jsonPost('/final-link','studio_manager',{ reason:'Client picked approved proof' });
    assert.equal(final.status,201,await final.clone().text());
    const finalToken = (await final.json()).token;
    const original = await client(`/assets/${assetId}/download`,finalToken);
    assert.equal(original.status,200);
    assert.deepEqual(Buffer.from(await original.arrayBuffer()),source);
    const events = await pool.query('SELECT event_type FROM governed_gallery_events WHERE tenant_id=$1 AND case_id=$2',
      [tenant,caseId]);
    assert.ok(events.rows.some(row => row.event_type === 'preview_requested'));
    assert.ok(events.rows.some(row => row.event_type === 'download_requested'));

    const hold = await jsonPost(`/assets/${assetId}/rights`,'rights_reviewer',{
      decision:'hold',reason:'Client revoked image release',
    });
    assert.equal(hold.status,201);
    assert.equal((await client(`/assets/${assetId}`,proofToken)).status,404);
    assert.equal((await client(`/assets/${assetId}/download`,finalToken)).status,404);

    const older = await pool.query(
      `INSERT INTO governed_gallery_assets
       (tenant_id,case_id,gallery_id,shoot_id,file_name,mime_type,file_size,file_sha256,file_data,uploaded_by)
       VALUES ($1,$2,$3,$4,'older.png','image/png',$5,$6,$7,'staff-1') RETURNING id`,
      [tenant,caseId,galleryId,shootId,secondSource.length,sha256(secondSource),secondSource]
    );
    const olderId = Number(older.rows[0].id);
    assert.equal((await staff(`/assets/${olderId}/preview`)).status,404);
    const backfilled = await staff(`/assets/${olderId}/render-preview`,{ method:'POST' });
    assert.equal(backfilled.status,201,await backfilled.clone().text());
    assert.equal((await staff(`/assets/${olderId}/preview`)).status,200);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve,reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.end();
  }
});
