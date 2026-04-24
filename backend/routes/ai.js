const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const https = require('https');
const http = require('http');

const router = express.Router();

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

function callOpenRouter(prompt, systemPrompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

    if (!apiKey || apiKey === 'your-openrouter-key-here') {
      return resolve({
        ai_response: `[AI Demo Mode] This is a simulated AI response. Configure OPENROUTER_API_KEY in .env for live AI.\n\nBased on your request: "${prompt.substring(0, 100)}..."\n\nHere is a professional analysis:\n\n1. **Quality Assessment**: The composition follows the rule of thirds effectively with strong leading lines.\n2. **Color Grading**: Warm tones complement the subject, suggest slight desaturation of greens.\n3. **Exposure**: Well-balanced highlights and shadows, minor recovery needed in bright areas.\n4. **Recommendation**: Apply subtle vignette and increase clarity by 15-20% for editorial feel.\n5. **Overall Rating**: 8.5/10 - Professional quality suitable for portfolio and client delivery.`,
        model: model,
        usage: { prompt_tokens: 0, completion_tokens: 0 }
      });
    }

    const data = JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt || 'You are a professional photography business AI assistant. Provide detailed, actionable advice.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.7
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Photography Business Manager'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) {
            resolve({
              ai_response: `AI Error: ${parsed.error.message || 'Unknown error'}`,
              model: model,
              usage: { prompt_tokens: 0, completion_tokens: 0 }
            });
          } else {
            resolve({
              ai_response: parsed.choices[0].message.content,
              model: parsed.model || model,
              usage: parsed.usage || { prompt_tokens: 0, completion_tokens: 0 }
            });
          }
        } catch (e) {
          resolve({
            ai_response: `AI parsing error. Raw response: ${body.substring(0, 200)}`,
            model: model,
            usage: { prompt_tokens: 0, completion_tokens: 0 }
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        ai_response: `AI connection error: ${e.message}`,
        model: model,
        usage: { prompt_tokens: 0, completion_tokens: 0 }
      });
    });

    req.write(data);
    req.end();
  });
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

// AI Photo Analysis
router.post('/analyze-photo', authenticateToken, async (req, res) => {
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

    const systemPrompt = 'You are an expert photography editor AI. Provide detailed, professional photo editing suggestions and culling recommendations. Format your response with clear sections and ratings.';
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

// AI Auto-Cull
router.post('/auto-cull', authenticateToken, async (req, res) => {
  try {
    const { photos } = req.body;
    const photoList = photos || ['IMG_001.jpg', 'IMG_002.jpg', 'IMG_003.jpg'];
    const prompt = `You are a professional photo culler. Review these photos from a shoot and recommend which to keep, which to cull, and which are the best selects:

Photos: ${photoList.join(', ')}

For each photo, provide:
1. Keep/Cull/Select rating
2. Technical quality score (1-10)
3. Artistic merit score (1-10)
4. Brief reason for the decision
5. Any duplicate groups detected

Also provide a summary with total keep/cull/select counts.`;

    const systemPrompt = 'You are an expert photo culler for a professional photography studio. Be decisive and provide clear keep/cull recommendations based on technical quality, composition, and artistic merit.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);

    res.json({
      photos_reviewed: photoList.length,
      culling_results: aiResult.ai_response,
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Contract Generator
router.post('/generate-contract', authenticateToken, async (req, res) => {
  try {
    const { client_name, shoot_type, package_name, amount, shoot_date, location } = req.body;
    const prompt = `Generate a professional photography contract with these details:
Client: ${client_name || 'Client Name'}
Type of Shoot: ${shoot_type || 'Portrait Session'}
Package: ${package_name || 'Standard Package'}
Amount: $${amount || '500'}
Shoot Date: ${shoot_date || 'TBD'}
Location: ${location || 'Studio'}

Include these sections:
1. Parties & Overview
2. Services Description
3. Pricing & Payment Terms
4. Cancellation & Rescheduling Policy
5. Image Rights & Usage
6. Model Release
7. Liability & Force Majeure
8. Deliverables & Timeline
9. Signatures`;

    const systemPrompt = 'You are a legal contract writer specializing in photography business contracts. Generate professional, comprehensive contracts that protect both the photographer and client.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);

    res.json({
      contract_type: shoot_type || 'Portrait Session',
      client: client_name,
      generated_contract: aiResult.ai_response,
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Social Media Caption Generator
router.post('/generate-caption', authenticateToken, async (req, res) => {
  try {
    const { platform, photo_description, style, hashtags_count } = req.body;
    const prompt = `Generate a professional social media caption for a photography business:
Platform: ${platform || 'Instagram'}
Photo Description: ${photo_description || 'Professional portrait photo'}
Style: ${style || 'Professional and engaging'}
Number of Hashtags: ${hashtags_count || 15}

Please provide:
1. Main caption text (engaging, on-brand)
2. Call-to-action
3. Relevant hashtags
4. Best time to post recommendation
5. Engagement tips for this type of post`;

    const systemPrompt = 'You are a social media marketing expert for photography businesses. Create engaging, professional captions that drive engagement and attract new clients.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);

    res.json({
      platform: platform || 'Instagram',
      caption: aiResult.ai_response,
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// AI Business Insights
router.post('/business-insights', authenticateToken, async (req, res) => {
  try {
    // Get stats from DB
    const clientCount = await pool.query('SELECT COUNT(*) FROM clients');
    const shootCount = await pool.query('SELECT COUNT(*) FROM shoots');
    const invoiceStats = await pool.query('SELECT SUM(total) as revenue, COUNT(*) as count FROM invoices');
    const galleryCount = await pool.query('SELECT COUNT(*) FROM galleries');

    const prompt = `Analyze this photography business data and provide strategic insights:

Business Metrics:
- Total Clients: ${clientCount.rows[0].count}
- Total Shoots: ${shootCount.rows[0].count}
- Total Invoices: ${invoiceStats.rows[0].count}
- Total Revenue: $${invoiceStats.rows[0].revenue || 0}
- Active Galleries: ${galleryCount.rows[0].count}

Please provide:
1. Revenue analysis and growth recommendations
2. Client acquisition strategies
3. Pricing optimization suggestions
4. Seasonal booking predictions
5. Marketing recommendations
6. Workflow efficiency improvements
7. Overall business health score (1-10)`;

    const systemPrompt = 'You are a photography business consultant AI. Provide data-driven insights and actionable recommendations to grow the photography business.';
    const aiResult = await callOpenRouter(prompt, systemPrompt);

    res.json({
      metrics: {
        clients: parseInt(clientCount.rows[0].count),
        shoots: parseInt(shootCount.rows[0].count),
        invoices: parseInt(invoiceStats.rows[0].count),
        revenue: parseFloat(invoiceStats.rows[0].revenue || 0),
        galleries: parseInt(galleryCount.rows[0].count)
      },
      insights: aiResult.ai_response,
      model_used: aiResult.model,
      tokens_used: aiResult.usage
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
