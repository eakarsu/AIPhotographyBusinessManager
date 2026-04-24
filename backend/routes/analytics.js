const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Dashboard analytics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const [clients, shoots, invoices, galleries, expenses, social, contracts, workflows] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM clients'),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='Scheduled') as upcoming, COUNT(*) FILTER (WHERE status='Completed') as completed FROM shoots`),
      pool.query(`SELECT COUNT(*) as total, SUM(total) as revenue, SUM(total) FILTER (WHERE status='Paid') as paid, COUNT(*) FILTER (WHERE status='Pending') as pending FROM invoices`),
      pool.query('SELECT COUNT(*) as count FROM galleries'),
      pool.query('SELECT COALESCE(SUM(amount),0) as total FROM expenses'),
      pool.query(`SELECT COUNT(*) as total, SUM(engagement_likes) as likes, SUM(engagement_comments) as comments FROM social_posts`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='Active' OR status='Signed') as active FROM contracts`),
      pool.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='In Progress') as active FROM workflows`)
    ]);

    res.json({
      clients: parseInt(clients.rows[0].count),
      shoots: { total: parseInt(shoots.rows[0].total), upcoming: parseInt(shoots.rows[0].upcoming), completed: parseInt(shoots.rows[0].completed) },
      invoices: { total: parseInt(invoices.rows[0].total), revenue: parseFloat(invoices.rows[0].revenue || 0), paid: parseFloat(invoices.rows[0].paid || 0), pending: parseInt(invoices.rows[0].pending) },
      galleries: parseInt(galleries.rows[0].count),
      expenses: parseFloat(expenses.rows[0].total),
      social: { total: parseInt(social.rows[0].total), likes: parseInt(social.rows[0].likes || 0), comments: parseInt(social.rows[0].comments || 0) },
      contracts: { total: parseInt(contracts.rows[0].total), active: parseInt(contracts.rows[0].active) },
      workflows: { total: parseInt(workflows.rows[0].total), active: parseInt(workflows.rows[0].active) },
      profit: parseFloat(invoices.rows[0].paid || 0) - parseFloat(expenses.rows[0].total)
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Monthly revenue
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TO_CHAR(created_at, 'YYYY-MM') as month, SUM(total) as revenue, COUNT(*) as count
      FROM invoices WHERE status='Paid'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month DESC LIMIT 12
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Shoot types breakdown
router.get('/shoot-types', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT shoot_type, COUNT(*) as count, SUM(price) as revenue
      FROM shoots GROUP BY shoot_type ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// Expense categories
router.get('/expense-categories', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT category, COUNT(*) as count, SUM(amount) as total
      FROM expenses GROUP BY category ORDER BY total DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
