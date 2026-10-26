--liquibase formatted sql

--changeset cemeterymapping:494-delete-monument-inspections splitStatements:false
--validCheckSum 9:d23e64dddeaa1faba3b5081cc513d5d5
ALTER TABLE monument_inspections ADD COLUMN deleted_at timestamptz;
-- Deleted source-derived inspections stay manually edited so source refreshes
-- cannot recreate them. Existing audit triggers retain the actor and old values.
CREATE FUNCTION reject_deleted_inspection_photo_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.deleted_at IS NULL AND NEW.inspection_id IS NOT NULL THEN
  PERFORM 1 FROM monument_inspections WHERE id=NEW.inspection_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inspection is deleted'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reject_deleted_inspection_photo_context BEFORE INSERT OR UPDATE ON monument_photo_contexts
 FOR EACH ROW EXECUTE FUNCTION reject_deleted_inspection_photo_context();
-- Schema rollback removes deletion history. Back up before rollback; use a forward correction for operational recovery.
--rollback DROP TRIGGER IF EXISTS reject_deleted_inspection_photo_context ON monument_photo_contexts;
--rollback DROP FUNCTION IF EXISTS reject_deleted_inspection_photo_context();
--rollback ALTER TABLE monument_inspections DROP COLUMN deleted_at;
