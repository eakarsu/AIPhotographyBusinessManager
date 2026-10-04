BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS governed_evidence_tenant_case_id_unique
  ON governed_evidence(tenant_id, case_id, id);

-- Legacy clients/galleries have no tenant column. An operator must provision
-- these bindings before a governed case can access any legacy record.
CREATE TABLE IF NOT EXISTS governed_client_bindings (
  client_id INTEGER PRIMARY KEY REFERENCES clients(id) ON DELETE RESTRICT,
  tenant_id VARCHAR(128) NOT NULL,
  bound_by VARCHAR(128) NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, client_id)
);

CREATE TABLE IF NOT EXISTS governed_gallery_bindings (
  gallery_id INTEGER PRIMARY KEY REFERENCES galleries(id) ON DELETE RESTRICT,
  client_id INTEGER NOT NULL,
  tenant_id VARCHAR(128) NOT NULL,
  bound_by VARCHAR(128) NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, client_id) REFERENCES governed_client_bindings(tenant_id, client_id) ON DELETE RESTRICT
);

-- Local image bytes use the same Postgres BYTEA storage pattern as session_photos.
-- They remain separate so legacy photo routes cannot bypass governed access checks.
CREATE TABLE IF NOT EXISTS governed_gallery_assets (
  id BIGSERIAL PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE RESTRICT,
  shoot_id INTEGER NOT NULL REFERENCES shoots(id) ON DELETE RESTRICT,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(32) NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 15728640),
  file_sha256 CHAR(64) NOT NULL CHECK (file_sha256 ~ '^[a-f0-9]{64}$'),
  file_data BYTEA NOT NULL,
  uploaded_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, case_id) REFERENCES governed_cases(tenant_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_id, case_id, id),
  UNIQUE (tenant_id, case_id, file_sha256)
);

CREATE TABLE IF NOT EXISTS governed_gallery_rights_checks (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  asset_id BIGINT NOT NULL,
  decision VARCHAR(16) NOT NULL CHECK (decision IN ('approved','hold')),
  rights_evidence_id UUID,
  consent_evidence_id UUID,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 8 AND 2000),
  reviewed_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, case_id, asset_id) REFERENCES governed_gallery_assets(tenant_id, case_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, case_id, rights_evidence_id) REFERENCES governed_evidence(tenant_id, case_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, case_id, consent_evidence_id) REFERENCES governed_evidence(tenant_id, case_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS governed_gallery_access (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE RESTRICT,
  purpose VARCHAR(16) NOT NULL CHECK (purpose IN ('proof','final')),
  token_sha256 CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, case_id) REFERENCES governed_cases(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS governed_gallery_proof_selections (
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  access_id UUID NOT NULL REFERENCES governed_gallery_access(id) ON DELETE RESTRICT,
  asset_ids BIGINT[] NOT NULL CHECK (array_length(asset_ids, 1) > 0),
  version INTEGER NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, case_id),
  FOREIGN KEY (tenant_id, case_id) REFERENCES governed_cases(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS governed_gallery_deliveries (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  access_id UUID NOT NULL UNIQUE REFERENCES governed_gallery_access(id) ON DELETE RESTRICT,
  asset_ids BIGINT[] NOT NULL CHECK (array_length(asset_ids, 1) > 0),
  issued_by VARCHAR(128) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, case_id) REFERENCES governed_cases(tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS governed_gallery_events (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  case_id UUID NOT NULL,
  access_id UUID REFERENCES governed_gallery_access(id) ON DELETE RESTRICT,
  asset_id BIGINT,
  event_type VARCHAR(40) NOT NULL,
  actor_ref VARCHAR(128) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, case_id) REFERENCES governed_cases(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, case_id, asset_id) REFERENCES governed_gallery_assets(tenant_id, case_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS governed_gallery_assets_case_idx ON governed_gallery_assets(tenant_id, case_id, created_at);
CREATE INDEX IF NOT EXISTS governed_gallery_rights_case_idx ON governed_gallery_rights_checks(tenant_id, case_id, asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS governed_gallery_access_case_idx ON governed_gallery_access(tenant_id, case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS governed_gallery_events_case_idx ON governed_gallery_events(tenant_id, case_id, created_at DESC);

DROP TRIGGER IF EXISTS governed_gallery_assets_immutable ON governed_gallery_assets;
CREATE TRIGGER governed_gallery_assets_immutable BEFORE UPDATE OR DELETE ON governed_gallery_assets
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();
DROP TRIGGER IF EXISTS governed_client_bindings_immutable ON governed_client_bindings;
CREATE TRIGGER governed_client_bindings_immutable BEFORE UPDATE OR DELETE ON governed_client_bindings
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();
DROP TRIGGER IF EXISTS governed_gallery_bindings_immutable ON governed_gallery_bindings;
CREATE TRIGGER governed_gallery_bindings_immutable BEFORE UPDATE OR DELETE ON governed_gallery_bindings
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();
DROP TRIGGER IF EXISTS governed_gallery_rights_immutable ON governed_gallery_rights_checks;
CREATE TRIGGER governed_gallery_rights_immutable BEFORE UPDATE OR DELETE ON governed_gallery_rights_checks
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();
DROP TRIGGER IF EXISTS governed_gallery_deliveries_immutable ON governed_gallery_deliveries;
CREATE TRIGGER governed_gallery_deliveries_immutable BEFORE UPDATE OR DELETE ON governed_gallery_deliveries
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();
DROP TRIGGER IF EXISTS governed_gallery_events_immutable ON governed_gallery_events;
CREATE TRIGGER governed_gallery_events_immutable BEFORE UPDATE OR DELETE ON governed_gallery_events
FOR EACH ROW EXECUTE FUNCTION reject_governance_history_mutation();

COMMIT;
