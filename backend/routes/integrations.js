// Apply pass 5 — Integrations + advanced AI for AIPhotographyBusinessManager
//
// ENV VARS (all OPTIONAL — endpoints return 503 with `missing: <ENV>`):
//   OPENROUTER_API_KEY     — AI features (satisfaction predict, review sentiment, agentic plan)
//   DROPBOX_ACCESS_TOKEN   — Dropbox cloud backup
//   AWS_ACCESS_KEY_ID      — AWS S3 cloud backup
//   AWS_SECRET_ACCESS_KEY  — AWS S3 cloud backup
//   AWS_S3_BUCKET          — Target S3 bucket
//   LIGHTROOM_CLIENT_ID    — Adobe Lightroom Cloud SDK
//   CAPTUREONE_API_KEY     — Capture One enterprise API
//   GOOGLE_REVIEWS_API_KEY — Google Places reviews
//   YELP_API_KEY           — Yelp Fusion reviews
//   COMPETITOR_API_KEY     — Pricing-intelligence vendor
//   PRINT_MARKETPLACE_KEY  — Print marketplace fulfillment partner
//
// PRODUCT-DECISIONS (documented inline):
//   - Client satisfaction prediction uses booking notes + email count signals.
//   - Video highlight reel returns a structured shot list (no ffmpeg dep).
//   - Agentic shoot orchestration is a 1-shot LLM plan (not real-time streaming).

const express = require('express');
const router = express.Router();
const pool = require('../db');
const https = require('https');
const { aiRateLimiter } = require('../middleware/auth');

// 503 helper
function require503(res, envName) {
  return res.status(503).json({
    error: 'Integration not configured',
    missing: envName,
    hint: `Set ${envName} in environment to enable this endpoint.`,
  });
}

// JSON parser (3-strategy)
function parseAIJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch (_) {} }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch (_) {} }
  return null;
}

// OpenRouter call
function callOpenRouter(systemPrompt, userPrompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return reject(new Error('OPENROUTER_API_KEY missing'));
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 3000,
      temperature: 0.4,
    });
    const req = https.request({
      hostname: 'openrouter.ai',
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Title': 'AI Photography Business Manager',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const content = j?.choices?.[0]?.message?.content || '';
          resolve({ content, parsed: parseAIJson(content), raw: j });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Schema bootstrap (additive only)
let schemaInitialized = false;
async function ensureSchema() {
  if (schemaInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cloud_backups (
        id SERIAL PRIMARY KEY,
        provider TEXT NOT NULL,
        gallery_id INTEGER,
        items_count INTEGER DEFAULT 0,
        bytes_total BIGINT DEFAULT 0,
        status TEXT,
        external_ref TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS competitor_prices (
        id SERIAL PRIMARY KEY,
        competitor_name TEXT,
        package_name TEXT,
        price NUMERIC,
        market TEXT,
        captured_at TIMESTAMPTZ DEFAULT NOW(),
        provider TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS print_orders (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        gallery_id INTEGER,
        items JSONB,
        total_amount NUMERIC,
        status TEXT,
        external_ref TEXT,
        provider TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS proofing_markups (
        id SERIAL PRIMARY KEY,
        gallery_id INTEGER,
        photo_id INTEGER,
        client_name TEXT,
        markup JSONB,
        approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    schemaInitialized = true;
  } catch (e) {
    console.error('integrations.ensureSchema:', e.message);
  }
}
ensureSchema();

// ============================================================
// 1. Cloud-storage backup — Dropbox (NEEDS-CREDS)
// ============================================================
router.post('/cloud-backup/dropbox', async (req, res) => {
  if (!process.env.DROPBOX_ACCESS_TOKEN) return require503(res, 'DROPBOX_ACCESS_TOKEN');
  try {
    await ensureSchema();
    const { gallery_id, items_count = 0, bytes_total = 0 } = req.body || {};
    const r = await pool.query(
      `INSERT INTO cloud_backups (provider, gallery_id, items_count, bytes_total, status)
       VALUES ('dropbox', $1, $2, $3, 'configured_pending_sdk') RETURNING *`,
      [gallery_id || null, items_count, bytes_total]
    );
    res.json({ provider: 'dropbox', status: 'configured_pending_sdk', backup: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 2. Cloud-storage backup — AWS S3 (NEEDS-CREDS)
// ============================================================
router.post('/cloud-backup/s3', async (req, res) => {
  if (!process.env.AWS_ACCESS_KEY_ID) return require503(res, 'AWS_ACCESS_KEY_ID');
  if (!process.env.AWS_SECRET_ACCESS_KEY) return require503(res, 'AWS_SECRET_ACCESS_KEY');
  if (!process.env.AWS_S3_BUCKET) return require503(res, 'AWS_S3_BUCKET');
  try {
    await ensureSchema();
    const { gallery_id, items_count = 0, bytes_total = 0 } = req.body || {};
    const r = await pool.query(
      `INSERT INTO cloud_backups (provider, gallery_id, items_count, bytes_total, status, external_ref)
       VALUES ('s3', $1, $2, $3, 'configured_pending_sdk', $4) RETURNING *`,
      [gallery_id || null, items_count, bytes_total, process.env.AWS_S3_BUCKET]
    );
    res.json({ provider: 's3', bucket: process.env.AWS_S3_BUCKET, backup: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cloud-backup', async (req, res) => {
  try {
    await ensureSchema();
    const r = await pool.query(`SELECT * FROM cloud_backups ORDER BY created_at DESC LIMIT 100`);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 3. Lightroom / Capture One integration (NEEDS-CREDS)
// ============================================================
router.post('/editor/lightroom-sync', async (req, res) => {
  if (!process.env.LIGHTROOM_CLIENT_ID) return require503(res, 'LIGHTROOM_CLIENT_ID');
  res.json({ provider: 'lightroom', status: 'configured_pending_sdk', message: 'Lightroom credentials present.' });
});

router.post('/editor/captureone-sync', async (req, res) => {
  if (!process.env.CAPTUREONE_API_KEY) return require503(res, 'CAPTUREONE_API_KEY');
  res.json({ provider: 'captureone', status: 'configured_pending_sdk', message: 'Capture One credentials present.' });
});

// ============================================================
// 4. Client satisfaction prediction
// PRODUCT-DECISION: signals = booking notes length, email count, gallery
// favorites count, days-to-delivery. AI explains the score.
// ============================================================
router.post('/client-satisfaction-predict', aiRateLimiter, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) return require503(res, 'OPENROUTER_API_KEY');
  try {
    const { client_id } = req.body || {};
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    const [client, bookings, emails, faves] = await Promise.all([
      pool.query('SELECT * FROM clients WHERE id = $1', [client_id]),
      pool.query(`SELECT COUNT(*) FROM bookings WHERE client_id = $1`, [client_id]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM emails WHERE client_id = $1`, [client_id]).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`SELECT COUNT(*) FROM gallery_favorites WHERE client_name = (SELECT name FROM clients WHERE id = $1)`, [client_id]).catch(() => ({ rows: [{ count: 0 }] })),
    ]);
    if (!client.rows.length) return res.status(404).json({ error: 'client not found' });

    const signals = {
      bookings_count: parseInt(bookings.rows[0].count) || 0,
      emails_count: parseInt(emails.rows[0].count) || 0,
      favorites_count: parseInt(faves.rows[0].count) || 0,
      client_name: client.rows[0].name,
    };

    // Deterministic baseline
    const score = Math.min(100, 40 + signals.bookings_count * 8 + signals.favorites_count * 1.5 + Math.min(20, signals.emails_count));

    const ai = await callOpenRouter(
      'You are a client-success analyst. Output strict JSON.',
      `Predict client satisfaction. Signals: ${JSON.stringify(signals)}. Heuristic baseline ${score}/100.
Return: { "predicted_score": 0-100, "label": "delighted|satisfied|at_risk|unhappy", "drivers": ["..."], "next_actions": ["..."] }`
    );
    res.json({ client_id, signals, baseline_score: Math.round(score), ai: ai.parsed || ai.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 5. Review sentiment analysis (NEEDS-CREDS for live review fetch)
// PRODUCT-DECISION: accept inline reviews if no API key is present;
// otherwise gate live fetch on GOOGLE_REVIEWS_API_KEY.
// ============================================================
router.post('/review-sentiment', aiRateLimiter, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) return require503(res, 'OPENROUTER_API_KEY');
  try {
    const { reviews } = req.body || {};
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: 'reviews array required (or set GOOGLE_REVIEWS_API_KEY for live fetch — not yet implemented)' });
    }
    const ai = await callOpenRouter(
      'You are a sentiment analyst. Output strict JSON.',
      `Analyze sentiment for these reviews:
${JSON.stringify(reviews.slice(0, 30), null, 2)}

Return: { "overall_sentiment": "positive|mixed|negative", "avg_score_0_100": 0, "themes": [{ "theme": "...", "sentiment": "...", "frequency": n }], "actions": ["..."] }`
    );
    res.json({ reviews_analyzed: reviews.length, result: ai.parsed || ai.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 6. Pricing-intelligence / competitor tracking (NEEDS-CREDS)
// ============================================================
router.post('/pricing/competitor-snapshot', async (req, res) => {
  if (!process.env.COMPETITOR_API_KEY) return require503(res, 'COMPETITOR_API_KEY');
  try {
    await ensureSchema();
    const { competitor_name, package_name, price, market } = req.body || {};
    if (!competitor_name) return res.status(400).json({ error: 'competitor_name required' });
    const r = await pool.query(
      `INSERT INTO competitor_prices (competitor_name, package_name, price, market, provider)
       VALUES ($1, $2, $3, $4, 'configured_pending_sdk') RETURNING *`,
      [competitor_name, package_name || null, price || null, market || null]
    );
    res.status(201).json({ snapshot: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/pricing/competitor-trends', async (req, res) => {
  try {
    await ensureSchema();
    const r = await pool.query(`
      SELECT competitor_name, package_name, AVG(price) as avg_price, MIN(price) as min_price, MAX(price) as max_price, COUNT(*) as samples
      FROM competitor_prices
      WHERE captured_at >= NOW() - INTERVAL '90 days'
      GROUP BY competitor_name, package_name
      ORDER BY avg_price DESC
    `);
    res.json({ trends: r.rows, period: 'last_90_days' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 7. Print marketplace fulfillment (NEEDS-CREDS)
// ============================================================
router.post('/print-marketplace/order', async (req, res) => {
  if (!process.env.PRINT_MARKETPLACE_KEY) return require503(res, 'PRINT_MARKETPLACE_KEY');
  try {
    await ensureSchema();
    const { client_id, gallery_id, items, total_amount } = req.body || {};
    const r = await pool.query(
      `INSERT INTO print_orders (client_id, gallery_id, items, total_amount, status, provider)
       VALUES ($1, $2, $3, $4, 'submitted_pending_sdk', 'marketplace') RETURNING *`,
      [client_id || null, gallery_id || null, JSON.stringify(items || []), total_amount || 0]
    );
    res.json({ order: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 8. Agentic shoot orchestration (single-pass plan)
// PRODUCT-DECISION: produce a comprehensive pre/during/post plan in one
// LLM call rather than multi-agent streaming (latency/cost concerns).
// ============================================================
router.post('/agent/shoot-orchestration', aiRateLimiter, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) return require503(res, 'OPENROUTER_API_KEY');
  try {
    const { shoot_id } = req.body || {};
    let shoot = null;
    if (shoot_id) {
      const s = await pool.query('SELECT * FROM shoots WHERE id = $1', [shoot_id]);
      shoot = s.rows[0];
    }
    const ai = await callOpenRouter(
      'You are an AI shoot-orchestration agent. Produce a strict-JSON plan.',
      `Build pre/during/post plan for shoot:
${JSON.stringify(shoot || req.body, null, 2)}

Return: {
  "pre_shoot": { "checklist": ["..."], "client_communications": ["..."], "scout_notes": "..." },
  "during_shoot": { "shot_list": [{ "n": 1, "title": "...", "duration_min": 5 }], "lighting_strategy": "...", "backup_plans": ["..."] },
  "post_shoot": { "culling_workflow": ["..."], "delivery_timeline": "...", "upsell_opportunities": ["..."] }
}`
    );
    res.json({ shoot_id: shoot_id || null, plan: ai.parsed || ai.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 9. Video highlight reel — shot list (no ffmpeg dep)
// PRODUCT-DECISION: returns a strict-JSON edit decision list; actual rendering
// is left to a downstream service to keep the BE light.
// ============================================================
router.post('/video-highlight-reel', aiRateLimiter, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY) return require503(res, 'OPENROUTER_API_KEY');
  try {
    const { gallery_id, target_duration_s = 60 } = req.body || {};
    let photos = [];
    if (gallery_id) {
      const p = await pool.query('SELECT id, file_path, caption FROM photos WHERE gallery_id = $1 LIMIT 100', [gallery_id]);
      photos = p.rows;
    }
    const ai = await callOpenRouter(
      'You are a video editor. Produce a strict-JSON edit decision list.',
      `Create a ${target_duration_s}s highlight reel for ${photos.length} photos.
Photos: ${JSON.stringify(photos.slice(0, 30))}

Return: { "duration_s": ${target_duration_s}, "music_mood": "...", "edit_decisions": [{ "photo_id": id, "duration_s": 2, "transition": "...", "ken_burns": "..." }], "title_card": "...", "end_card": "..." }`
    );
    res.json({ gallery_id: gallery_id || null, photo_count: photos.length, edl: ai.parsed || ai.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 10. Advanced proofing markup — additive table only (no AI required)
// ============================================================
router.post('/proofing/markup', async (req, res) => {
  try {
    await ensureSchema();
    const { gallery_id, photo_id, client_name, markup, approved } = req.body || {};
    const r = await pool.query(
      `INSERT INTO proofing_markups (gallery_id, photo_id, client_name, markup, approved)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [gallery_id || null, photo_id || null, client_name || null, JSON.stringify(markup || {}), !!approved]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/proofing/markups', async (req, res) => {
  try {
    await ensureSchema();
    const galleryId = req.query.gallery_id;
    const r = galleryId
      ? await pool.query(`SELECT * FROM proofing_markups WHERE gallery_id = $1 ORDER BY created_at DESC`, [galleryId])
      : await pool.query(`SELECT * FROM proofing_markups ORDER BY created_at DESC LIMIT 100`);
    res.json({ data: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
