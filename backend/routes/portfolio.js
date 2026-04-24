const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM portfolio ORDER BY display_order ASC, created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM portfolio WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, category, description, image_url, camera_settings, location, shoot_date, is_featured, display_order, status } = req.body;
    const result = await pool.query(
      `INSERT INTO portfolio (title, category, description, image_url, camera_settings, location, shoot_date, is_featured, display_order, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [title, category || 'Portrait', description, image_url, camera_settings, location, shoot_date, is_featured || false, display_order || 0, status || 'Published']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, category, description, image_url, camera_settings, location, shoot_date, is_featured, display_order, status } = req.body;
    const result = await pool.query(
      `UPDATE portfolio SET title=$1, category=$2, description=$3, image_url=$4, camera_settings=$5, location=$6, shoot_date=$7, is_featured=$8, display_order=$9, status=$10, updated_at=NOW() WHERE id=$11 RETURNING *`,
      [title, category, description, image_url, camera_settings, location, shoot_date, is_featured, display_order, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM portfolio WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
