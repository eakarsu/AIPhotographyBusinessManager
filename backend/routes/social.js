const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all social posts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM social_posts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single social post
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM social_posts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Social post not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create social post
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { platform, caption, hashtags, image_url, scheduled_date, status, engagement_likes, engagement_comments, engagement_shares } = req.body;
    const result = await pool.query(
      `INSERT INTO social_posts (platform, caption, hashtags, image_url, scheduled_date, status, engagement_likes, engagement_comments, engagement_shares)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [platform || 'Instagram', caption, hashtags, image_url, scheduled_date, status || 'Draft', engagement_likes || 0, engagement_comments || 0, engagement_shares || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update social post
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { platform, caption, hashtags, image_url, scheduled_date, status, engagement_likes, engagement_comments, engagement_shares } = req.body;
    const result = await pool.query(
      `UPDATE social_posts SET platform=$1, caption=$2, hashtags=$3, image_url=$4, scheduled_date=$5,
       status=$6, engagement_likes=$7, engagement_comments=$8, engagement_shares=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [platform, caption, hashtags, image_url, scheduled_date, status, engagement_likes, engagement_comments, engagement_shares, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Social post not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete social post
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM social_posts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Social post not found' });
    res.json({ message: 'Social post deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
