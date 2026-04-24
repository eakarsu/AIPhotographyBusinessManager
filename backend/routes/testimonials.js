const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, c.name as client_name FROM testimonials t
      LEFT JOIN clients c ON t.client_id = c.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, c.name as client_name FROM testimonials t
      LEFT JOIN clients c ON t.client_id = c.id WHERE t.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { client_id, rating, review_text, shoot_type, is_featured, source, status } = req.body;
    const result = await pool.query(
      `INSERT INTO testimonials (client_id, rating, review_text, shoot_type, is_featured, source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client_id, rating || 5, review_text, shoot_type, is_featured || false, source || 'Website', status || 'Published']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { client_id, rating, review_text, shoot_type, is_featured, source, status } = req.body;
    const result = await pool.query(
      `UPDATE testimonials SET client_id=$1, rating=$2, review_text=$3, shoot_type=$4, is_featured=$5, source=$6, status=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [client_id, rating, review_text, shoot_type, is_featured, source, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM testimonials WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
