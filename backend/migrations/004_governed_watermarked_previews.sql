BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS governed_gallery_previews (
  asset_id BIGINT PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  proof_id VARCHAR(64) NOT NULL,
  mime_type VARCHAR(32) NOT NULL CHECK (mime_type='image/png'),
  width INTEGER NOT NULL CHECK (width=640),
  height INTEGER NOT NULL CHECK (height=480),
  watermark_version VARCHAR(32) NOT NULL CHECK (watermark_version='proof-v1'),
  preview_size INTEGER NOT NULL CHECK (preview_size BETWEEN 100 AND 3145728),
  preview_sha256 CHAR(64) NOT NULL CHECK (preview_sha256 ~ '^[a-f0-9]{64}$'),
  preview_data BYTEA NOT NULL,
  generated_by VARCHAR(128) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id,case_id,asset_id)
    REFERENCES governed_gallery_assets(tenant_id,case_id,id) ON DELETE RESTRICT,
  UNIQUE (tenant_id,case_id,proof_id),
  CHECK (octet_length(preview_data)=preview_size),
  CHECK (substring(preview_data FROM 1 FOR 8)=decode('89504e470d0a1a0a','hex')),
  CHECK (encode(digest(preview_data,'sha256'),'hex')=preview_sha256)
);

CREATE INDEX IF NOT EXISTS governed_gallery_previews_scope_idx
  ON governed_gallery_previews(tenant_id,case_id,asset_id);

DROP TRIGGER IF EXISTS governed_gallery_previews_immutable ON governed_gallery_previews;
CREATE TRIGGER governed_gallery_previews_immutable BEFORE UPDATE OR DELETE ON governed_gallery_previews
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();

COMMIT;
