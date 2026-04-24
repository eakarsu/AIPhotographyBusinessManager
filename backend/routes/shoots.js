const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all shoots
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, c.name as client_name
      FROM shoots s
      LEFT JOIN clients c ON s.client_id = c.id
      ORDER BY s.shoot_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single shoot
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, c.name as client_name, c.email as client_email, c.phone as client_phone
      FROM shoots s
      LEFT JOIN clients c ON s.client_id = c.id
      WHERE s.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shoot not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create shoot
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, shoot_date, start_time, end_time, location, shoot_type, status, notes, package_name, price } = req.body;
    const result = await pool.query(
      `INSERT INTO shoots (title, client_id, shoot_date, start_time, end_time, location, shoot_type, status, notes, package_name, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [title, client_id, shoot_date, start_time, end_time, location, shoot_type || 'Portrait', status || 'Scheduled', notes, package_name, price || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update shoot
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, shoot_date, start_time, end_time, location, shoot_type, status, notes, package_name, price } = req.body;
    const result = await pool.query(
      `UPDATE shoots SET title=$1, client_id=$2, shoot_date=$3, start_time=$4, end_time=$5,
       location=$6, shoot_type=$7, status=$8, notes=$9, package_name=$10, price=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [title, client_id, shoot_date, start_time, end_time, location, shoot_type, status, notes, package_name, price, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shoot not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete shoot
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM shoots WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Shoot not found' });
    res.json({ message: 'Shoot deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
