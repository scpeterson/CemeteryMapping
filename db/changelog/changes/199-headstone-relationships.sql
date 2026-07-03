--liquibase formatted sql

--changeset cemeterymapping:199-headstone-relationships splitStatements:false
CREATE TABLE headstone_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_headstone_uuid uuid NOT NULL REFERENCES headstones(id) ON DELETE CASCADE,
  to_headstone_uuid uuid NOT NULL REFERENCES headstones(id) ON DELETE CASCADE,
  relationship_type varchar(50) NOT NULL,
  source_type varchar(50) NOT NULL DEFAULT 'manual',
  source_text text,
  confidence varchar(50) NOT NULL DEFAULT 'review',
  notes text,
  status varchar(50) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(1000),
  CONSTRAINT headstone_relationships_distinct_headstones_check CHECK (from_headstone_uuid <> to_headstone_uuid),
  CONSTRAINT headstone_relationships_relationship_type_check CHECK (
    relationship_type IN ('family_obelisk', 'references_marker', 'common_base', 'foot_marker', 'related_marker')
  ),
  CONSTRAINT headstone_relationships_source_type_check CHECK (
    source_type IN ('manual', 'nhg', 'field_observation', 'import')
  ),
  CONSTRAINT headstone_relationships_confidence_check CHECK (
    confidence IN ('high', 'medium', 'low', 'review')
  ),
  CONSTRAINT headstone_relationships_status_check CHECK (
    status IN ('active', 'needs_review', 'retired')
  )
);

CREATE UNIQUE INDEX headstone_relationships_active_unique_idx
  ON headstone_relationships (from_headstone_uuid, to_headstone_uuid, relationship_type)
  WHERE deleted_at IS NULL;

CREATE INDEX headstone_relationships_from_headstone_uuid_idx
  ON headstone_relationships (from_headstone_uuid)
  WHERE deleted_at IS NULL;

CREATE INDEX headstone_relationships_to_headstone_uuid_idx
  ON headstone_relationships (to_headstone_uuid)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS touch_headstone_relationships_updated_at ON headstone_relationships;
CREATE TRIGGER touch_headstone_relationships_updated_at
  BEFORE UPDATE ON headstone_relationships
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_headstone_relationships_changes ON headstone_relationships;
CREATE TRIGGER audit_headstone_relationships_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_relationships
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_headstone_relationships_changes ON headstone_relationships;
--rollback DROP TRIGGER IF EXISTS touch_headstone_relationships_updated_at ON headstone_relationships;
--rollback DROP INDEX IF EXISTS headstone_relationships_to_headstone_uuid_idx;
--rollback DROP INDEX IF EXISTS headstone_relationships_from_headstone_uuid_idx;
--rollback DROP INDEX IF EXISTS headstone_relationships_active_unique_idx;
--rollback DROP TABLE IF EXISTS headstone_relationships;
