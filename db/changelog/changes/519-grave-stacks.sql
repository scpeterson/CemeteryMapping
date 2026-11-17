--liquibase formatted sql

--changeset cemeterymapping:519-grave-stacks splitStatements:false
ALTER TABLE cemeteries ADD COLUMN stacking_authorization_cutoff date,
  ADD COLUMN stacking_policy_notes text;
CREATE TABLE grave_stack_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id),
  name varchar(100) NOT NULL CHECK (name = btrim(name) AND name <> ''),
  UNIQUE(cemetery_id, name), UNIQUE(id, cemetery_id)
);
CREATE TRIGGER audit_grave_stack_groups AFTER INSERT OR UPDATE OR DELETE ON grave_stack_groups
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');
ALTER TABLE gravesites ADD COLUMN stack_group_uuid uuid,
  ADD COLUMN stack_level integer,
  ADD COLUMN stacking_authorized_on date,
  ADD COLUMN stacking_authorization_reference varchar(1000),
  ADD CONSTRAINT gravesites_stack_cemetery_fk FOREIGN KEY(stack_group_uuid, cemetery_id)
    REFERENCES grave_stack_groups(id, cemetery_id),
  ADD CONSTRAINT gravesites_stack_shape CHECK (
    (stack_group_uuid IS NULL AND stack_level IS NULL AND stacking_authorized_on IS NULL AND stacking_authorization_reference IS NULL)
    OR (stack_group_uuid IS NOT NULL AND cemetery_id IS NOT NULL AND stack_level >= 1 AND stack_level IS NOT NULL
      AND (stack_level = 1 OR (stacking_authorized_on IS NOT NULL AND NULLIF(btrim(stacking_authorization_reference), '') IS NOT NULL)))
  );
CREATE UNIQUE INDEX gravesites_stack_level_unique ON gravesites(stack_group_uuid, stack_level) WHERE deleted_at IS NULL;

CREATE FUNCTION enforce_stacking_authorization() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cutoff date;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.stack_group_uuid IS NULL OR NEW.stack_level = 1 THEN RETURN NEW; END IF;
  -- Rechecking an unchanged authorization would make later burial/status edits
  -- impossible after a policy change. New/reassigned authorizations are checked.
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL
    AND ROW(NEW.cemetery_id,NEW.stack_group_uuid,NEW.stack_level,NEW.stacking_authorized_on,NEW.stacking_authorization_reference)
      IS NOT DISTINCT FROM ROW(OLD.cemetery_id,OLD.stack_group_uuid,OLD.stack_level,OLD.stacking_authorized_on,OLD.stacking_authorization_reference)
    THEN RETURN NEW; END IF;
  SELECT stacking_authorization_cutoff INTO cutoff FROM cemeteries WHERE id=NEW.cemetery_id FOR SHARE;
  IF cutoff IS NOT NULL AND NEW.stacking_authorized_on >= cutoff THEN
    RAISE EXCEPTION 'New stacking authorizations must predate %; existing earlier reservations remain valid.', cutoff USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_stacking_authorization BEFORE INSERT OR UPDATE ON gravesites
  FOR EACH ROW EXECUTE FUNCTION enforce_stacking_authorization();
-- No geometric inference or automatic level assignments. Match Trinity by name,
-- never a facility ID shared by unrelated imported datasets.
UPDATE cemeteries SET stacking_authorization_cutoff='2027-03-01',
 stacking_policy_notes='No new stacking reservations or authorizations on or after March 1, 2027. Honor earlier authorized upper-grave reservations regardless of later interment date.'
 WHERE name = 'Trinity Lutheran Church Cemetery' AND deleted_at IS NULL;

--rollback DROP TRIGGER enforce_stacking_authorization ON gravesites;
--rollback DROP FUNCTION enforce_stacking_authorization();
--rollback ALTER TABLE gravesites DROP COLUMN stack_group_uuid, DROP COLUMN stack_level, DROP COLUMN stacking_authorized_on, DROP COLUMN stacking_authorization_reference;
--rollback DROP TABLE grave_stack_groups;
--rollback ALTER TABLE cemeteries DROP COLUMN stacking_authorization_cutoff, DROP COLUMN stacking_policy_notes;
