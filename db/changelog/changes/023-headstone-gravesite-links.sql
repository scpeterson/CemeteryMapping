--liquibase formatted sql

--changeset cemeterymapping:023-headstone-gravesite-links splitStatements:false
CREATE TABLE headstone_gravesites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headstone_uuid uuid NOT NULL REFERENCES headstones(id) ON DELETE CASCADE,
  gravesite_uuid uuid NOT NULL REFERENCES gravesites(id) ON DELETE CASCADE,
  relationship_type varchar(50) NOT NULL DEFAULT 'primary',
  notes varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(1000),
  CONSTRAINT headstone_gravesites_unique UNIQUE (headstone_uuid, gravesite_uuid),
  CONSTRAINT headstone_gravesites_relationship_type_check CHECK (
    relationship_type IN ('primary', 'spans', 'nearby', 'inferred')
  )
);

INSERT INTO headstone_gravesites (
  headstone_uuid,
  gravesite_uuid,
  relationship_type,
  created_at,
  updated_at
)
SELECT
  id,
  gravesite_uuid,
  'primary',
  created_at,
  updated_at
FROM headstones
WHERE gravesite_uuid IS NOT NULL
  AND deleted_at IS NULL
ON CONFLICT (headstone_uuid, gravesite_uuid) DO NOTHING;

CREATE INDEX headstone_gravesites_gravesite_uuid_idx ON headstone_gravesites (gravesite_uuid);
CREATE INDEX headstone_gravesites_not_deleted_idx
  ON headstone_gravesites (headstone_uuid, gravesite_uuid)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS touch_headstone_gravesites_updated_at ON headstone_gravesites;
CREATE TRIGGER touch_headstone_gravesites_updated_at
  BEFORE UPDATE ON headstone_gravesites
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_headstone_gravesites_changes ON headstone_gravesites;
CREATE TRIGGER audit_headstone_gravesites_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_gravesites
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_headstone_gravesites_changes ON headstone_gravesites;
--rollback DROP TRIGGER IF EXISTS touch_headstone_gravesites_updated_at ON headstone_gravesites;
--rollback DROP INDEX IF EXISTS headstone_gravesites_not_deleted_idx;
--rollback DROP INDEX IF EXISTS headstone_gravesites_gravesite_uuid_idx;
--rollback DROP TABLE IF EXISTS headstone_gravesites;
