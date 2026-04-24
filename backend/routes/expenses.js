const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses ORDER BY expense_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, category, amount, expense_date, vendor, description, is_tax_deductible, receipt_url, status } = req.body;
    const result = await pool.query(
      `INSERT INTO expenses (title, category, amount, expense_date, vendor, description, is_tax_deductible, receipt_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, category || 'Equipment', amount || 0, expense_date || new Date(), vendor, description, is_tax_deductible || false, receipt_url, status || 'Recorded']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, category, amount, expense_date, vendor, description, is_tax_deductible, receipt_url, status } = req.body;
    const result = await pool.query(
      `UPDATE expenses SET title=$1, category=$2, amount=$3, expense_date=$4, vendor=$5, description=$6, is_tax_deductible=$7, receipt_url=$8, status=$9, updated_at=NOW() WHERE id=$10 RETURNING *`,
      [title, category, amount, expense_date, vendor, description, is_tax_deductible, receipt_url, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM expenses WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
