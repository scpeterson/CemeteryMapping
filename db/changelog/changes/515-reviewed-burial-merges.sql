--liquibase formatted sql

--changeset cemeterymapping:515-reviewed-burial-merges splitStatements:false
CREATE TABLE burial_record_merges (
 source_id uuid PRIMARY KEY,
 target_id uuid NOT NULL,
 cemetery_id uuid NOT NULL REFERENCES cemeteries(id),
 preview_hash char(64) NOT NULL,
 source_snapshot jsonb NOT NULL,
 target_snapshot jsonb NOT NULL,
 relationship_snapshot jsonb NOT NULL,
 reason varchar(500) NOT NULL,
 actor_subject varchar(300) NOT NULL,
 actor_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(source_id<>target_id)
);
CREATE INDEX burial_record_merges_cemetery_idx ON burial_record_merges(cemetery_id,created_at DESC);
-- An archived donor must not gain new active marker links after a merge races
-- a connected editor. Historical/deleted links remain available as evidence.
CREATE FUNCTION guard_active_burial_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE person_id uuid;
BEGIN
 person_id := (to_jsonb(NEW)->>TG_ARGV[0])::uuid;
 IF person_id IS NOT NULL AND (to_jsonb(NEW)->>'deleted_at') IS NULL THEN
  PERFORM 1 FROM burials WHERE id=person_id AND deleted_at IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Referenced person was merged or deleted. Reload the current record before linking evidence.' USING ERRCODE='23514',CONSTRAINT='active_burial_reference'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_active_burial_reference BEFORE INSERT OR UPDATE OF burial_uuid,deleted_at ON headstone_burials FOR EACH ROW EXECUTE FUNCTION guard_active_burial_reference('burial_uuid');
CREATE TRIGGER guard_active_burial_reference BEFORE INSERT OR UPDATE OF burial_uuid ON burial_military_decorations FOR EACH ROW EXECUTE FUNCTION guard_active_burial_reference('burial_uuid');
CREATE TRIGGER guard_active_burial_reference BEFORE INSERT OR UPDATE OF burial_uuid,deleted_at ON memorials FOR EACH ROW EXECUTE FUNCTION guard_active_burial_reference('burial_uuid');
CREATE TRIGGER guard_active_burial_reference BEFORE INSERT OR UPDATE OF promoted_burial_uuid ON north_hills_ocr_source_facts FOR EACH ROW EXECUTE FUNCTION guard_active_burial_reference('promoted_burial_uuid');
CREATE TRIGGER guard_active_burial_reference BEFORE INSERT OR UPDATE OF burial_uuid,deleted_at ON source_person_record_links FOR EACH ROW EXECUTE FUNCTION guard_active_burial_reference('burial_uuid');
CREATE TRIGGER guard_active_burial_reference BEFORE INSERT OR UPDATE OF burial_uuid,deleted_at ON burial_place_evidence FOR EACH ROW EXECUTE FUNCTION guard_active_burial_reference('burial_uuid');
--rollback DROP TRIGGER guard_active_burial_reference ON headstone_burials;
--rollback DROP TRIGGER guard_active_burial_reference ON burial_military_decorations;
--rollback DROP TRIGGER guard_active_burial_reference ON memorials;
--rollback DROP TRIGGER guard_active_burial_reference ON north_hills_ocr_source_facts;
--rollback DROP TRIGGER guard_active_burial_reference ON source_person_record_links;
--rollback DROP TRIGGER guard_active_burial_reference ON burial_place_evidence;
--rollback DROP FUNCTION guard_active_burial_reference();
--rollback DROP TABLE burial_record_merges;
