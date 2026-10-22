--liquibase formatted sql

--changeset cemeterymapping:488-inspection-photo-faces splitStatements:false
ALTER TABLE monument_photo_contexts ADD COLUMN face_id uuid;
-- Face labels refer to the selected observation's snapshot, not today's reading.
CREATE FUNCTION validate_photo_face_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE face_list jsonb;
BEGIN
 IF NEW.deleted_at IS NOT NULL OR NEW.face_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.inspection_id IS NOT NULL THEN
  SELECT faces INTO face_list FROM monument_inspections WHERE id=NEW.inspection_id;
 ELSE
  SELECT faces INTO face_list FROM headstones WHERE id=NEW.headstone_uuid;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(face_list,'[]'::jsonb)) f WHERE f->>'id'=NEW.face_id::text) THEN
  RAISE EXCEPTION 'Photo face must belong to the inspection or monument';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_photo_face_context BEFORE INSERT OR UPDATE ON monument_photo_contexts FOR EACH ROW EXECUTE FUNCTION validate_photo_face_context();
-- Existing face snapshots and transcriptions are retained without guessing which
-- face an unassigned historical reading or photo belongs to.
--rollback DROP TRIGGER IF EXISTS validate_photo_face_context ON monument_photo_contexts;
--rollback DROP FUNCTION IF EXISTS validate_photo_face_context();
--rollback ALTER TABLE monument_photo_contexts DROP COLUMN face_id;
