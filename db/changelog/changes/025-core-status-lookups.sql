--liquibase formatted sql

--changeset cemeterymapping:025-core-status-lookups splitStatements:false
CREATE TABLE headstone_condition_types (
  code varchar(50) PRIMARY KEY,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gravesite_status_types (
  code varchar(50) PRIMARY KEY,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lot_ownership_event_types (
  code varchar(50) PRIMARY KEY,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO headstone_condition_types (code, label, description, sort_order)
VALUES
  ('excellent', 'Excellent', 'Marker is intact, stable, legible, and has no notable damage.', 10),
  ('good', 'Good', 'Marker is generally stable and legible with minor wear or maintenance needs.', 20),
  ('fair', 'Fair', 'Marker is legible but has moderate wear, settling, staining, or repair needs.', 30),
  ('poor', 'Poor', 'Marker has significant wear, instability, breakage, or legibility issues.', 40),
  ('damaged', 'Damaged', 'Marker has known damage that should be reviewed or repaired.', 50),
  ('unknown', 'Unknown', 'Marker condition has not been inspected or recorded yet.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO gravesite_status_types (code, label, description, sort_order)
VALUES
  ('available', 'Available', 'Gravesite is available for sale or assignment.', 10),
  ('reserved', 'Reserved', 'Gravesite has been reserved but is not known to be occupied.', 20),
  ('occupied', 'Occupied', 'Gravesite has at least one burial or is otherwise known to be occupied.', 30),
  ('sold', 'Sold', 'Burial rights have been sold or assigned, but occupation is not confirmed.', 40),
  ('needs_review', 'Needs review', 'Gravesite status is unclear and needs staff review.', 50),
  ('unknown', 'Unknown', 'Gravesite status has not been determined.', 900)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO lot_ownership_event_types (code, label, description, sort_order)
VALUES
  ('deed', 'Deed', 'Ownership or burial rights are documented by a deed.', 10),
  ('sale', 'Sale', 'Ownership or burial rights transferred by sale.', 20),
  ('gift', 'Gift', 'Ownership or burial rights transferred by gift.', 30),
  ('church_council_action', 'Church council action', 'Ownership or burial rights were assigned or clarified by church council action.', 40),
  ('correction', 'Correction', 'Ownership record was corrected without representing a new transfer.', 50),
  ('release', 'Release', 'Ownership or burial rights were released or ended.', 60)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

UPDATE headstones
SET condition = 'unknown'
WHERE condition IS NULL
  OR btrim(condition) = '';

UPDATE gravesites
SET status = CASE
    WHEN status IS NULL OR btrim(status) = '' THEN 'unknown'
    WHEN lower(btrim(status)) = 'available' THEN 'available'
    WHEN lower(btrim(status)) = 'reserved' THEN 'reserved'
    WHEN lower(btrim(status)) = 'occupied' THEN 'occupied'
    WHEN lower(btrim(status)) = 'sold' THEN 'sold'
    WHEN lower(btrim(status)) IN ('needs review', 'needs_review', 'review') THEN 'needs_review'
    ELSE 'unknown'
  END;

ALTER TABLE headstones
  ALTER COLUMN condition SET DEFAULT 'unknown',
  ALTER COLUMN condition SET NOT NULL,
  ADD CONSTRAINT headstones_condition_fk
    FOREIGN KEY (condition) REFERENCES headstone_condition_types(code);

ALTER TABLE gravesites
  ALTER COLUMN status SET DEFAULT 'unknown',
  ALTER COLUMN status SET NOT NULL,
  ADD CONSTRAINT gravesites_status_fk
    FOREIGN KEY (status) REFERENCES gravesite_status_types(code);

ALTER TABLE lot_ownership_events
  ADD CONSTRAINT lot_ownership_events_type_fk
    FOREIGN KEY (event_type) REFERENCES lot_ownership_event_types(code);

CREATE INDEX headstones_condition_idx ON headstones (condition);
CREATE INDEX lot_ownership_events_type_idx ON lot_ownership_events (event_type);

DROP TRIGGER IF EXISTS touch_headstone_condition_types_updated_at ON headstone_condition_types;
CREATE TRIGGER touch_headstone_condition_types_updated_at
  BEFORE UPDATE ON headstone_condition_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_gravesite_status_types_updated_at ON gravesite_status_types;
CREATE TRIGGER touch_gravesite_status_types_updated_at
  BEFORE UPDATE ON gravesite_status_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_lot_ownership_event_types_updated_at ON lot_ownership_event_types;
CREATE TRIGGER touch_lot_ownership_event_types_updated_at
  BEFORE UPDATE ON lot_ownership_event_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_headstone_condition_types_changes ON headstone_condition_types;
CREATE TRIGGER audit_headstone_condition_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_condition_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('code');

DROP TRIGGER IF EXISTS audit_gravesite_status_types_changes ON gravesite_status_types;
CREATE TRIGGER audit_gravesite_status_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON gravesite_status_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('code');

DROP TRIGGER IF EXISTS audit_lot_ownership_event_types_changes ON lot_ownership_event_types;
CREATE TRIGGER audit_lot_ownership_event_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON lot_ownership_event_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('code');

--rollback DROP TRIGGER IF EXISTS audit_lot_ownership_event_types_changes ON lot_ownership_event_types;
--rollback DROP TRIGGER IF EXISTS audit_gravesite_status_types_changes ON gravesite_status_types;
--rollback DROP TRIGGER IF EXISTS audit_headstone_condition_types_changes ON headstone_condition_types;
--rollback DROP TRIGGER IF EXISTS touch_lot_ownership_event_types_updated_at ON lot_ownership_event_types;
--rollback DROP TRIGGER IF EXISTS touch_gravesite_status_types_updated_at ON gravesite_status_types;
--rollback DROP TRIGGER IF EXISTS touch_headstone_condition_types_updated_at ON headstone_condition_types;
--rollback DROP INDEX IF EXISTS lot_ownership_events_type_idx;
--rollback DROP INDEX IF EXISTS headstones_condition_idx;
--rollback ALTER TABLE lot_ownership_events DROP CONSTRAINT IF EXISTS lot_ownership_events_type_fk;
--rollback ALTER TABLE gravesites DROP CONSTRAINT IF EXISTS gravesites_status_fk, ALTER COLUMN status DROP DEFAULT, ALTER COLUMN status DROP NOT NULL;
--rollback ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_condition_fk, ALTER COLUMN condition DROP DEFAULT, ALTER COLUMN condition DROP NOT NULL;
--rollback DROP TABLE IF EXISTS lot_ownership_event_types;
--rollback DROP TABLE IF EXISTS gravesite_status_types;
--rollback DROP TABLE IF EXISTS headstone_condition_types;
