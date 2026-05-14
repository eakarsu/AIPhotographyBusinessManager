const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const https = require('https');

const router = express.Router();

// Get all invoices (paginated)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) FROM invoices');
    const total = parseInt(countResult.rows[0].count);
    const result = await pool.query(`
      SELECT i.*, c.name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({ data: result.rows, page, limit, total, totalPages: Math.ceil(total / limit) });
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
    if (!invoice_number) return res.status(400).json({ error: 'invoice_number is required' });
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

// Generate payment link
router.post('/:id/generate-payment-link', authenticateToken, async (req, res) => {
  try {
    const invoiceResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (invoiceResult.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = invoiceResult.rows[0];
    let paymentLink = `/pay/invoice/${invoice.id}`;

    // Try real Stripe if key is configured
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripeData = JSON.stringify({
          line_items: [{ price_data: { currency: 'usd', product_data: { name: `Invoice ${invoice.invoice_number}` }, unit_amount: Math.round(parseFloat(invoice.total) * 100) }, quantity: 1 }],
          mode: 'payment',
          success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/invoices?paid=true`,
          cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/invoices`
        });

        const stripeResponse = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'api.stripe.com',
            path: '/v1/checkout/sessions',
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(stripeData)
            }
          }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Parse error')); } });
          });
          req.on('error', reject);
          req.write(stripeData);
          req.end();
        });

        if (stripeResponse.url) {
          paymentLink = stripeResponse.url;
        }
      } catch (_) {
        // Fall back to mock link if Stripe fails
        paymentLink = `/pay/invoice/${invoice.id}`;
      }
    }

    // Update invoice with payment link
    try {
      await pool.query(
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link TEXT`
      );
      await pool.query(
        `UPDATE invoices SET payment_link = $1, updated_at = NOW() WHERE id = $2`,
        [paymentLink, invoice.id]
      );
    } catch (_) {}

    res.json({ invoice_id: invoice.id, payment_link: paymentLink, invoice_number: invoice.invoice_number, total: invoice.total });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
