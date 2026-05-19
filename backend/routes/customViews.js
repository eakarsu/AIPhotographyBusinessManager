// Custom Views routes (Studio Views) — 4 endpoints supporting:
//  - VIZ1 BookingCalendar (monthly bookings grouped by photographer/shoot_type)
//  - VIZ2 GalleryViewer  (synthetic photos per gallery with thumbnail + favorited)
//  - NV1  InvoicePDF     (client+session picker -> generated PDF)
//  - NV2  PhotoSelectionWorkflow (records favorited photo selections and reads state)
//
// All endpoints require the existing auth middleware.

const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

const router = express.Router();

// In-memory favorites store keyed by gallery_id -> Set(photo_index).
// (No schema changes required; survives within a single backend process.)
const favoritesStore = new Map(); // key: gallery_id -> { selections: Map(photo_index -> true), submitted: bool }

function deterministicSeed(seedStr) {
  let h = 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = ((h << 5) - h) + seedStr.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function pseudoRandom(seed, idx) {
  const x = Math.sin((seed + idx) * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function gradientForPhoto(seed, idx) {
  const palette = [
    ['#ff6b9d', '#feca57'], ['#48dbfb', '#0abde3'], ['#1dd1a1', '#10ac84'],
    ['#5f27cd', '#341f97'], ['#ff9ff3', '#f368e0'], ['#ee5253', '#c8d6e5'],
    ['#feca57', '#ff9f43'], ['#54a0ff', '#2e86de'], ['#00d2d3', '#01a3a4'],
    ['#ff6348', '#ff7f50'], ['#a29bfe', '#6c5ce7'], ['#fd79a8', '#e84393']
  ];
  const pair = palette[(seed + idx) % palette.length];
  const angle = Math.floor(pseudoRandom(seed, idx) * 360);
  return `linear-gradient(${angle}deg, ${pair[0]}, ${pair[1]})`;
}

// ---------------------------------------------------------------------------
// VIZ 1 — Booking Calendar:  GET /api/custom-views/booking-calendar?month=YYYY-MM
// Returns month grid with bookings grouped by date plus per-photographer color.
// ---------------------------------------------------------------------------
router.get('/booking-calendar', authenticateToken, async (req, res) => {
  try {
    const monthParam = req.query.month; // YYYY-MM
    const now = new Date();
    let year, month;
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      [year, month] = monthParam.split('-').map(Number);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const bookingsRes = await pool.query(
      `SELECT id, client_name, shoot_type, preferred_date, preferred_time,
              location, budget, status, referral_source
         FROM bookings
        WHERE preferred_date IS NOT NULL
          AND preferred_date >= $1
          AND preferred_date <= $2
        ORDER BY preferred_date ASC, preferred_time ASC`,
      [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
    );

    const shootsRes = await pool.query(
      `SELECT id, title, client_id, shoot_date, start_time, end_time,
              location, shoot_type, status, package_name, price
         FROM shoots
        WHERE shoot_date IS NOT NULL
          AND shoot_date >= $1
          AND shoot_date <= $2
        ORDER BY shoot_date ASC, start_time ASC`,
      [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
    );

    // Build a quick photographer mapping using a deterministic assignment.
    // (Backend has no `photographer` column; we synthesize from shoot_type.)
    const photographers = [
      { name: 'Alex Rivera',     color: '#5f27cd' },
      { name: 'Jordan Park',     color: '#0abde3' },
      { name: 'Riley Chen',      color: '#10ac84' },
      { name: 'Casey Morales',   color: '#ee5253' },
      { name: 'Sam Patel',       color: '#feca57' }
    ];
    const statusColors = {
      'New':       '#94a3b8',
      'Contacted': '#0abde3',
      'Confirmed': '#10ac84',
      'Scheduled': '#5f27cd',
      'Completed': '#1dd1a1',
      'Cancelled': '#ee5253'
    };

    const assignPhotographer = (key) => {
      const seed = deterministicSeed(String(key || 'x'));
      return photographers[seed % photographers.length];
    };

    const events = [];
    for (const b of bookingsRes.rows) {
      const photog = assignPhotographer(b.shoot_type + '|' + b.id);
      events.push({
        id: `booking-${b.id}`,
        kind: 'booking',
        title: `${b.shoot_type || 'Session'} — ${b.client_name}`,
        date: (b.preferred_date instanceof Date)
          ? b.preferred_date.toISOString().slice(0, 10)
          : String(b.preferred_date).slice(0, 10),
        time: b.preferred_time || null,
        location: b.location,
        status: b.status,
        statusColor: statusColors[b.status] || '#94a3b8',
        photographer: photog.name,
        photographerColor: photog.color
      });
    }
    for (const s of shootsRes.rows) {
      const photog = assignPhotographer(s.shoot_type + '|' + s.id);
      events.push({
        id: `shoot-${s.id}`,
        kind: 'shoot',
        title: s.title,
        date: (s.shoot_date instanceof Date)
          ? s.shoot_date.toISOString().slice(0, 10)
          : String(s.shoot_date).slice(0, 10),
        time: s.start_time || null,
        location: s.location,
        status: s.status,
        statusColor: statusColors[s.status] || '#5f27cd',
        photographer: photog.name,
        photographerColor: photog.color
      });
    }

    res.json({
      year, month,
      daysInMonth: endDate.getUTCDate(),
      firstWeekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
      photographers,
      statusColors,
      events,
      counts: {
        bookings: bookingsRes.rows.length,
        shoots: shootsRes.rows.length,
        total: events.length
      }
    });
  } catch (err) {
    console.error('booking-calendar error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// VIZ 2 — Gallery Viewer:  GET /api/custom-views/gallery-viewer?gallery_id=ID
// Returns the gallery's photo set (synthetic from photo_count) and current
// favorited state from PhotoSelectionWorkflow.
// ---------------------------------------------------------------------------
router.get('/gallery-viewer', authenticateToken, async (req, res) => {
  try {
    const galleriesRes = await pool.query(
      `SELECT g.id, g.title, g.description, g.photo_count, g.status,
              g.delivery_date, g.cover_image_url, c.name AS client_name
         FROM galleries g
         LEFT JOIN clients c ON c.id = g.client_id
        ORDER BY g.id ASC`
    );

    const galleries = galleriesRes.rows;
    const galleryIdParam = req.query.gallery_id ? parseInt(req.query.gallery_id, 10) : null;
    const active = galleryIdParam
      ? galleries.find(g => g.id === galleryIdParam)
      : galleries[0];

    if (!active) {
      return res.json({ galleries: [], active: null, photos: [], favoriteCount: 0 });
    }

    const seed = deterministicSeed(`${active.id}:${active.title}`);
    const photoCount = Math.min(Math.max(active.photo_count || 24, 12), 48);
    const fav = favoritesStore.get(active.id) || { selections: new Map(), submitted: false };

    const photos = [];
    for (let i = 0; i < photoCount; i++) {
      const isFav = fav.selections.has(i);
      photos.push({
        index: i,
        label: `${String(active.id).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
        thumbnail: gradientForPhoto(seed, i),
        favorited: isFav,
        width: 1 + Math.floor(pseudoRandom(seed, i * 3) * 1.6),
        height: 1 + Math.floor(pseudoRandom(seed, i * 5) * 1.6)
      });
    }

    res.json({
      galleries: galleries.map(g => ({
        id: g.id,
        title: g.title,
        client_name: g.client_name,
        photo_count: g.photo_count,
        status: g.status
      })),
      active: {
        id: active.id,
        title: active.title,
        description: active.description,
        photo_count: active.photo_count,
        status: active.status,
        delivery_date: active.delivery_date,
        client_name: active.client_name
      },
      photos,
      favoriteCount: photos.filter(p => p.favorited).length,
      submitted: fav.submitted === true
    });
  } catch (err) {
    console.error('gallery-viewer error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// NON-VIZ 1 — Invoice PDF:
//   GET  /api/custom-views/invoice-pdf            -> list clients + sessions
//   POST /api/custom-views/invoice-pdf            -> generate PDF stream
// ---------------------------------------------------------------------------
router.get('/invoice-pdf', authenticateToken, async (req, res) => {
  try {
    const clientsRes = await pool.query(
      `SELECT id, name, email, address, category FROM clients ORDER BY name ASC`
    );
    const shootsRes = await pool.query(
      `SELECT s.id, s.title, s.client_id, s.shoot_date, s.shoot_type,
              s.package_name, s.price, s.status, c.name AS client_name
         FROM shoots s
         LEFT JOIN clients c ON c.id = s.client_id
        ORDER BY s.shoot_date DESC NULLS LAST`
    );
    res.json({
      clients: clientsRes.rows,
      sessions: shootsRes.rows,
      paymentTerms: 'Net 14 days. Late fees of 1.5% per month apply.',
      taxRate: 8.25,
      pdfReady: !!PDFDocument
    });
  } catch (err) {
    console.error('invoice-pdf GET error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/invoice-pdf', authenticateToken, async (req, res) => {
  try {
    const { client_id, shoot_id, extra_items, notes } = req.body || {};
    if (!client_id || !shoot_id) {
      return res.status(400).json({ error: 'client_id and shoot_id are required' });
    }
    const clientRes = await pool.query('SELECT * FROM clients WHERE id = $1', [client_id]);
    const shootRes = await pool.query('SELECT * FROM shoots WHERE id = $1', [shoot_id]);
    if (clientRes.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    if (shootRes.rows.length === 0) return res.status(404).json({ error: 'Shoot not found' });

    const client = clientRes.rows[0];
    const shoot = shootRes.rows[0];

    const items = [];
    items.push({
      description: `${shoot.shoot_type || 'Photography'} — ${shoot.title}`,
      qty: 1,
      price: Number(shoot.price) || 0
    });
    if (shoot.package_name) {
      items.push({
        description: `Package: ${shoot.package_name}`,
        qty: 1,
        price: 0
      });
    }
    if (Array.isArray(extra_items)) {
      for (const li of extra_items) {
        if (li && li.description) {
          items.push({
            description: String(li.description),
            qty: Number(li.qty) || 1,
            price: Number(li.price) || 0
          });
        }
      }
    }

    const subtotal = items.reduce((s, it) => s + (it.qty * it.price), 0);
    const taxRate = 8.25;
    const tax = +(subtotal * taxRate / 100).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    const invoiceNumber = `INV-CV-${Date.now().toString().slice(-6)}`;

    if (!PDFDocument) {
      return res.json({
        ok: true,
        format: 'json-fallback',
        warning: 'pdfkit not installed; returning JSON invoice payload',
        invoice: { invoice_number: invoiceNumber, client, shoot, items, subtotal, tax, total, notes, paymentTerms: 'Net 14 days.' }
      });
    }

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoiceNumber}.pdf"`);
    doc.pipe(res);

    doc.fontSize(22).fillColor('#5f27cd').text('PhotoStudio AI', { align: 'left' });
    doc.fontSize(10).fillColor('#444').text('Photography Business Manager', { align: 'left' });
    doc.moveDown();

    doc.fontSize(18).fillColor('#000').text(`Invoice ${invoiceNumber}`, { align: 'right' });
    doc.fontSize(10).fillColor('#666').text(`Date: ${new Date().toISOString().slice(0, 10)}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(12).fillColor('#000').text('Bill To:');
    doc.fontSize(11).fillColor('#333').text(client.name);
    if (client.email) doc.text(client.email);
    if (client.address) doc.text(client.address);
    doc.moveDown();

    doc.fontSize(12).fillColor('#000').text('Session:');
    doc.fontSize(11).fillColor('#333').text(`${shoot.title} (${shoot.shoot_type || 'Photography'})`);
    if (shoot.shoot_date) doc.text(`Date: ${String(shoot.shoot_date).slice(0, 10)}`);
    if (shoot.location)  doc.text(`Location: ${shoot.location}`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#000').text('Line Items', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000');
    const startY = doc.y;
    doc.text('Description', 50, startY);
    doc.text('Qty',         360, startY, { width: 50, align: 'right' });
    doc.text('Price',       420, startY, { width: 60, align: 'right' });
    doc.text('Amount',      490, startY, { width: 70, align: 'right' });
    doc.moveTo(50, doc.y + 4).lineTo(560, doc.y + 4).strokeColor('#aaa').stroke();
    doc.moveDown(0.8);

    for (const it of items) {
      const y = doc.y;
      doc.fillColor('#333').text(it.description, 50, y, { width: 300 });
      doc.text(String(it.qty),                360, y, { width: 50, align: 'right' });
      doc.text(`$${it.price.toFixed(2)}`,     420, y, { width: 60, align: 'right' });
      doc.text(`$${(it.qty * it.price).toFixed(2)}`, 490, y, { width: 70, align: 'right' });
      doc.moveDown(0.6);
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(560, doc.y).strokeColor('#aaa').stroke();
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor('#000');
    doc.text(`Subtotal: $${subtotal.toFixed(2)}`, { align: 'right' });
    doc.text(`Tax (${taxRate}%): $${tax.toFixed(2)}`, { align: 'right' });
    doc.fontSize(13).fillColor('#5f27cd').text(`Total: $${total.toFixed(2)}`, { align: 'right' });
    doc.moveDown(2);

    doc.fontSize(11).fillColor('#000').text('Payment Terms', { underline: true });
    doc.fontSize(10).fillColor('#333').text('Net 14 days from invoice date.');
    doc.text('Accepted: bank transfer, Venmo (@PhotoStudioAI), credit card.');
    doc.text('Late fee of 1.5% per month applies to overdue balances.');
    if (notes) {
      doc.moveDown();
      doc.fontSize(11).fillColor('#000').text('Notes', { underline: true });
      doc.fontSize(10).fillColor('#333').text(String(notes));
    }

    doc.end();
  } catch (err) {
    console.error('invoice-pdf POST error', err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// NON-VIZ 2 — Photo Selection Workflow:
//   GET  /api/custom-views/photo-selection?gallery_id=ID
//   POST /api/custom-views/photo-selection  { gallery_id, selections, submit }
// ---------------------------------------------------------------------------
router.get('/photo-selection', authenticateToken, async (req, res) => {
  try {
    const galleriesRes = await pool.query(
      `SELECT g.id, g.title, g.photo_count, g.status, c.name AS client_name
         FROM galleries g
         LEFT JOIN clients c ON c.id = g.client_id
        ORDER BY g.id ASC`
    );
    const galleries = galleriesRes.rows;
    const galleryIdParam = req.query.gallery_id
      ? parseInt(req.query.gallery_id, 10)
      : (galleries[0] && galleries[0].id);
    const active = galleries.find(g => g.id === galleryIdParam) || galleries[0];
    if (!active) {
      return res.json({ galleries: [], active: null, photos: [], selections: [], submitted: false });
    }

    const seed = deterministicSeed(`${active.id}:${active.title}`);
    const photoCount = Math.min(Math.max(active.photo_count || 24, 12), 48);
    const state = favoritesStore.get(active.id) || { selections: new Map(), submitted: false };

    const photos = [];
    for (let i = 0; i < photoCount; i++) {
      photos.push({
        index: i,
        label: `${String(active.id).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
        thumbnail: gradientForPhoto(seed, i),
        favorited: state.selections.has(i)
      });
    }

    res.json({
      galleries: galleries.map(g => ({
        id: g.id, title: g.title, photo_count: g.photo_count, client_name: g.client_name
      })),
      active: {
        id: active.id, title: active.title, photo_count: active.photo_count,
        status: active.status, client_name: active.client_name
      },
      photos,
      selections: Array.from(state.selections.keys()),
      submitted: state.submitted === true,
      clientVisibleState: state.submitted
        ? `Client sees ${state.selections.size} favorited photo(s) — selection submitted.`
        : 'Selection not yet submitted; client sees draft state only.'
    });
  } catch (err) {
    console.error('photo-selection GET error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/photo-selection', authenticateToken, async (req, res) => {
  try {
    const { gallery_id, selections, submit } = req.body || {};
    if (!gallery_id) return res.status(400).json({ error: 'gallery_id is required' });
    const gid = parseInt(gallery_id, 10);

    const existing = favoritesStore.get(gid) || { selections: new Map(), submitted: false };
    if (Array.isArray(selections)) {
      existing.selections = new Map();
      for (const s of selections) {
        const idx = parseInt(s, 10);
        if (!Number.isNaN(idx)) existing.selections.set(idx, true);
      }
    }
    if (typeof submit === 'boolean') existing.submitted = submit;
    favoritesStore.set(gid, existing);

    res.json({
      ok: true,
      gallery_id: gid,
      favorited_count: existing.selections.size,
      selections: Array.from(existing.selections.keys()),
      submitted: existing.submitted,
      clientVisibleState: existing.submitted
        ? `Client sees ${existing.selections.size} favorited photo(s) — selection submitted.`
        : 'Selection saved as draft; client does not see favorites yet.'
    });
  } catch (err) {
    console.error('photo-selection POST error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
