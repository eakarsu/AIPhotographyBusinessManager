const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mileage ORDER BY trip_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mileage WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { trip_date, from_location, to_location, miles, purpose, client_name, is_round_trip, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO mileage (trip_date, from_location, to_location, miles, purpose, client_name, is_round_trip, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [trip_date || new Date(), from_location, to_location, miles || 0, purpose || 'Client Shoot', client_name, is_round_trip || false, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { trip_date, from_location, to_location, miles, purpose, client_name, is_round_trip, notes } = req.body;
    const result = await pool.query(
      `UPDATE mileage SET trip_date=$1, from_location=$2, to_location=$3, miles=$4, purpose=$5, client_name=$6, is_round_trip=$7, notes=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
      [trip_date, from_location, to_location, miles, purpose, client_name, is_round_trip, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM mileage WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
