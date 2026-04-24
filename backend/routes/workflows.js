const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, c.name as client_name FROM workflows w
      LEFT JOIN clients c ON w.client_id = c.id
      ORDER BY w.due_date ASC NULLS LAST, w.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, c.name as client_name FROM workflows w
      LEFT JOIN clients c ON w.client_id = c.id WHERE w.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, workflow_type, steps, current_step, due_date, priority, status, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO workflows (title, client_id, workflow_type, steps, current_step, due_date, priority, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [title, client_id, workflow_type || 'Standard', JSON.stringify(steps || []), current_step || 1, due_date, priority || 'Medium', status || 'In Progress', notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, client_id, workflow_type, steps, current_step, due_date, priority, status, notes } = req.body;
    const result = await pool.query(
      `UPDATE workflows SET title=$1, client_id=$2, workflow_type=$3, steps=$4, current_step=$5, due_date=$6, priority=$7, status=$8, notes=$9, updated_at=NOW() WHERE id=$10 RETURNING *`,
      [title, client_id, workflow_type, JSON.stringify(steps || []), current_step, due_date, priority, status, notes, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM workflows WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
