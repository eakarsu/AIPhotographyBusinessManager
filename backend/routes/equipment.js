const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM equipment ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM equipment WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, category, brand, model, serial_number, purchase_date, purchase_price, condition, notes, status } = req.body;
    const result = await pool.query(
      `INSERT INTO equipment (name, category, brand, model, serial_number, purchase_date, purchase_price, condition, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [name, category || 'Camera', brand, model, serial_number, purchase_date, purchase_price || 0, condition || 'Excellent', notes, status || 'Available']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, category, brand, model, serial_number, purchase_date, purchase_price, condition, notes, status } = req.body;
    const result = await pool.query(
      `UPDATE equipment SET name=$1, category=$2, brand=$3, model=$4, serial_number=$5, purchase_date=$6, purchase_price=$7, condition=$8, notes=$9, status=$10, updated_at=NOW() WHERE id=$11 RETURNING *`,
      [name, category, brand, model, serial_number, purchase_date, purchase_price, condition, notes, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM equipment WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
