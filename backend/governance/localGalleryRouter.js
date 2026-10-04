const crypto = require('node:crypto');
const path = require('node:path');
const { proofIdentifier, renderProofPreview, verifiedPreview } = require('./proofPreview');

const CASE_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const TENANT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function problem(code, status, message) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function respondError(res, error) {
  if (error.code === '23505') return res.status(409).json({ error: 'DUPLICATE_ASSET_OR_ACCESS' });
  return res.status(error.status || 500).json({
    error: error.code || 'LOCAL_GALLERY_FAILURE',
    message: error.status ? error.message : 'The local gallery operation could not complete.',
  });
}

function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function imageType(buffer) {
  if (buffer.length >= 12 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) &&
      buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) return 'image/jpeg';
  if (buffer.length >= 45 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      buffer.toString('ascii', 12, 16) === 'IHDR' && buffer.readUInt32BE(16) > 0 && buffer.readUInt32BE(20) > 0 &&
      buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND') return 'image/png';
  if (buffer.length >= 20 && buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.readUInt32LE(4) === buffer.length - 8 && buffer.toString('ascii', 8, 12) === 'WEBP' &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))) return 'image/webp';
  return null;
}

function safeName(name) {
  return path.basename(String(name || 'image')).replace(/[\r\n"\\\x00-\x1f]/g, '_').slice(0, 255) || 'image';
}

function parseId(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw problem('INVALID_ID', 400, `${label} must be a positive integer.`);
  return number;
}

function allowed(role, roles) {
  if (!roles.includes(role)) throw problem('ROLE_REQUIRED', 403, 'Your governed role cannot perform this action.');
}

async function caseContext(db, req) {
  const tenantId = String(req.headers['x-tenant-id'] || '');
  const actorId = String(req.user?.id || '');
  const role = String(req.user?.role || '');
  const scope = String(req.governanceScope || '');
  if (!TENANT.test(tenantId) || !TENANT.test(actorId) || !TENANT.test(role) || !scope) {
    throw problem('TENANT_MEMBERSHIP_REQUIRED', 403, 'A governed tenant membership is required.');
  }
  if (!CASE_ID.test(String(req.params.id || ''))) throw problem('CASE_ID_INVALID', 400, 'A valid case ID is required.');
  const rows = await db.query(
    `SELECT id, tenant_id, subject_ref, state FROM governed_cases
     WHERE id=$1 AND tenant_id=$2 AND ($3='*' OR left(subject_ref,char_length($3))=$3)`,
    [req.params.id, tenantId, scope]
  );
  const item = rows[0];
  if (!item) throw problem('CASE_NOT_FOUND', 404, 'Release case not found in your tenant scope.');
  const match = /^gallery:([1-9][0-9]*)$/.exec(item.subject_ref);
  if (!match) throw problem('GALLERY_REFERENCE_REQUIRED', 409, 'Case subject must be gallery:<saved gallery ID>.');
  const galleryId = parseId(match[1], 'gallery ID');
  const galleries = await db.query(
    `SELECT g.id, g.client_id, g.title FROM galleries g
     JOIN governed_gallery_bindings b ON b.gallery_id=g.id AND b.client_id=g.client_id AND b.tenant_id=$2
     WHERE g.id=$1`, [galleryId, tenantId]
  );
  if (!galleries[0] || !galleries[0].client_id) {
    throw problem('GALLERY_BINDING_REQUIRED', 409, 'An operator must bind this gallery and client to the governed tenant first.');
  }
  return { tenantId, actorId, role, scope, item, gallery: galleries[0] };
}

async function assetsForCase(query, ctx) {
  return query(
    `SELECT a.id, a.file_name, a.mime_type, a.file_size, a.file_sha256, a.shoot_id, a.created_at,
            p.proof_id, p.preview_sha256, (p.asset_id IS NOT NULL) AS preview_ready,
            r.decision AS rights_decision, r.reason AS rights_reason, r.reviewed_by,
            r.rights_evidence_id, r.consent_evidence_id, r.created_at AS rights_checked_at
     FROM governed_gallery_assets a
     LEFT JOIN governed_gallery_previews p
       ON p.asset_id=a.id AND p.tenant_id=a.tenant_id AND p.case_id=a.case_id
     LEFT JOIN LATERAL (
       SELECT decision, reason, reviewed_by, rights_evidence_id, consent_evidence_id, created_at
       FROM governed_gallery_rights_checks
       WHERE tenant_id=a.tenant_id AND case_id=a.case_id AND asset_id=a.id
       ORDER BY created_at DESC, id DESC LIMIT 1
     ) r ON TRUE
     WHERE a.tenant_id=$1 AND a.case_id=$2 ORDER BY a.created_at, a.id`,
    [ctx.tenantId, ctx.item?.id || ctx.case_id]
  );
}

async function event(query, ctx, type, details = {}, assetId = null, accessId = null, actorRef = ctx.actorId) {
  await query(
    `INSERT INTO governed_gallery_events
      (id, tenant_id, case_id, access_id, asset_id, event_type, actor_ref, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [crypto.randomUUID(), ctx.tenantId, ctx.item?.id || ctx.case_id, accessId, assetId,
      type, String(actorRef), JSON.stringify(details)]
  );
}

function noStore(res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

function createStaffGalleryRouter({ express, db, multer }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  });

  router.get('/cases/:id/local-gallery', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      const [shoots, assets, selections, access, deliveries, history] = await Promise.all([
        db.query('SELECT id, title, shoot_date FROM shoots WHERE client_id=$1 ORDER BY shoot_date DESC NULLS LAST, id DESC', [ctx.gallery.client_id]),
        assetsForCase(db.query, ctx),
        db.query('SELECT asset_ids, version, submitted_at FROM governed_gallery_proof_selections WHERE tenant_id=$1 AND case_id=$2', [ctx.tenantId, ctx.item.id]),
        db.query('SELECT id, purpose, expires_at, revoked_at, created_at FROM governed_gallery_access WHERE tenant_id=$1 AND case_id=$2 ORDER BY created_at DESC LIMIT 30', [ctx.tenantId, ctx.item.id]),
        db.query('SELECT id, asset_ids, issued_at FROM governed_gallery_deliveries WHERE tenant_id=$1 AND case_id=$2 ORDER BY issued_at DESC LIMIT 10', [ctx.tenantId, ctx.item.id]),
        db.query('SELECT id, event_type, actor_ref, asset_id, details, created_at FROM governed_gallery_events WHERE tenant_id=$1 AND case_id=$2 ORDER BY created_at DESC LIMIT 100', [ctx.tenantId, ctx.item.id]),
      ]);
      noStore(res);
      res.json({
        gallery: { id: ctx.gallery.id, title: ctx.gallery.title, clientId: ctx.gallery.client_id },
        role: ctx.role,
        shoots, assets, proofSelection: selections[0] || null, access, deliveries, history,
        storageMode: 'postgres_bytea_local',
        deliveryMode: 'manual_link_handoff',
        providerStatus: { previewRenderer: 'local_imagemagick', objectStorage: 'unconfigured',
          cdn: 'unconfigured', messaging: 'not_called' },
      });
    } catch (error) { respondError(res, error); }
  });

  router.post('/cases/:id/local-gallery/photos', (req, res, next) => {
    upload.single('photo')(req, res, error => {
      if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'PHOTO_UPLOAD_REJECTED', message: error.message });
      next();
    });
  }, async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['photographer', 'studio_manager']);
      if (!req.file) throw problem('PHOTO_REQUIRED', 400, 'Upload one JPEG, PNG, or WebP image.');
      const actualType = imageType(req.file.buffer);
      if (!actualType || actualType !== req.file.mimetype) throw problem('IMAGE_TYPE_MISMATCH', 400, 'Image bytes and declared type must match.');
      const shootId = parseId(req.body?.shootId, 'shoot ID');
      const shoots = await db.query('SELECT id FROM shoots WHERE id=$1 AND client_id=$2', [shootId, ctx.gallery.client_id]);
      if (!shoots[0]) throw problem('SHOOT_NOT_IN_GALLERY_CLIENT', 403, 'Shoot does not belong to this gallery client.');
      const fileSha256 = digest(req.file.buffer);
      const result = await db.transaction(async query => {
        const rows = await query(
          `INSERT INTO governed_gallery_assets
            (tenant_id, case_id, gallery_id, shoot_id, file_name, mime_type, file_size, file_sha256, file_data, uploaded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (tenant_id, case_id, file_sha256) DO NOTHING
           RETURNING id, file_name, mime_type, file_size, file_sha256, shoot_id, created_at`,
          [ctx.tenantId, ctx.item.id, ctx.gallery.id, shootId, safeName(req.file.originalname),
            actualType, req.file.size, fileSha256, req.file.buffer, ctx.actorId]
        );
        if (!rows[0]) throw problem('DUPLICATE_PHOTO', 409, 'This image is already stored in the case.');
        const preview = await renderProofPreview(req.file.buffer, actualType, proofIdentifier(ctx.item.id, rows[0].id));
        await query(
          `INSERT INTO governed_gallery_previews
           (asset_id,tenant_id,case_id,proof_id,mime_type,width,height,watermark_version,
            preview_size,preview_sha256,preview_data,generated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [rows[0].id,ctx.tenantId,ctx.item.id,preview.proofId,preview.mimeType,
            preview.width,preview.height,preview.watermarkVersion,preview.bytes.length,
            preview.sha256,preview.bytes,ctx.actorId]
        );
        await query(
          `INSERT INTO governed_evidence
            (id, tenant_id, case_id, idempotency_key, kind, source_ref, source_version, sha256, captured_at, metadata, created_by)
           VALUES ($1,$2,$3,$4,'source_manifest',$5,'v1',$6,NOW(),'{}'::jsonb,$7)`,
          [crypto.randomUUID(), ctx.tenantId, ctx.item.id, `local-upload:${rows[0].id}`,
            `local-gallery-asset:${rows[0].id}`, fileSha256, ctx.actorId]
        );
        await event(query, ctx, 'photo_uploaded', { storageMode: 'postgres_bytea_local', sha256: fileSha256,
          proofId: preview.proofId, previewSha256: preview.sha256 }, rows[0].id);
        return { ...rows[0], proofId: preview.proofId, previewSha256: preview.sha256 };
      });
      res.status(201).json({ ...result, rightsDecision: 'pending' });
    } catch (error) { respondError(res, error); }
  });

  router.get('/cases/:id/local-gallery/assets/:assetId', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['photographer','studio_manager','rights_reviewer','auditor']);
      const assetId = parseId(req.params.assetId, 'asset ID');
      const rows = await db.query(
        'SELECT file_name, mime_type, file_data, file_size, file_sha256 FROM governed_gallery_assets WHERE tenant_id=$1 AND case_id=$2 AND id=$3',
        [ctx.tenantId, ctx.item.id, assetId]
      );
      if (!rows[0]) throw problem('ASSET_NOT_FOUND', 404, 'Image not found in this case.');
      if (rows[0].file_data.length !== rows[0].file_size || digest(rows[0].file_data) !== rows[0].file_sha256) {
        throw problem('ORIGINAL_CHECKSUM_MISMATCH', 409, 'Stored image does not match its SHA-256 metadata.');
      }
      noStore(res);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName(rows[0].file_name)}"`);
      res.type(rows[0].mime_type).send(rows[0].file_data);
    } catch (error) { respondError(res, error); }
  });

  router.get('/cases/:id/local-gallery/assets/:assetId/preview', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['photographer','studio_manager','rights_reviewer','auditor']);
      const assetId = parseId(req.params.assetId, 'asset ID');
      const rows = await db.query(
        'SELECT * FROM governed_gallery_previews WHERE tenant_id=$1 AND case_id=$2 AND asset_id=$3',
        [ctx.tenantId, ctx.item.id, assetId]
      );
      if (!rows[0]) throw problem('PREVIEW_NOT_FOUND', 404, 'No safe proof preview is stored for this image.');
      const bytes = verifiedPreview(rows[0]);
      noStore(res);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Proof-Id', rows[0].proof_id);
      res.type('png').send(bytes);
    } catch (error) { respondError(res, error); }
  });

  router.post('/cases/:id/local-gallery/assets/:assetId/render-preview', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['photographer','studio_manager']);
      const assetId = parseId(req.params.assetId, 'asset ID');
      const result = await db.transaction(async query => {
        const rows = await query(
          `SELECT file_data,file_size,file_sha256,mime_type FROM governed_gallery_assets
           WHERE tenant_id=$1 AND case_id=$2 AND id=$3 FOR UPDATE`,
          [ctx.tenantId,ctx.item.id,assetId]
        );
        if (!rows[0]) throw problem('ASSET_NOT_FOUND', 404, 'Image not found in this case.');
        const original = rows[0];
        const existing = await query(
          'SELECT * FROM governed_gallery_previews WHERE tenant_id=$1 AND case_id=$2 AND asset_id=$3',
          [ctx.tenantId,ctx.item.id,assetId]
        );
        if (existing[0]) {
          verifiedPreview(existing[0]);
          return { proofId:existing[0].proof_id,previewSha256:existing[0].preview_sha256,replayed:true };
        }
        if (original.file_data.length !== original.file_size || digest(original.file_data) !== original.file_sha256 ||
            imageType(original.file_data) !== original.mime_type) {
          throw problem('ORIGINAL_CHECKSUM_MISMATCH', 409, 'Stored image does not match its immutable metadata.');
        }
        const preview = await renderProofPreview(original.file_data,original.mime_type,proofIdentifier(ctx.item.id,assetId));
        await query(
          `INSERT INTO governed_gallery_previews
           (asset_id,tenant_id,case_id,proof_id,mime_type,width,height,watermark_version,
            preview_size,preview_sha256,preview_data,generated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [assetId,ctx.tenantId,ctx.item.id,preview.proofId,preview.mimeType,
            preview.width,preview.height,preview.watermarkVersion,preview.bytes.length,
            preview.sha256,preview.bytes,ctx.actorId]
        );
        await event(query,ctx,'preview_rendered',{
          proofId:preview.proofId,previewSha256:preview.sha256,watermarkVersion:preview.watermarkVersion,
        },assetId);
        return { proofId:preview.proofId,previewSha256:preview.sha256,replayed:false };
      });
      res.status(result.replayed ? 200 : 201).json(result);
    } catch (error) { respondError(res, error); }
  });

  router.post('/cases/:id/local-gallery/assets/:assetId/rights', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['rights_reviewer']);
      const assetId = parseId(req.params.assetId, 'asset ID');
      const decision = String(req.body?.decision || '');
      const reason = String(req.body?.reason || '').trim();
      if (!['approved', 'hold'].includes(decision) || reason.length < 8 || reason.length > 2000) {
        throw problem('RIGHTS_DECISION_INVALID', 400, 'Choose approved or hold and give an 8–2000 character reason.');
      }
      const assets = await db.query('SELECT id FROM governed_gallery_assets WHERE tenant_id=$1 AND case_id=$2 AND id=$3', [ctx.tenantId, ctx.item.id, assetId]);
      if (!assets[0]) throw problem('ASSET_NOT_FOUND', 404, 'Image not found in this case.');
      const rightsEvidenceId = decision === 'approved' ? String(req.body?.rightsEvidenceId || '') : null;
      const consentEvidenceId = decision === 'approved' ? String(req.body?.consentEvidenceId || '') : null;
      if (decision === 'approved') {
        if (!CASE_ID.test(rightsEvidenceId) || !CASE_ID.test(consentEvidenceId) || rightsEvidenceId === consentEvidenceId) {
          throw problem('RIGHTS_EVIDENCE_REQUIRED', 400, 'Separate rights-license and consent-release evidence IDs are required.');
        }
        const evidence = await db.query(
          `SELECT id, kind FROM governed_evidence WHERE tenant_id=$1 AND case_id=$2 AND id=ANY($3::uuid[])`,
          [ctx.tenantId, ctx.item.id, [rightsEvidenceId, consentEvidenceId]]
        );
        if (!evidence.some(item => String(item.id) === rightsEvidenceId && item.kind === 'rights_license') ||
            !evidence.some(item => String(item.id) === consentEvidenceId && item.kind === 'consent_release')) {
          throw problem('RIGHTS_EVIDENCE_REQUIRED', 409, 'Matching rights-license and consent-release references must exist on this case.');
        }
      }
      const result = await db.transaction(async query => {
        const rows = await query(
          `INSERT INTO governed_gallery_rights_checks
            (id, tenant_id, case_id, asset_id, decision, rights_evidence_id, consent_evidence_id, reason, reviewed_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id, asset_id, decision, rights_evidence_id, consent_evidence_id, reason, reviewed_by, created_at`,
          [crypto.randomUUID(), ctx.tenantId, ctx.item.id, assetId, decision,
            rightsEvidenceId, consentEvidenceId, reason, ctx.actorId]
        );
        await event(query, ctx, decision === 'approved' ? 'rights_attested' : 'rights_held',
          { rightsEvidenceId, consentEvidenceId, reason }, assetId);
        return rows[0];
      });
      res.status(201).json(result);
    } catch (error) { respondError(res, error); }
  });

  router.post('/cases/:id/local-gallery/proof-link', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['photographer', 'studio_manager']);
      const assets = await assetsForCase(db.query, ctx);
      if (!assets.some(item => item.rights_decision === 'approved' && item.preview_ready)) {
        throw problem('APPROVED_PREVIEWS_REQUIRED', 409, 'Attest rights and consent and render a safe proof preview first.');
      }
      const token = crypto.randomBytes(32).toString('hex');
      const accessId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 14 * 86400000).toISOString();
      await db.transaction(async query => {
        await query('SELECT id FROM governed_cases WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [ctx.tenantId, ctx.item.id]);
        const delivery = await query('SELECT id FROM governed_gallery_deliveries WHERE tenant_id=$1 AND case_id=$2 LIMIT 1', [ctx.tenantId, ctx.item.id]);
        if (delivery[0]) throw problem('PROOF_ALREADY_FINAL', 409, 'A final gallery has already been issued.');
        await query(
          `INSERT INTO governed_gallery_access
            (id, tenant_id, case_id, gallery_id, purpose, token_sha256, expires_at, created_by)
           VALUES ($1,$2,$3,$4,'proof',$5,$6,$7)`,
          [accessId, ctx.tenantId, ctx.item.id, ctx.gallery.id, digest(token), expiresAt, ctx.actorId]
        );
        await event(query, ctx, 'proof_link_created', { expiresAt, approvedAssetCount: assets.filter(item => item.rights_decision === 'approved' && item.preview_ready).length }, null, accessId);
      });
      noStore(res);
      res.status(201).json({ token, purpose: 'proof', expiresAt, handoff: 'manual_only', message: 'Copy this link now. No message has been sent.' });
    } catch (error) { respondError(res, error); }
  });

  router.post('/cases/:id/local-gallery/final-link', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['studio_manager']);
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 8 || reason.length > 2000) throw problem('FINAL_REASON_REQUIRED', 400, 'Give an 8–2000 character final delivery reason.');
      const token = crypto.randomBytes(32).toString('hex');
      const accessId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
      let selectedIds;
      await db.transaction(async query => {
        await query('SELECT id FROM governed_cases WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [ctx.tenantId, ctx.item.id]);
        const selections = await query('SELECT asset_ids FROM governed_gallery_proof_selections WHERE tenant_id=$1 AND case_id=$2', [ctx.tenantId, ctx.item.id]);
        if (!selections[0]?.asset_ids?.length) throw problem('CLIENT_PROOF_REQUIRED', 409, 'The holder of a proof link must submit a selection first.');
        selectedIds = selections[0].asset_ids.map(Number).sort((a, b) => a - b);
        const assets = await assetsForCase(query, ctx);
        const approved = new Set(assets.filter(item => item.rights_decision === 'approved' && item.preview_ready).map(item => Number(item.id)));
        if (selectedIds.some(id => !approved.has(id))) throw problem('RIGHTS_HOLD', 409, 'A selected image no longer has approved rights and consent.');
        const prior = await query('SELECT asset_ids FROM governed_gallery_deliveries WHERE tenant_id=$1 AND case_id=$2 ORDER BY issued_at DESC LIMIT 1', [ctx.tenantId, ctx.item.id]);
        if (prior[0] && JSON.stringify(prior[0].asset_ids.map(Number).sort((a, b) => a - b)) !== JSON.stringify(selectedIds)) {
          throw problem('FINAL_SELECTION_FROZEN', 409, 'A final gallery already fixed a different image set.');
        }
        await query(
          `INSERT INTO governed_gallery_access
            (id, tenant_id, case_id, gallery_id, purpose, token_sha256, expires_at, created_by)
           VALUES ($1,$2,$3,$4,'final',$5,$6,$7)`,
          [accessId, ctx.tenantId, ctx.item.id, ctx.gallery.id, digest(token), expiresAt, ctx.actorId]
        );
        await query(
          `INSERT INTO governed_gallery_deliveries
            (id, tenant_id, case_id, access_id, asset_ids, issued_by)
           VALUES ($1,$2,$3,$4,$5::bigint[],$6)`,
          [crypto.randomUUID(), ctx.tenantId, ctx.item.id, accessId, selectedIds, ctx.actorId]
        );
        await event(query, ctx, 'final_link_created', { expiresAt, assetIds: selectedIds, handoff: 'manual_only', reason }, null, accessId);
      });
      noStore(res);
      res.status(201).json({ token, purpose: 'final', expiresAt, assetIds: selectedIds,
        handoff: 'manual_only', message: 'Final access link created. No message has been sent and no download is confirmed.' });
    } catch (error) { respondError(res, error); }
  });

  router.post('/cases/:id/local-gallery/access/:accessId/revoke', async (req, res) => {
    try {
      const ctx = await caseContext(db, req);
      allowed(ctx.role, ['studio_manager']);
      if (!CASE_ID.test(String(req.params.accessId || ''))) throw problem('ACCESS_ID_INVALID', 400, 'Valid access ID required.');
      const result = await db.transaction(async query => {
        const rows = await query(
          `UPDATE governed_gallery_access SET revoked_at=NOW()
           WHERE id=$1 AND tenant_id=$2 AND case_id=$3 AND revoked_at IS NULL
           RETURNING id, purpose, revoked_at`,
          [req.params.accessId, ctx.tenantId, ctx.item.id]
        );
        if (!rows[0]) throw problem('ACCESS_NOT_FOUND', 404, 'Active access link not found.');
        await event(query, ctx, 'access_revoked', { purpose: rows[0].purpose }, null, rows[0].id);
        return rows[0];
      });
      res.json(result);
    } catch (error) { respondError(res, error); }
  });

  return router;
}

async function tokenContext(db, req) {
  const token = String(req.headers['x-gallery-token'] || '');
  if (!/^[a-f0-9]{64}$/.test(token)) throw problem('GALLERY_TOKEN_REQUIRED', 401, 'A valid gallery access token is required.');
  const rows = await db.query(
    `SELECT a.id, a.tenant_id, a.case_id, a.gallery_id, a.purpose, a.expires_at,
            g.title AS gallery_title
     FROM governed_gallery_access a JOIN galleries g ON g.id=a.gallery_id
     WHERE a.token_sha256=$1 AND a.revoked_at IS NULL AND a.expires_at>NOW()`,
    [digest(token)]
  );
  if (!rows[0]) throw problem('GALLERY_ACCESS_EXPIRED', 403, 'Gallery access is invalid, expired, or revoked.');
  return rows[0];
}

async function visibleAssets(db, access) {
  const ctx = { tenantId: access.tenant_id, case_id: access.case_id };
  const assets = (await assetsForCase(db.query, ctx)).filter(item => item.rights_decision === 'approved' && item.preview_ready);
  if (access.purpose === 'proof') return assets;
  const deliveries = await db.query('SELECT asset_ids FROM governed_gallery_deliveries WHERE access_id=$1 AND tenant_id=$2 AND case_id=$3', [access.id, access.tenant_id, access.case_id]);
  const finalIds = new Set((deliveries[0]?.asset_ids || []).map(Number));
  return assets.filter(item => finalIds.has(Number(item.id)));
}

function createClientGalleryRouter({ express, db }) {
  const router = express.Router();
  router.use((_req, res, next) => { noStore(res); next(); });

  router.get('/', async (req, res) => {
    try {
      const access = await tokenContext(db, req);
      const assets = await visibleAssets(db, access);
      const selection = access.purpose === 'proof'
        ? await db.query('SELECT asset_ids, submitted_at FROM governed_gallery_proof_selections WHERE tenant_id=$1 AND case_id=$2', [access.tenant_id, access.case_id])
        : [];
      res.json({
        title: access.gallery_title, purpose: access.purpose, expiresAt: access.expires_at,
        assets: assets.map(({ id, file_name, mime_type, file_size, proof_id, preview_sha256 }) => ({
          id, fileName: file_name, mimeType: mime_type, fileSize: file_size,
          proofId: proof_id, previewMimeType: 'image/png', previewSha256: preview_sha256,
        })),
        selection: selection[0]?.asset_ids || [], submittedAt: selection[0]?.submitted_at || null,
        status: access.purpose === 'proof' ? 'proof_selection_open' : 'final_access_available',
        note: 'Access to this local gallery is controlled by the link token. A link is not proof of message delivery.',
      });
    } catch (error) { respondError(res, error); }
  });

  router.get('/assets/:assetId', async (req, res) => {
    try {
      const access = await tokenContext(db, req);
      const assetId = parseId(req.params.assetId, 'asset ID');
      const visible = await visibleAssets(db, access);
      if (!visible.some(item => Number(item.id) === assetId)) throw problem('ASSET_NOT_AVAILABLE', 404, 'Image is not available under this link.');
      const rows = await db.query('SELECT * FROM governed_gallery_previews WHERE tenant_id=$1 AND case_id=$2 AND asset_id=$3', [access.tenant_id, access.case_id, assetId]);
      if (!rows[0]) throw problem('PREVIEW_NOT_FOUND', 404, 'Proof preview not found.');
      const bytes = verifiedPreview(rows[0]);
      const ctx = { tenantId: access.tenant_id, case_id: access.case_id };
      await event(db.query, ctx, 'preview_requested', { purpose: access.purpose, proofId: rows[0].proof_id }, assetId, access.id, `${access.purpose}-token:${access.id}`);
      res.on('finish', () => {
        if (res.statusCode === 200) event(db.query, ctx, 'preview_stream_finished', { purpose: access.purpose, byteCount: bytes.length }, assetId, access.id, `${access.purpose}-token:${access.id}`)
          .catch(error => console.error('Gallery asset finish audit failed:', error.message));
      });
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Proof-Id', rows[0].proof_id);
      res.type('png').send(bytes);
    } catch (error) { respondError(res, error); }
  });

  router.post('/selection', async (req, res) => {
    try {
      const access = await tokenContext(db, req);
      if (access.purpose !== 'proof') throw problem('PROOF_LINK_REQUIRED', 403, 'Only a proof link can submit selections.');
      const input = req.body?.assetIds;
      if (!Array.isArray(input) || input.length < 1 || input.length > 200 || input.some(value => !Number.isSafeInteger(value) || value < 1)) {
        throw problem('SELECTION_INVALID', 400, 'Choose 1–200 images from this proof.');
      }
      const ids = [...new Set(input)].sort((a, b) => a - b);
      const visible = await visibleAssets(db, access);
      const valid = new Set(visible.map(item => Number(item.id)));
      if (ids.some(id => !valid.has(id))) throw problem('SELECTION_OUT_OF_SCOPE', 403, 'A chosen image is unavailable or on rights hold.');
      const result = await db.transaction(async query => {
        await query('SELECT id FROM governed_cases WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [access.tenant_id, access.case_id]);
        const final = await query('SELECT id FROM governed_gallery_deliveries WHERE tenant_id=$1 AND case_id=$2 LIMIT 1', [access.tenant_id, access.case_id]);
        if (final[0]) throw problem('PROOF_CLOSED', 409, 'Final gallery access has already been issued.');
        const rows = await query(
          `INSERT INTO governed_gallery_proof_selections
            (tenant_id, case_id, access_id, asset_ids)
           VALUES ($1,$2,$3,$4::bigint[])
           ON CONFLICT (tenant_id, case_id)
           DO UPDATE SET access_id=EXCLUDED.access_id, asset_ids=EXCLUDED.asset_ids,
                         version=governed_gallery_proof_selections.version+1, submitted_at=NOW()
           RETURNING asset_ids, version, submitted_at`,
          [access.tenant_id, access.case_id, access.id, ids]
        );
        await event(query, { tenantId: access.tenant_id, case_id: access.case_id }, 'client_proof_submitted',
          { assetIds: ids, selectionVersion: rows[0].version }, null, access.id, `proof-token:${access.id}`);
        return rows[0];
      });
      res.json({ ...result, actor: 'proof_link_holder', finalDelivery: false });
    } catch (error) { respondError(res, error); }
  });

  router.get('/assets/:assetId/download', async (req, res) => {
    try {
      const access = await tokenContext(db, req);
      if (access.purpose !== 'final') throw problem('FINAL_LINK_REQUIRED', 403, 'Only a final gallery link permits downloads.');
      const assetId = parseId(req.params.assetId, 'asset ID');
      const visible = await visibleAssets(db, access);
      const asset = visible.find(item => Number(item.id) === assetId);
      if (!asset) throw problem('ASSET_NOT_AVAILABLE', 404, 'Image is not available under this link.');
      const rows = await db.query('SELECT file_data, mime_type, file_name, file_size, file_sha256 FROM governed_gallery_assets WHERE tenant_id=$1 AND case_id=$2 AND id=$3', [access.tenant_id, access.case_id, assetId]);
      if (!rows[0]) throw problem('ASSET_NOT_FOUND', 404, 'Image not found.');
      if (rows[0].file_data.length !== rows[0].file_size || digest(rows[0].file_data) !== rows[0].file_sha256 ||
          imageType(rows[0].file_data) !== rows[0].mime_type) {
        throw problem('ORIGINAL_CHECKSUM_MISMATCH', 409, 'Stored image does not match its immutable metadata.');
      }
      const ctx = { tenantId: access.tenant_id, case_id: access.case_id };
      await event(db.query, ctx, 'download_requested', { fileSha256: asset.file_sha256 }, assetId, access.id, `final-token:${access.id}`);
      res.on('finish', () => {
        if (res.statusCode === 200) event(db.query, ctx, 'download_stream_finished', { byteCount: rows[0].file_data.length }, assetId, access.id, `final-token:${access.id}`)
          .catch(error => console.error('Gallery download finish audit failed:', error.message));
      });
      res.setHeader('Content-Type', rows[0].mime_type);
      res.setHeader('Content-Length', rows[0].file_data.length);
      res.setHeader('Content-Disposition', `attachment; filename="${safeName(rows[0].file_name)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(rows[0].file_data);
    } catch (error) { respondError(res, error); }
  });

  return router;
}

module.exports = { createStaffGalleryRouter, createClientGalleryRouter, imageType, safeName, digest };
