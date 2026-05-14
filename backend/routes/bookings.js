const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM bookings');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query('SELECT * FROM bookings ORDER BY requested_date DESC LIMIT $1 OFFSET $2', [limit, offset]);

    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { client_name, email, phone, shoot_type, preferred_date, preferred_time, location, message, budget, referral_source, status } = req.body;
    if (!client_name) return res.status(400).json({ error: 'client_name is required' });
    const result = await pool.query(
      `INSERT INTO bookings (client_name, email, phone, shoot_type, preferred_date, preferred_time, location, message, budget, referral_source, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [client_name, email, phone, shoot_type || 'Portrait', preferred_date, preferred_time, location, message, budget || 0, referral_source, status || 'New']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { client_name, email, phone, shoot_type, preferred_date, preferred_time, location, message, budget, referral_source, status } = req.body;
    const result = await pool.query(
      `UPDATE bookings SET client_name=$1, email=$2, phone=$3, shoot_type=$4, preferred_date=$5, preferred_time=$6, location=$7, message=$8, budget=$9, referral_source=$10, status=$11, updated_at=NOW() WHERE id=$12 RETURNING *`,
      [client_name, email, phone, shoot_type, preferred_date, preferred_time, location, message, budget, referral_source, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM bookings WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
