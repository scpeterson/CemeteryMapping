--liquibase formatted sql

--changeset cemeterymapping:487-monument-photo-contexts splitStatements:false
CREATE TABLE monument_photo_contexts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 headstone_uuid uuid NOT NULL REFERENCES headstones(id),
 media_asset_id uuid NOT NULL REFERENCES media_assets(id),
 inspection_id uuid REFERENCES monument_inspections(id),
 maintenance_record_id uuid REFERENCES maintenance_records(id),
 phase text NOT NULL DEFAULT 'unspecified' CHECK(phase IN ('unspecified','before','during','after')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 CHECK(num_nonnulls(inspection_id,maintenance_record_id)=1)
);
CREATE UNIQUE INDEX monument_photo_inspection_unique ON monument_photo_contexts(inspection_id,media_asset_id) WHERE inspection_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX monument_photo_maintenance_unique ON monument_photo_contexts(maintenance_record_id,media_asset_id) WHERE maintenance_record_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX monument_photo_contexts_marker_idx ON monument_photo_contexts(headstone_uuid) WHERE deleted_at IS NULL;
CREATE FUNCTION validate_monument_photo_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id
  JOIN headstones h ON h.id=l.headstone_uuid
  WHERE l.headstone_uuid=NEW.headstone_uuid AND l.media_asset_id=NEW.media_asset_id AND l.deleted_at IS NULL
  AND l.status='linked' AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo' AND h.deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Photo must be actively linked to this monument';
 END IF;
 IF NEW.inspection_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM monument_inspections WHERE id=NEW.inspection_id AND headstone_uuid=NEW.headstone_uuid) THEN
  RAISE EXCEPTION 'Inspection must belong to this monument';
 END IF;
 IF NEW.maintenance_record_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM maintenance_records WHERE id=NEW.maintenance_record_id AND headstone_uuid=NEW.headstone_uuid AND deleted_at IS NULL) THEN
  RAISE EXCEPTION 'Maintenance action must belong to this monument';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_monument_photo_context BEFORE INSERT OR UPDATE ON monument_photo_contexts FOR EACH ROW EXECUTE FUNCTION validate_monument_photo_context();
CREATE TRIGGER audit_monument_photo_contexts AFTER INSERT OR UPDATE OR DELETE ON monument_photo_contexts FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

-- The administrator confirms that all existing monument photos belong to the
-- 2026 field inspections. No photos are assigned to NHG or cloned to new visits.
SELECT assert_migration_prerequisite(NOT EXISTS(
 SELECT 1 FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id JOIN headstones h ON h.id=l.headstone_uuid
 WHERE l.deleted_at IS NULL AND l.status='linked' AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo' AND h.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM monument_inspections i WHERE i.headstone_uuid=h.id AND i.source_type='field_survey' AND i.inspection_year=2026)
),'Existing monument photos require an identified 2026 field inspection before backfill');
INSERT INTO monument_photo_contexts(headstone_uuid,media_asset_id,inspection_id)
SELECT l.headstone_uuid,l.media_asset_id,chosen.id
FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id JOIN headstones h ON h.id=l.headstone_uuid
CROSS JOIN LATERAL(SELECT i.id FROM monument_inspections i WHERE i.headstone_uuid=h.id AND i.source_type='field_survey' AND i.inspection_year=2026
 ORDER BY CASE WHEN i.inspected_at=m.captured_at::date THEN 0 ELSE 1 END,
 abs(i.inspected_at-m.captured_at::date) NULLS LAST,i.inspected_at DESC NULLS LAST,i.created_at,i.id LIMIT 1) chosen
WHERE l.deleted_at IS NULL AND l.status='linked' AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo' AND h.deleted_at IS NULL;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cemetery_api') THEN GRANT SELECT,INSERT,UPDATE,DELETE ON monument_photo_contexts TO cemetery_api; END IF;
END $$;
--rollback DROP TABLE IF EXISTS monument_photo_contexts;
--rollback DROP FUNCTION IF EXISTS validate_monument_photo_context();
