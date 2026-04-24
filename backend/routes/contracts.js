const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get all contracts
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ct.*, c.name as client_name
      FROM contracts ct
      LEFT JOIN clients c ON ct.client_id = c.id
      ORDER BY ct.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single contract
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ct.*, c.name as client_name, c.email as client_email
      FROM contracts ct
      LEFT JOIN clients c ON ct.client_id = c.id
      WHERE ct.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create contract
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, contract_type, content, amount, status, valid_until } = req.body;
    const result = await pool.query(
      `INSERT INTO contracts (title, client_id, contract_type, content, amount, status, valid_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, client_id, contract_type || 'Standard', content, amount || 0, status || 'Draft', valid_until]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update contract
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, contract_type, content, amount, status, valid_until } = req.body;
    const result = await pool.query(
      `UPDATE contracts SET title=$1, client_id=$2, contract_type=$3, content=$4, amount=$5,
       status=$6, valid_until=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [title, client_id, contract_type, content, amount, status, valid_until, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete contract
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    res.json({ message: 'Contract deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
