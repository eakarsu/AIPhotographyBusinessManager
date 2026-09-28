BEGIN;

-- Payment links are only written when Stripe Checkout succeeds; there is no
-- local /pay/... fallback.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_link TEXT;

-- Staff photo proofing selections. Scoped per gallery and persisted in the
-- database (previously kept in process memory and lost on restart).
CREATE TABLE IF NOT EXISTS gallery_photo_selections (
  id SERIAL PRIMARY KEY,
  gallery_id INTEGER NOT NULL,
  photo_id INTEGER NOT NULL,
  selected_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (gallery_id, photo_id)
);

CREATE TABLE IF NOT EXISTS gallery_selection_state (
  gallery_id INTEGER PRIMARY KEY,
  submitted BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_by INTEGER,
  submitted_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_photo_selections_gallery
  ON gallery_photo_selections(gallery_id);

COMMIT;
