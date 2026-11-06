--liquibase formatted sql

--changeset cemeterymapping:516-maintenance-task-scheduling splitStatements:false
ALTER TABLE maintenance_records
 ADD COLUMN assigned_to_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
 ADD COLUMN due_date date,
 ADD COLUMN remind_on date,
 ADD COLUMN reminder_dismissed_at timestamptz,
 ADD CONSTRAINT maintenance_reminder_date CHECK(remind_on IS NULL OR(due_date IS NOT NULL AND remind_on<=due_date));
CREATE INDEX maintenance_personal_queue_idx ON maintenance_records(assigned_to_app_user_id,due_date,id) WHERE deleted_at IS NULL AND status NOT IN ('completed','not_needed');
CREATE INDEX maintenance_cemetery_queue_idx ON maintenance_records(cemetery_id,due_date,id) WHERE deleted_at IS NULL AND status NOT IN ('completed','not_needed');
CREATE FUNCTION reset_maintenance_reminder() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.assigned_to_app_user_id,NEW.due_date,NEW.remind_on) IS DISTINCT FROM(OLD.assigned_to_app_user_id,OLD.due_date,OLD.remind_on)
 OR(OLD.status IN('completed','not_needed') AND NEW.status NOT IN('completed','not_needed')) THEN
  NEW.reminder_dismissed_at:=NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reset_maintenance_reminder BEFORE UPDATE OF assigned_to_app_user_id,due_date,remind_on,status ON maintenance_records FOR EACH ROW EXECUTE FUNCTION reset_maintenance_reminder();
--rollback DROP TRIGGER reset_maintenance_reminder ON maintenance_records;
--rollback DROP FUNCTION reset_maintenance_reminder();
--rollback DROP INDEX maintenance_personal_queue_idx;
--rollback DROP INDEX maintenance_cemetery_queue_idx;
--rollback ALTER TABLE maintenance_records DROP CONSTRAINT maintenance_reminder_date, DROP COLUMN reminder_dismissed_at, DROP COLUMN remind_on, DROP COLUMN due_date, DROP COLUMN assigned_to_app_user_id;
