--liquibase formatted sql

--changeset cemeterymapping:416-access-requests
CREATE TABLE access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 320),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 250),
  cemetery_interest text NOT NULL CHECK (length(cemetery_interest) BETWEEN 1 AND 250),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES app_users(id),
  approved_user_id uuid REFERENCES app_users(id),
  CHECK ((status = 'pending' AND reviewed_at IS NULL AND approved_user_id IS NULL)
    OR (status = 'rejected' AND reviewed_at IS NOT NULL AND approved_user_id IS NULL)
    OR (status = 'approved' AND reviewed_at IS NOT NULL AND approved_user_id IS NOT NULL))
);
CREATE INDEX access_requests_pending ON access_requests (created_at) WHERE status = 'pending';
CREATE TRIGGER audit_access_requests_changes AFTER INSERT OR UPDATE OR DELETE ON access_requests
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TABLE access_requests;
