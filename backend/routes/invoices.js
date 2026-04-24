const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all invoices
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single invoice
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, c.name as client_name, c.email as client_email, c.address as client_address
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create invoice
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { invoice_number, client_id, items, subtotal, tax_rate, tax_amount, total, status, due_date, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO invoices (invoice_number, client_id, items, subtotal, tax_rate, tax_amount, total, status, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [invoice_number, client_id, JSON.stringify(items || []), subtotal || 0, tax_rate || 0, tax_amount || 0, total || 0, status || 'Draft', due_date, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update invoice
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { invoice_number, client_id, items, subtotal, tax_rate, tax_amount, total, status, due_date, notes } = req.body;
    const result = await pool.query(
      `UPDATE invoices SET invoice_number=$1, client_id=$2, items=$3, subtotal=$4, tax_rate=$5,
       tax_amount=$6, total=$7, status=$8, due_date=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [invoice_number, client_id, JSON.stringify(items || []), subtotal, tax_rate, tax_amount, total, status, due_date, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete invoice
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
