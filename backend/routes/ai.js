const express = require('express');
const pool = require('../db');
const { authenticateToken, aiRateLimiter } = require('../middleware/auth');
const multer = require('multer');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Ensure ai_results table
async function ensureAiResultsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ai_results (id SERIAL PRIMARY KEY, user_id INTEGER, endpoint VARCHAR(100), entity_id INTEGER, result JSONB, created_at TIMESTAMP DEFAULT NOW())`
  );
}

// Ensure gallery_favorites table
async function ensureGalleryFavoritesTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS gallery_favorites (id SERIAL PRIMARY KEY, gallery_id INTEGER, photo_id INTEGER, client_name VARCHAR(255), created_at TIMESTAMP DEFAULT NOW())`
  );
}

// 3-strategy JSON parser
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

async function callOpenRouter(prompt, systemPrompt, messages = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';

    if (!apiKey || apiKey === 'your-openrouter-key-here') throw new Error('OPENROUTER_API_KEY is required');

    const body = messages ? {
      model,
      messages,
      max_tokens: 1500,
      temperature: 0.7
    } : {
      model,
      messages: [
        { role: 'system', content: systemPrompt || 'You are a professional photography business AI assistant.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    };

    const baseUrl = (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.CLIENT_URL || 'http://localhost:3000',
        'X-Title': 'AI Photography Business Manager'
      },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch (_) { throw new Error(`OpenRouter returned invalid JSON (${response.status})`); }
    if (!response.ok || parsed.error) throw new Error(parsed.error?.message || `OpenRouter request failed (${response.status})`);
    const content = parsed.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenRouter returned no content');
    return {
      ai_response: content,
      model: parsed.model || model,
      usage: parsed.usage || { prompt_tokens: 0, completion_tokens: 0 }
    };
}

// Get all AI edits
router.get('/edits', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_edits ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single AI edit
router.get('/edits/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_edits WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'AI edit not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create AI edit
router.post('/edits', authenticateToken, async (req, res) => {
  try {
    const { photo_name, edit_type, original_settings, status } = req.body;
    const result = await pool.query(
      `INSERT INTO ai_edits (photo_name, edit_type, original_settings, status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [photo_name, edit_type || 'Auto-Enhance', JSON.stringify(original_settings || {}), status || 'Pending']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update AI edit
router.put('/edits/:id', authenticateToken, async (req, res) => {
  try {
    const { photo_name, edit_type, original_settings, ai_suggestions, status } = req.body;
    const result = await pool.query(
      `UPDATE ai_edits SET photo_name=$1, edit_type=$2, original_settings=$3, ai_suggestions=$4,
       status=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [photo_name, edit_type, JSON.stringify(original_settings || {}), JSON.stringify(ai_suggestions || {}), status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'AI edit not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete AI edit
router.delete('/edits/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ai_edits WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'AI edit not found' });
    res.json({ message: 'AI edit deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Photo Analysis (text-based)
router.post('/analyze-photo', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { photo_name, description, edit_type } = req.body;
    const prompt = `Analyze this photography image and provide professional editing suggestions:
Photo: ${photo_name}
Description: ${description || 'No description provided'}
Requested Edit Type: ${edit_type || 'Auto-Enhance'}

Please provide:
1. Composition analysis
2. Lighting assessment
3. Color grading recommendations
4. Suggested edits (exposure, contrast, saturation, etc.)
5. Overall quality score (1-10)
6. Whether this photo should be included in client delivery (culling recommendation)`;

    const systemPrompt = 'You are an expert photography editor AI. Provide detailed, professional photo editing suggestions.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);

    res.json({
      photo_name,
      edit_type: edit_type || 'Auto-Enhance',
      analysis: aiResult.ai_response,
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Real photo upload + vision analysis
router.post('/analyze-photo-upload', authenticateToken, aiRateLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image file required' });

    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';
    const galleryId = req.body.gallery_id ? parseInt(req.body.gallery_id) : null;

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
            text: 'Analyze this photography for quality. Return JSON only: {"technical_quality":{"sharpness":0,"exposure":0,"composition":0,"color":0},"overall_score":0,"strengths":[],"improvements":[],"style_tags":[],"best_use_case":"","culling_decision":"keep|select|reject"}'
          }
        ]
      }
    ];

    const aiResult = await callOpenRouter(null, null, messages);
    const parsed = parseAIJson(aiResult.ai_response);

    // Store in ai_edits
    let editId = null;
    try {
      const photoName = req.file.originalname || 'uploaded_photo.jpg';
      const editResult = await pool.query(
        `INSERT INTO ai_edits (photo_name, edit_type, original_settings, ai_suggestions, status)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          photoName,
          'Vision Analysis',
          JSON.stringify({ gallery_id: galleryId, mime_type: mimeType }),
          JSON.stringify(parsed || { raw: aiResult.ai_response }),
          parsed ? 'Completed' : 'Pending'
        ]
      );
      editId = editResult.rows[0].id;
    } catch (_) {}

    // Persist to ai_results
    try {
      await ensureAiResultsTable();
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, entity_id, result) VALUES ($1, $2, $3, $4)`,
        [req.user.id, 'photo_upload_analyze', editId, JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      photo_name: req.file.originalname,
      gallery_id: galleryId,
      edit_id: editId,
      analysis: parsed || { raw: aiResult.ai_response },
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// AI Auto-Cull
router.post('/auto-cull', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { photos } = req.body;
    const photoList = photos || ['IMG_001.jpg', 'IMG_002.jpg', 'IMG_003.jpg'];
    const prompt = `Review these photos and recommend keep/cull/select:\nPhotos: ${photoList.join(', ')}\n\nFor each provide: Keep/Cull/Select, quality score (1-10), brief reason. Include summary counts.`;
    const systemPrompt = 'You are an expert photo culler for a professional photography studio.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);
    res.json({ photos_reviewed: photoList.length, culling_results: aiResult.ai_response, model_used: aiResult.model, tokens_used: aiResult.usage });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Contract Generator
router.post('/generate-contract', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { client_name, shoot_type, package_name, amount, shoot_date, location } = req.body;
    if (!client_name || !shoot_type) return res.status(400).json({ error: 'client_name and shoot_type required' });

    const prompt = `Generate a complete, legally sound photography service contract. Return JSON only:
{
  "contract_title": "Photography Services Agreement",
  "parties": {
    "photographer": "[Photographer Name/Studio]",
    "client": "${client_name || 'Client'}"
  },
  "contract_text": "Full contract text with all clauses, formatted with sections",
  "sections": {
    "services": "description of photography services to be provided",
    "payment_terms": "payment schedule and method",
    "cancellation_policy": "cancellation and rescheduling terms",
    "image_rights": "copyright and usage rights clause",
    "model_release": "model release terms",
    "liability": "liability limitation clause",
    "deliverables": "what client receives and timeline",
    "force_majeure": "force majeure clause"
  },
  "signature_block": "signature lines text"
}

Use these details:
Client: ${client_name}
Session Type: ${shoot_type}
Package: ${package_name || 'Photography Package'}
Amount: $${amount || 'TBD'}
Date: ${shoot_date || 'TBD'}
Location: ${location || 'TBD'}`;

    const systemPrompt = 'You are a legal contract writer specializing in photography business contracts. Return valid JSON only.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);
    const parsed = parseAIJson(aiResult.ai_response);

    try {
      await ensureAiResultsTable();
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, result) VALUES ($1, $2, $3)`,
        [req.user.id, 'generate_contract', JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      contract_type: shoot_type,
      client: client_name,
      generated_contract: parsed?.contract_text || aiResult.ai_response,
      sections: parsed?.sections || {},
      signature_block: parsed?.signature_block || '',
      structured: parsed,
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Social Media Caption Generator
router.post('/generate-caption', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { platform, photo_description, style, hashtags_count } = req.body;
    const prompt = `Generate a ${platform || 'Instagram'} caption for a photography post:\nPhoto: ${photo_description}\nStyle: ${style}\nHashtags: ${hashtags_count || 15}\n\nInclude: caption, CTA, hashtags, posting tips.`;
    const systemPrompt = 'You are a social media marketing expert for photography businesses.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);
    res.json({ platform: platform || 'Instagram', caption: aiResult.ai_response, model_used: aiResult.model, tokens_used: aiResult.usage });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Business Insights - structured JSON + persist
router.post('/business-insights', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const clientCount = await pool.query('SELECT COUNT(*) FROM clients');
    const shootCount = await pool.query('SELECT COUNT(*) FROM shoots');
    const invoiceStats = await pool.query('SELECT SUM(total) as revenue, COUNT(*) as count FROM invoices');
    const galleryCount = await pool.query('SELECT COUNT(*) FROM galleries');

    const revenue = parseFloat(invoiceStats.rows[0].revenue || 0);
    const clients = parseInt(clientCount.rows[0].count);
    const shoots = parseInt(shootCount.rows[0].count);
    const invoices = parseInt(invoiceStats.rows[0].count);
    const galleries = parseInt(galleryCount.rows[0].count);

    const prompt = `Analyze this photography business and provide strategic insights:
- Total Clients: ${clients}
- Total Shoots: ${shoots}
- Total Invoices: ${invoices}
- Total Revenue: $${revenue}
- Active Galleries: ${galleries}

Return JSON only: {"revenue_insights":[],"growth_opportunities":[],"cost_optimization":[],"kpi_summary":{"monthly_revenue":0,"client_retention_rate":0,"avg_shoot_value":0,"bookings_trend":"up|stable|down"},"action_items":[]}`;

    const systemPrompt = 'You are a photography business consultant AI. Return valid JSON only.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);
    const parsed = parseAIJson(aiResult.ai_response);

    // Persist to ai_results
    try {
      await ensureAiResultsTable();
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, result) VALUES ($1, $2, $3)`,
        [req.user.id, 'business_insights', JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      metrics: { clients, shoots, invoices, revenue, galleries },
      insights: aiResult.ai_response,
      structured: parsed,
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI History - paginated
router.get('/history', authenticateToken, async (req, res) => {
  try {
    await ensureAiResultsTable();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM ai_results WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(
      'SELECT * FROM ai_results WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );

    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public gallery portal
router.get('/galleries/:id/public', async (req, res) => {
  try {
    const { password } = req.query;
    const galleryResult = await pool.query('SELECT * FROM galleries WHERE id = $1', [req.params.id]);
    if (galleryResult.rows.length === 0) return res.status(404).json({ error: 'Gallery not found' });

    const gallery = galleryResult.rows[0];
    if (gallery.access_password && gallery.access_password !== password) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Get photos from ai_edits linked to this gallery
    const photosResult = await pool.query(
      `SELECT id, photo_name, edit_type, ai_suggestions, status, created_at
       FROM ai_edits
       WHERE original_settings::jsonb->>'gallery_id' = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    // Get favorites count
    try {
      await ensureGalleryFavoritesTable();
    } catch (_) {}
    const favResult = await pool.query(
      'SELECT COUNT(*) FROM gallery_favorites WHERE gallery_id = $1',
      [req.params.id]
    ).catch(() => ({ rows: [{ count: 0 }] }));

    res.json({
      gallery: {
        id: gallery.id,
        title: gallery.title,
        description: gallery.description,
        delivery_date: gallery.delivery_date,
        photo_count: gallery.photo_count,
        status: gallery.status
      },
      photos: photosResult.rows,
      favorites_count: parseInt(favResult.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/ai/pricing-estimate
// AI pricing calculator for sessions
router.post('/pricing-estimate', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { session_type, duration_hours, travel_miles, num_deliverables, market_location, experience_years } = req.body;
    if (!session_type) return res.status(400).json({ error: 'session_type required' });

    const prompt = `You are a photography business pricing consultant. Calculate a competitive pricing recommendation.

SESSION DETAILS:
- Type: ${session_type}
- Duration: ${duration_hours || 2} hours
- Travel: ${travel_miles || 0} miles
- Deliverables: ${num_deliverables || 50} edited photos
- Market: ${market_location || 'US market'}
- Photographer experience: ${experience_years || 3} years

Return JSON only:
{
  "recommended_price": 0,
  "price_range": { "minimum": 0, "maximum": 0 },
  "pricing_breakdown": {
    "base_rate": 0,
    "travel_fee": 0,
    "editing_time": 0,
    "equipment_overhead": 0,
    "business_overhead": 0
  },
  "market_positioning": "budget|mid-range|premium|luxury",
  "competitive_analysis": "string describing where this sits in the market",
  "upsell_opportunities": ["list of add-ons to offer"],
  "package_suggestion": "string describing what to include in a package at this price",
  "justification": "string explaining the pricing rationale"
}`;

    const aiResult = await callOpenRouter(prompt, 'You are a photography business pricing expert. Return valid JSON only.');
    const parsed = parseAIJson(aiResult.ai_response);

    try {
      await ensureAiResultsTable();
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, result) VALUES ($1, $2, $3)`,
        [req.user.id, 'pricing_estimate', JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      session_type,
      duration_hours,
      recommended_price: parsed?.recommended_price || 0,
      price_range: parsed?.price_range || {},
      pricing_breakdown: parsed?.pricing_breakdown || {},
      market_positioning: parsed?.market_positioning || 'mid-range',
      competitive_analysis: parsed?.competitive_analysis || '',
      upsell_opportunities: parsed?.upsell_opportunities || [],
      package_suggestion: parsed?.package_suggestion || '',
      justification: parsed?.justification || aiResult.ai_response,
      structured: parsed,
      model_used: aiResult.model
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/style-analyzer
// Vision AI analyzes portfolio photos for photographer's style signature
router.post('/style-analyzer', authenticateToken, aiRateLimiter, upload.array('photos', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one portfolio photo required' });
    }

    const imageContents = req.files.map(file => ({
      type: 'image_url',
      image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}` }
    }));

    const messages = [
      {
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `You are an expert photography curator and style analyst. Analyze these ${req.files.length} portfolio photos to identify the photographer's distinctive style signature. Return JSON only:
{
  "style_signature": "one-sentence description of this photographer's unique style",
  "lighting_preferences": {
    "primary_style": "string (e.g., 'natural window light', 'dramatic side lighting')",
    "characteristics": ["list of lighting traits"]
  },
  "color_palette": {
    "dominant_tones": ["warm|cool|neutral|monochrome etc"],
    "editing_style": "string (e.g., 'film-like', 'clean and bright', 'moody')",
    "color_grading": "string description"
  },
  "composition_patterns": {
    "preferred_framing": "string",
    "depth_of_field": "shallow|medium|deep",
    "perspective": "string",
    "rule_of_thirds_usage": "always|sometimes|rarely"
  },
  "mood_and_emotion": "string describing the emotional quality",
  "genre_fit": ["best genres for this style"],
  "style_tags": ["5-10 descriptive tags"],
  "client_appeal": "string describing ideal client for this style",
  "differentiation": "what makes this photographer's style unique"
}`
          }
        ]
      }
    ];

    const aiResult = await callOpenRouter(null, null, messages);
    const parsed = parseAIJson(aiResult.ai_response);

    try {
      await ensureAiResultsTable();
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, result) VALUES ($1, $2, $3)`,
        [req.user.id, 'style_analyzer', JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      photos_analyzed: req.files.length,
      style_signature: parsed?.style_signature || '',
      lighting_preferences: parsed?.lighting_preferences || {},
      color_palette: parsed?.color_palette || {},
      composition_patterns: parsed?.composition_patterns || {},
      mood_and_emotion: parsed?.mood_and_emotion || '',
      genre_fit: parsed?.genre_fit || [],
      style_tags: parsed?.style_tags || [],
      client_appeal: parsed?.client_appeal || '',
      differentiation: parsed?.differentiation || '',
      structured: parsed,
      model_used: aiResult.model
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/shoot-plan-optimize
// Suggest timeline, crew, locations for an upcoming shoot
router.post('/shoot-plan-optimize', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { shoot_type, shoot_date, duration_hours, client_brief, locations, party_size, weather, budget } = req.body;

    const prompt = `You are a photography production planner. Build an optimized shoot plan.

Shoot Type: ${shoot_type || 'unspecified'}
Date: ${shoot_date || 'TBD'}
Duration: ${duration_hours || 'TBD'} hours
Client Brief: ${client_brief || 'n/a'}
Locations Considered: ${(locations || []).join(', ') || 'TBD'}
Party Size: ${party_size || 'TBD'}
Weather Forecast: ${weather || 'TBD'}
Budget: $${budget || 'TBD'}

Return JSON only:
{
  "timeline": [{"slot": "HH:MM-HH:MM", "activity": "string", "location": "string", "notes": "string"}],
  "crew_recommendations": [{"role": "string", "count": 0, "skills": ["string"]}],
  "location_recommendations": [{"location": "string", "best_time": "string", "why": "string", "permit_needed": false}],
  "equipment_checklist": ["string"],
  "lighting_plan": ["string"],
  "weather_contingencies": ["string"],
  "logistics_notes": ["string"],
  "estimated_cost_breakdown": {"crew": 0, "rentals": 0, "permits": 0, "transport": 0, "total": 0}
}`;

    const aiResult = await callOpenRouter(prompt, 'You are an experienced photography production planner. Return valid JSON only.');
    const parsed = parseAIJson(aiResult.ai_response);

    try {
      await ensureAiResultsTable();
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, result) VALUES ($1, $2, $3)`,
        [req.user.id, 'shoot_plan_optimize', JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      shoot_type,
      shoot_date,
      timeline: parsed?.timeline || [],
      crew_recommendations: parsed?.crew_recommendations || [],
      location_recommendations: parsed?.location_recommendations || [],
      equipment_checklist: parsed?.equipment_checklist || [],
      lighting_plan: parsed?.lighting_plan || [],
      weather_contingencies: parsed?.weather_contingencies || [],
      logistics_notes: parsed?.logistics_notes || [],
      estimated_cost_breakdown: parsed?.estimated_cost_breakdown || {},
      structured: parsed,
      model_used: aiResult.model
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/gallery-organization-ai
// Auto-sort and tag images in a gallery
router.post('/gallery-organization-ai', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const { gallery_id, photos } = req.body;
    let photoList = Array.isArray(photos) ? photos : [];

    if ((!photoList || photoList.length === 0) && gallery_id) {
      try {
        const result = await pool.query(
          'SELECT id, filename, caption, tags, taken_at FROM photos WHERE gallery_id = $1 ORDER BY taken_at ASC NULLS LAST LIMIT 200',
          [gallery_id]
        );
        photoList = result.rows;
      } catch (_) {}
    }

    if (photoList.length === 0) {
      return res.status(400).json({ error: 'No photos provided and gallery has no photos to organize' });
    }

    const summary = photoList.map(p =>
      `id=${p.id} file=${p.filename || 'n/a'} caption="${(p.caption || '').slice(0, 80)}" tags=${JSON.stringify(p.tags || [])} taken=${p.taken_at || 'n/a'}`
    ).join('\n');

    const prompt = `You are a gallery-organization AI for a working photographer. Suggest grouping, tagging, and ordering for these photos.

PHOTOS:
${summary}

Return JSON only:
{
  "groups": [
    {"name": "string", "photo_ids": [0], "rationale": "string"}
  ],
  "suggested_tags_per_photo": [{"id": 0, "tags": ["string"]}],
  "highlight_picks": [0],
  "recommended_order": [0],
  "duplicates_or_near_duplicates": [{"ids": [0], "reason": "string"}],
  "cover_photo_candidates": [{"id": 0, "why": "string"}],
  "summary": "string"
}`;

    const aiResult = await callOpenRouter(prompt, 'You are a working photographer’s gallery curator. Return valid JSON only.');
    const parsed = parseAIJson(aiResult.ai_response);

    try {
      await ensureAiResultsTable();
      await pool.query(
        `INSERT INTO ai_results (user_id, endpoint, result) VALUES ($1, $2, $3)`,
        [req.user.id, 'gallery_organization_ai', JSON.stringify(parsed || { raw: aiResult.ai_response })]
      );
    } catch (_) {}

    res.json({
      gallery_id: gallery_id || null,
      photos_analyzed: photoList.length,
      groups: parsed?.groups || [],
      suggested_tags_per_photo: parsed?.suggested_tags_per_photo || [],
      highlight_picks: parsed?.highlight_picks || [],
      recommended_order: parsed?.recommended_order || [],
      duplicates_or_near_duplicates: parsed?.duplicates_or_near_duplicates || [],
      cover_photo_candidates: parsed?.cover_photo_candidates || [],
      summary: parsed?.summary || aiResult.ai_response,
      structured: parsed,
      model_used: aiResult.model
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client mark favorites
router.post('/galleries/:id/favorites', async (req, res) => {
  try {
    await ensureGalleryFavoritesTable();
    const { photo_id, client_name } = req.body;
    if (!photo_id) return res.status(400).json({ error: 'photo_id required' });

    const result = await pool.query(
      `INSERT INTO gallery_favorites (gallery_id, photo_id, client_name) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, photo_id, client_name || 'Anonymous']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
