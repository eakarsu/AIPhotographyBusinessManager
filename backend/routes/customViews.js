// Custom Views routes (Studio Views) — 4 endpoints supporting:
//  - VIZ1 BookingCalendar (monthly bookings grouped by date; no assignment data
//    exists on bookings/shoots, so every event is shown as "Unassigned")
//  - VIZ2 GalleryViewer  (real uploaded session photos for the gallery's client)
//  - NV1  InvoicePDF     (client+session picker -> generated PDF)
//  - NV2  PhotoSelectionWorkflow (staff selections persisted in Postgres)
//
// All endpoints require the existing auth middleware. There is no client-facing
// gallery/proofing portal; selections are staff-only and labelled as such.

const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch (e) { PDFDocument = null; }

const router = express.Router();

const UNASSIGNED = { name: 'Unassigned', color: '#64748b' };

async function ensureSelectionTables() {
  // session_photos is also created lazily by the sessions/photos routes; make
  // sure gallery reads work even if no upload has happened in this database.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_photos (
      id SERIAL PRIMARY KEY,
      session_id INTEGER,
      shoot_id INTEGER,
      file_name VARCHAR(255),
      file_size INTEGER,
      mime_type VARCHAR(100),
      file_data BYTEA,
      composition_score INTEGER DEFAULT 0,
      lighting_score INTEGER DEFAULT 0,
      focus_score INTEGER DEFAULT 0,
      overall_score INTEGER DEFAULT 0,
      client_delivery_ready BOOLEAN DEFAULT FALSE,
      ai_suggestions JSONB,
      caption_instagram TEXT,
      caption_facebook TEXT,
      caption_linkedin TEXT,
      hashtags TEXT[],
      scored_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery_photo_selections (
      id SERIAL PRIMARY KEY,
      gallery_id INTEGER NOT NULL,
      photo_id INTEGER NOT NULL,
      selected_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (gallery_id, photo_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery_selection_state (
      gallery_id INTEGER PRIMARY KEY,
      submitted BOOLEAN NOT NULL DEFAULT FALSE,
      submitted_by INTEGER,
      submitted_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

// Real photos attached to a gallery: session_photos uploaded against shoots
// belonging to the gallery's client.
async function loadGalleryPhotos(gallery) {
  const r = await pool.query(
    `SELECT sp.id, sp.file_name, sp.created_at,
            sp.focus_score, sp.overall_score, sp.scored_at,
            sh.title AS shoot_title, sh.shoot_date
       FROM session_photos sp
       JOIN shoots sh ON sh.id = sp.session_id
      WHERE sh.client_id = $1
      ORDER BY sp.created_at ASC, sp.id ASC
      LIMIT 200`,
    [gallery.client_id]
  );
  return r.rows;
}

async function loadSelectionState(galleryId) {
  const [selections, state] = await Promise.all([
    pool.query('SELECT photo_id FROM gallery_photo_selections WHERE gallery_id = $1', [galleryId]),
    pool.query('SELECT submitted, submitted_at FROM gallery_selection_state WHERE gallery_id = $1', [galleryId]),
  ]);
  const photoIds = selections.rows.map(row => row.photo_id);
  const submitted = state.rows.length > 0 && state.rows[0].submitted === true;
  return { photoIds, submitted, submittedAt: state.rows[0]?.submitted_at || null };
}

// ---------------------------------------------------------------------------
// VIZ 1 — Booking Calendar:  GET /api/custom-views/booking-calendar?month=YYYY-MM
// Returns month grid with bookings grouped by date. Bookings and shoots have no
// photographer column, so events are returned as "Unassigned" rather than with
// invented names.
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

    const statusColors = {
      'New':       '#94a3b8',
      'Contacted': '#0abde3',
      'Confirmed': '#10ac84',
      'Scheduled': '#5f27cd',
      'Completed': '#1dd1a1',
      'Cancelled': '#ee5253'
    };

    const events = [];
    for (const b of bookingsRes.rows) {
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
        photographer: UNASSIGNED.name,
        photographerColor: UNASSIGNED.color,
        assignmentNote: 'No photographer assignment is recorded for bookings.'
      });
    }
    for (const s of shootsRes.rows) {
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
        photographer: UNASSIGNED.name,
        photographerColor: UNASSIGNED.color,
        assignmentNote: 'No photographer assignment column exists on shoots.'
      });
    }

    res.json({
      year, month,
      daysInMonth: endDate.getUTCDate(),
      firstWeekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
      photographers: [UNASSIGNED],
      assignmentTracked: false,
      statusColors,
      events,
      counts: {
        bookings: bookingsRes.rows.length,
        shoots: shootsRes.rows.length,
        total: events.length
      },
      note: 'Photographer assignment is not tracked in this schema; every event is shown as Unassigned.'
    });
  } catch (err) {
    console.error('booking-calendar error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------------------------------------------------------------
// VIZ 2 — Gallery Viewer:  GET /api/custom-views/gallery-viewer?gallery_id=ID
// Returns the gallery's real uploaded photos (none fabricated) plus the current
// staff selection state.
// ---------------------------------------------------------------------------
router.get('/gallery-viewer', authenticateToken, async (req, res) => {
  try {
    const galleriesRes = await pool.query(
      `SELECT g.id, g.title, g.description, g.photo_count, g.status, g.client_id,
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
      return res.json({ galleries: [], active: null, photos: [], favoriteCount: 0, submitted: false });
    }

    await ensureSelectionTables();
    const [photoRows, selection] = await Promise.all([
      loadGalleryPhotos(active),
      loadSelectionState(active.id),
    ]);
    const selected = new Set(selection.photoIds);

    const photos = photoRows.map(p => ({
      id: p.id,
      label: p.file_name || `photo-${p.id}`,
      shootTitle: p.shoot_title,
      thumbnailUrl: `/api/photos/${p.id}/data`,
      favorited: selected.has(p.id),
      focusScore: p.scored_at ? Number(p.focus_score) : null,
      overallScore: p.scored_at ? Number(p.overall_score) : null,
      scoredAt: p.scored_at || null,
    }));

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
      submitted: selection.submitted,
      notice: photos.length === 0
        ? 'No uploaded photos are linked to this gallery\'s client shoots yet.'
        : 'Staff-only preview of uploaded photos. No client-facing gallery portal is provided.',
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
// NON-VIZ 2 — Photo Selection Workflow (staff only, persisted):
//   GET  /api/custom-views/photo-selection?gallery_id=ID
//   POST /api/custom-views/photo-selection  { gallery_id, photo_ids, submit }
// ---------------------------------------------------------------------------
router.get('/photo-selection', authenticateToken, async (req, res) => {
  try {
    await ensureSelectionTables();
    const galleriesRes = await pool.query(
      `SELECT g.id, g.title, g.photo_count, g.status, g.client_id, c.name AS client_name
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

    const [photoRows, selection] = await Promise.all([
      loadGalleryPhotos(active),
      loadSelectionState(active.id),
    ]);
    const selected = new Set(selection.photoIds);

    const photos = photoRows.map(p => ({
      id: p.id,
      label: p.file_name || `photo-${p.id}`,
      shootTitle: p.shoot_title,
      thumbnailUrl: `/api/photos/${p.id}/data`,
      favorited: selected.has(p.id),
      focusScore: p.scored_at ? Number(p.focus_score) : null,
      overallScore: p.scored_at ? Number(p.overall_score) : null,
      scoredAt: p.scored_at || null,
    }));

    res.json({
      galleries: galleries.map(g => ({
        id: g.id, title: g.title, photo_count: g.photo_count, client_name: g.client_name
      })),
      active: {
        id: active.id, title: active.title, photo_count: active.photo_count,
        status: active.status, client_name: active.client_name
      },
      photos,
      selections: Array.from(selected),
      submitted: selection.submitted,
      submittedAt: selection.submittedAt,
      notice: photos.length === 0
        ? 'No uploaded photos are linked to this gallery\'s client shoots yet.'
        : 'Staff-only proofing. Selections are saved to the studio database and are not exposed to clients.',
    });
  } catch (err) {
    console.error('photo-selection GET error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/photo-selection', authenticateToken, async (req, res) => {
  try {
    await ensureSelectionTables();
    const { gallery_id, photo_ids, selections, submit } = req.body || {};
    if (!gallery_id) return res.status(400).json({ error: 'gallery_id is required' });
    const gid = parseInt(gallery_id, 10);
    if (!Number.isInteger(gid)) return res.status(400).json({ error: 'gallery_id must be an integer' });

    const rawIds = Array.isArray(photo_ids) ? photo_ids : selections;
    if (!Array.isArray(rawIds)) return res.status(400).json({ error: 'photo_ids must be an array' });
    const ids = [...new Set(rawIds.map(v => parseInt(v, 10)).filter(v => Number.isInteger(v) && v > 0))];

    const galleryRes = await pool.query('SELECT id, client_id, title FROM galleries WHERE id = $1', [gid]);
    if (galleryRes.rows.length === 0) return res.status(404).json({ error: 'Gallery not found' });
    const gallery = galleryRes.rows[0];

    // Selections must reference photos that actually belong to this gallery's
    // client, so a caller cannot write cross-client selections.
    if (ids.length > 0) {
      const validRes = await pool.query(
        `SELECT sp.id
           FROM session_photos sp
           JOIN shoots sh ON sh.id = sp.session_id
          WHERE sh.client_id = $1 AND sp.id = ANY($2::int[])`,
        [gallery.client_id, ids]
      );
      const validIds = new Set(validRes.rows.map(r => r.id));
      const invalid = ids.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `These photos are not part of this gallery's client shoot set: ${invalid.join(', ')}` });
      }
    }

    const submitted = submit === true;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (ids.length === 0) {
        await client.query('DELETE FROM gallery_photo_selections WHERE gallery_id = $1', [gid]);
      } else {
        await client.query(
          'DELETE FROM gallery_photo_selections WHERE gallery_id = $1 AND NOT (photo_id = ANY($2::int[]))',
          [gid, ids]
        );
        await client.query(
          `INSERT INTO gallery_photo_selections (gallery_id, photo_id, selected_by, updated_at)
           SELECT $1, unnest($2::int[]), $3, NOW()
           ON CONFLICT (gallery_id, photo_id)
           DO UPDATE SET selected_by = EXCLUDED.selected_by, updated_at = NOW()`,
          [gid, ids, req.user?.id || null]
        );
      }
      await client.query(
        `INSERT INTO gallery_selection_state (gallery_id, submitted, submitted_by, submitted_at, updated_at)
         VALUES ($1, $2, $3, CASE WHEN $2 THEN NOW() ELSE NULL END, NOW())
         ON CONFLICT (gallery_id)
         DO UPDATE SET submitted = EXCLUDED.submitted,
                       submitted_by = EXCLUDED.submitted_by,
                       submitted_at = EXCLUDED.submitted_at,
                       updated_at = NOW()`,
        [gid, submitted, req.user?.id || null]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({
      ok: true,
      gallery_id: gid,
      gallery_title: gallery.title,
      favorited_count: ids.length,
      photo_ids: ids,
      submitted,
      message: submitted
        ? `Selection submitted for studio review (${ids.length} photos). Staff-only — no client-facing portal is provided.`
        : `Selection saved as a staff draft (${ids.length} photos).`,
    });
  } catch (err) {
    console.error('photo-selection POST error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
