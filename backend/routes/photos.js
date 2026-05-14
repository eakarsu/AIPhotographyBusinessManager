const express = require('express');
const pool = require('../db');
const https = require('https');
const { authenticateToken, aiRateLimiter } = require('../middleware/auth');

const router = express.Router();

function callOpenRouter(messages) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

    if (!apiKey || apiKey === 'your-openrouter-key-here') {
      return resolve({ ai_response: '[Demo Mode] AI vision response', model, usage: {} });
    }

    const body = JSON.stringify({ model, messages, max_tokens: 1500, temperature: 0.5 });
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

// POST /api/photos/:id/ai-score
// Vision AI scores uploaded photo
router.post('/:id/ai-score', aiRateLimiter, async (req, res) => {
  try {
    await ensureTables();
    const photoResult = await pool.query('SELECT * FROM session_photos WHERE id = $1', [req.params.id]);
    if (photoResult.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
    const photo = photoResult.rows[0];

    if (!photo.file_data) return res.status(400).json({ error: 'No image data stored for this photo' });

    const base64 = Buffer.from(photo.file_data).toString('base64');
    const mimeType = photo.mime_type || 'image/jpeg';

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` }
          },
          {
            type: 'text',
            text: `You are a professional photography quality scorer. Analyze this photograph and return JSON only:
{
  "composition_score": 0,
  "lighting_score": 0,
  "focus_score": 0,
  "overall_score": 0,
  "client_delivery_ready": false,
  "strengths": ["list of compositional and technical strengths"],
  "suggestions": ["specific improvement suggestions"],
  "style_tags": ["mood/style descriptors like golden-hour, dramatic, soft, etc"],
  "culling_decision": "hero|select|reject"
}
Scores are 0-100. client_delivery_ready is true only if overall_score >= 70.`
          }
        ]
      }
    ];

    const aiResult = await callOpenRouter(messages);
    const parsed = parseAIJson(aiResult.ai_response);

    // Update photo record with scores
    if (parsed) {
      await pool.query(
        `UPDATE session_photos SET
         composition_score=$1, lighting_score=$2, focus_score=$3, overall_score=$4,
         client_delivery_ready=$5, ai_suggestions=$6, scored_at=NOW()
         WHERE id=$7`,
        [
          parsed.composition_score || 0,
          parsed.lighting_score || 0,
          parsed.focus_score || 0,
          parsed.overall_score || 0,
          parsed.client_delivery_ready || false,
          JSON.stringify(parsed),
          photo.id
        ]
      );
    }

    // Persist to ai_results
    try {
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, entity_id, result) VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'photo_score', photo.id, JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      photo_id: photo.id,
      file_name: photo.file_name,
      scores: {
        composition: parsed?.composition_score || 0,
        lighting: parsed?.lighting_score || 0,
        focus: parsed?.focus_score || 0,
        overall: parsed?.overall_score || 0
      },
      client_delivery_ready: parsed?.client_delivery_ready || false,
      strengths: parsed?.strengths || [],
      suggestions: parsed?.suggestions || [],
      style_tags: parsed?.style_tags || [],
      culling_decision: parsed?.culling_decision || 'select',
      structured: parsed,
      model_used: aiResult.model
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/photos/:id/generate-caption
// Vision AI generates platform-optimized captions
router.post('/:id/generate-caption', aiRateLimiter, async (req, res) => {
  try {
    await ensureTables();
    const photoResult = await pool.query('SELECT * FROM session_photos WHERE id = $1', [req.params.id]);
    if (photoResult.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
    const photo = photoResult.rows[0];

    if (!photo.file_data) return res.status(400).json({ error: 'No image data stored for this photo' });

    const base64 = Buffer.from(photo.file_data).toString('base64');
    const mimeType = photo.mime_type || 'image/jpeg';

    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` }
          },
          {
            type: 'text',
            text: `You are a social media expert for a photography business. Analyze this photo and create platform-optimized captions. Return JSON only:
{
  "photo_description": "brief description of what the photo shows",
  "mood": "string describing the mood/feeling",
  "instagram": {
    "caption": "engaging Instagram caption with emojis",
    "hashtags": ["#photography", "#portrait", etc - 15-20 relevant hashtags"],
    "best_time_to_post": "time recommendation"
  },
  "facebook": {
    "caption": "longer Facebook caption for wider audience, more conversational",
    "hashtags": ["3-5 hashtags only"]
  },
  "linkedin": {
    "caption": "professional LinkedIn caption focusing on business/craft angle",
    "hashtags": ["3-5 professional hashtags"]
  },
  "alt_text": "accessible alt text description for the image"
}`
          }
        ]
      }
    ];

    const aiResult = await callOpenRouter(messages);
    const parsed = parseAIJson(aiResult.ai_response);

    // Save captions to photo record
    if (parsed) {
      await pool.query(
        `UPDATE session_photos SET
         caption_instagram=$1, caption_facebook=$2, caption_linkedin=$3,
         hashtags=$4
         WHERE id=$5`,
        [
          parsed.instagram?.caption,
          parsed.facebook?.caption,
          parsed.linkedin?.caption,
          parsed.instagram?.hashtags || [],
          photo.id
        ]
      );
    }

    // Persist to ai_results
    try {
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, entity_id, result) VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'photo_caption', photo.id, JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      photo_id: photo.id,
      file_name: photo.file_name,
      photo_description: parsed?.photo_description || '',
      mood: parsed?.mood || '',
      instagram: parsed?.instagram || { caption: aiResult.ai_response, hashtags: [] },
      facebook: parsed?.facebook || { caption: aiResult.ai_response, hashtags: [] },
      linkedin: parsed?.linkedin || { caption: aiResult.ai_response, hashtags: [] },
      alt_text: parsed?.alt_text || '',
      model_used: aiResult.model
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/photos/:id
router.get('/:id', async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query(
      `SELECT id, session_id, file_name, file_size, mime_type, composition_score, lighting_score,
              focus_score, overall_score, client_delivery_ready, ai_suggestions,
              caption_instagram, caption_facebook, caption_linkedin, hashtags, scored_at, created_at
       FROM session_photos WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Photo not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/photos/:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM session_photos WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
