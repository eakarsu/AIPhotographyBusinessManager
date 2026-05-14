const express = require('express');
const pool = require('../db');
const multer = require('multer');
const https = require('https');
const { authenticateToken, aiRateLimiter } = require('../middleware/auth');

const router = express.Router();

// multer - image/* only, max 10 files, 15MB each
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_photos (
      id SERIAL PRIMARY KEY,
      session_id INTEGER,
      shoot_id INTEGER,
      file_name VARCHAR(255),
      file_size INTEGER,
      mime_type VARCHAR(100),
      file_data BYTEA,
      composition_score INTEGER DEFAULT 0,
      lighting_score INTEGER DEFAULT 0,
      focus_score INTEGER DEFAULT 0,
      overall_score INTEGER DEFAULT 0,
      client_delivery_ready BOOLEAN DEFAULT FALSE,
      ai_suggestions JSONB,
      caption_instagram TEXT,
      caption_facebook TEXT,
      caption_linkedin TEXT,
      hashtags TEXT[],
      scored_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      endpoint VARCHAR(100),
      entity_id INTEGER,
      result JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

function callOpenRouter(messages, systemPrompt, prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

    if (!apiKey || apiKey === 'your-openrouter-key-here') {
      return resolve({
        ai_response: `[Demo Mode] AI response for: "${(prompt || '').substring(0, 80)}..."`,
        model, usage: {}
      });
    }

    const body = JSON.stringify({
      model,
      messages: messages || [
        { role: 'system', content: systemPrompt || 'You are a photography business AI.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
        'X-Title': 'AI Photography Business Manager'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) resolve({ ai_response: `AI Error: ${parsed.error.message}`, model, usage: {} });
          else resolve({ ai_response: parsed.choices[0].message.content, model: parsed.model || model, usage: parsed.usage || {} });
        } catch (e) { resolve({ ai_response: 'Parse error', model, usage: {} }); }
      });
    });
    req.on('error', e => resolve({ ai_response: `Connection error: ${e.message}`, model, usage: {} }));
    req.write(body);
    req.end();
  });
}

function parseAIJson(text) {
  try { return JSON.parse(text); } catch (_) {}
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) { try { return JSON.parse(match[1].trim()); } catch (_) {} }
  const start = text.search(/[{[]/);
  if (start !== -1) {
    const sub = text.slice(start);
    const end = Math.max(sub.lastIndexOf('}'), sub.lastIndexOf(']'));
    if (end !== -1) { try { return JSON.parse(sub.slice(0, end + 1)); } catch (_) {} }
  }
  return null;
}

// POST /api/sessions/:id/upload-photos
// Upload up to 10 photos, store in session_photos table
router.post('/:id/upload-photos', aiRateLimiter, upload.array('photos', 10), async (req, res) => {
  try {
    await ensureTables();
    const sessionId = req.params.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image file required' });
    }

    const uploaded = [];
    for (const file of req.files) {
      const result = await pool.query(
        `INSERT INTO session_photos (session_id, file_name, file_size, mime_type, file_data)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, file_name, file_size, mime_type, created_at`,
        [sessionId, file.originalname, file.size, file.mimetype, file.buffer]
      );
      uploaded.push(result.rows[0]);
    }

    res.status(201).json({
      session_id: sessionId,
      uploaded_count: uploaded.length,
      photos: uploaded
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/photos
router.get('/:id/photos', async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query(
      `SELECT id, session_id, file_name, file_size, mime_type, composition_score, lighting_score,
              focus_score, overall_score, client_delivery_ready, ai_suggestions, scored_at, created_at
       FROM session_photos WHERE session_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/generate-gallery-email
// AI generates personalized gallery delivery email
router.post('/:id/generate-gallery-email', aiRateLimiter, async (req, res) => {
  try {
    await ensureTables();
    const sessionId = req.params.id;

    // Fetch shoot/session details
    let session = null;
    try {
      const sRes = await pool.query(`
        SELECT s.*, c.name as client_name, c.email as client_email
        FROM shoots s LEFT JOIN clients c ON s.client_id = c.id
        WHERE s.id = $1
      `, [sessionId]);
      session = sRes.rows[0];
    } catch (_) {}

    // Fetch top-scored photos
    const photosResult = await pool.query(
      `SELECT file_name, overall_score, composition_score, lighting_score, focus_score, client_delivery_ready
       FROM session_photos WHERE session_id = $1 ORDER BY overall_score DESC LIMIT 10`,
      [sessionId]
    );
    const topPhotos = photosResult.rows;

    const shootInfo = session
      ? `Shoot Title: ${session.title || 'Photography Session'}\nClient: ${session.client_name || 'Valued Client'}\nDate: ${session.shoot_date ? new Date(session.shoot_date).toLocaleDateString() : 'Recent'}\nType: ${session.shoot_type || 'Portrait'}`
      : `Session ID: ${sessionId}`;

    const photosSummary = topPhotos.length > 0
      ? topPhotos.map(p => `${p.file_name}: overall=${p.overall_score}/100, composition=${p.composition_score}/100, lighting=${p.lighting_score}/100${p.client_delivery_ready ? ' [DELIVERY READY]' : ''}`).join('\n')
      : 'Photos are being processed';

    const prompt = `You are a professional photographer writing a personalized gallery delivery email to a client.

SESSION DETAILS:
${shootInfo}

TOP PHOTOS:
${photosSummary}

Write a warm, professional gallery delivery email. Include:
1. Personalized greeting with client name
2. Brief reflection on the session
3. Highlights of the best photos
4. Gallery viewing instructions (link placeholder)
5. Download/selection instructions
6. Timeline for final delivery
7. Friendly call to action

Return JSON only:
{
  "subject": "email subject line",
  "email_body": "full email text with \\n for line breaks",
  "highlight_photos": ["best 3 photo names"],
  "personalization_notes": "what makes this email special for this client"
}`;

    const aiResult = await callOpenRouter(null, null, prompt);
    const parsed = parseAIJson(aiResult.ai_response);

    // Persist
    try {
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, entity_id, result) VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'gallery_email', parseInt(sessionId), JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      session_id: sessionId,
      client_name: session?.client_name,
      subject: parsed?.subject || 'Your Gallery is Ready!',
      email_body: parsed?.email_body || aiResult.ai_response,
      highlight_photos: parsed?.highlight_photos || [],
      personalization_notes: parsed?.personalization_notes || '',
      structured: parsed,
      model_used: aiResult.model
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
