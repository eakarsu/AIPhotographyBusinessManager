const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Invoice totals are always derived from the stored line items, never trusted
// from the request body.
function computeTotals(items, taxRate) {
  const lineItems = Array.isArray(items) ? items : [];
  const subtotal = Math.round(lineItems.reduce((sum, item) => {
    const qty = Number(item && item.qty) || 0;
    const price = Number(item && item.price) || 0;
    return sum + qty * price;
  }, 0) * 100) / 100;
  const rate = Number.isFinite(Number(taxRate)) ? Number(taxRate) : 0;
  const taxAmount = Math.round(subtotal * rate) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { subtotal, tax_amount: taxAmount, total };
}

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
    const { invoice_number, client_id, items, tax_rate, status, due_date, notes } = req.body;
    if (!invoice_number) return res.status(400).json({ error: 'invoice_number is required' });
    if (items != null && !Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    const totals = computeTotals(items, tax_rate);
    const result = await pool.query(
      `INSERT INTO invoices (invoice_number, client_id, items, subtotal, tax_rate, tax_amount, total, status, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [invoice_number, client_id, JSON.stringify(items || []), totals.subtotal, Number(tax_rate) || 0, totals.tax_amount, totals.total, status || 'Draft', due_date, notes]
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
    const { invoice_number, client_id, items, tax_rate, status, due_date, notes } = req.body;
    if (items != null && !Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    const totals = computeTotals(items, tax_rate);
    const result = await pool.query(
      `UPDATE invoices SET invoice_number=$1, client_id=$2, items=$3, subtotal=$4, tax_rate=$5,
       tax_amount=$6, total=$7, status=$8, due_date=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [invoice_number, client_id, JSON.stringify(items || []), totals.subtotal, Number(tax_rate) || 0, totals.tax_amount, totals.total, status, due_date, notes, req.params.id]
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

// Generate payment link via Stripe Checkout.
// When Stripe is not configured (or the request fails) this returns a clear
// error instead of a fake local /pay/... URL.
router.post('/:id/generate-payment-link', authenticateToken, async (req, res) => {
  try {
    const invoiceResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (invoiceResult.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = invoiceResult.rows[0];

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || /^(your-|sk_test_replace)/i.test(stripeKey)) {
      return res.status(503).json({
        error: 'Payment link unavailable: Stripe is not configured. Set STRIPE_SECRET_KEY to enable checkout links.',
      });
    }

    const unitAmount = Math.round(Number(invoice.total) * 100);
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return res.status(400).json({ error: 'Payment link unavailable: invoice total must be greater than zero.' });
    }

    // Stripe expects application/x-www-form-urlencoded with bracketed keys.
    const baseUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][quantity]', '1');
    params.append('line_items[0][price_data][currency]', 'usd');
    params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
    params.append('line_items[0][price_data][product_data][name]', `Invoice ${invoice.invoice_number}`);
    params.append('success_url', `${baseUrl}/invoices?paid=true`);
    params.append('cancel_url', `${baseUrl}/invoices`);

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const stripeBody = await stripeResponse.json().catch(() => ({}));
    if (!stripeResponse.ok || !stripeBody.url) {
      const detail = stripeBody?.error?.message || `HTTP ${stripeResponse.status}`;
      return res.status(502).json({ error: `Payment link unavailable: Stripe request failed (${detail}).` });
    }

    await pool.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link TEXT');
    await pool.query(
      'UPDATE invoices SET payment_link = $1, updated_at = NOW() WHERE id = $2',
      [stripeBody.url, invoice.id]
    );

    res.json({
      invoice_id: invoice.id,
      payment_link: stripeBody.url,
      invoice_number: invoice.invoice_number,
      total: invoice.total,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
