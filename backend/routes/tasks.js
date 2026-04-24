const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY due_date ASC, priority DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { title, category, description, due_date, priority, related_shoot, status } = req.body;
    const result = await pool.query(
      `INSERT INTO tasks (title, category, description, due_date, priority, related_shoot, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, category || 'General', description, due_date, priority || 'Medium', related_shoot, status || 'To Do']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { title, category, description, due_date, priority, related_shoot, status } = req.body;
    const result = await pool.query(
      `UPDATE tasks SET title=$1, category=$2, description=$3, due_date=$4, priority=$5, related_shoot=$6, status=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [title, category, description, due_date, priority, related_shoot, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
