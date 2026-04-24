const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM packages ORDER BY price ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM packages WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, category, description, price, duration_hours, deliverables, includes_album, includes_prints, max_photos, status } = req.body;
    const result = await pool.query(
      `INSERT INTO packages (name, category, description, price, duration_hours, deliverables, includes_album, includes_prints, max_photos, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category || 'Portrait', description, price || 0, duration_hours || 1, deliverables, includes_album || false, includes_prints || false, max_photos || 0, status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, category, description, price, duration_hours, deliverables, includes_album, includes_prints, max_photos, status } = req.body;
    const result = await pool.query(
      `UPDATE packages SET name=$1, category=$2, description=$3, price=$4, duration_hours=$5, deliverables=$6, includes_album=$7, includes_prints=$8, max_photos=$9, status=$10, updated_at=NOW() WHERE id=$11 RETURNING *`,
      [name, category, description, price, duration_hours, deliverables, includes_album, includes_prints, max_photos, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM packages WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
