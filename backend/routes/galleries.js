const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all galleries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, c.name as client_name
      FROM galleries g
      LEFT JOIN clients c ON g.client_id = c.id
      ORDER BY g.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single gallery
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.*, c.name as client_name, c.email as client_email
      FROM galleries g
      LEFT JOIN clients c ON g.client_id = c.id
      WHERE g.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gallery not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create gallery
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, description, photo_count, status, delivery_date, cover_image_url, access_password } = req.body;
    const result = await pool.query(
      `INSERT INTO galleries (title, client_id, description, photo_count, status, delivery_date, cover_image_url, access_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, client_id, description, photo_count || 0, status || 'Draft', delivery_date, cover_image_url, access_password]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update gallery
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, description, photo_count, status, delivery_date, cover_image_url, access_password } = req.body;
    const result = await pool.query(
      `UPDATE galleries SET title=$1, client_id=$2, description=$3, photo_count=$4, status=$5,
       delivery_date=$6, cover_image_url=$7, access_password=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [title, client_id, description, photo_count, status, delivery_date, cover_image_url, access_password, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gallery not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete gallery
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM galleries WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Gallery not found' });
    res.json({ message: 'Gallery deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
