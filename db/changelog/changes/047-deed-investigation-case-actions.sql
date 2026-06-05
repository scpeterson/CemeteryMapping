--liquibase formatted sql

--changeset cemeterymapping:047-deed-investigation-case-actions splitStatements:false
CREATE TABLE deed_investigation_case_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES deed_investigation_cases(id) ON DELETE CASCADE,
  subject_name varchar(250) NOT NULL,
  action_type varchar(50) NOT NULL,
  plot_reference varchar(250),
  council_status varchar(50) NOT NULL DEFAULT 'not_submitted',
  affidavit_status varchar(50) NOT NULL DEFAULT 'not_needed',
  deed_status varchar(50) NOT NULL DEFAULT 'not_started',
  outcome varchar(4000),
  notes varchar(4000),
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deed_investigation_case_actions_action_type_check CHECK (
    action_type IN ('issue_deed', 'replacement_deed', 'inter_ashes', 'approve_marker', 'deny_request', 'document_only', 'other')
  ),
  CONSTRAINT deed_investigation_case_actions_council_status_check CHECK (
    council_status IN ('not_submitted', 'recommended', 'submitted', 'approved', 'denied', 'not_required')
  ),
  CONSTRAINT deed_investigation_case_actions_affidavit_status_check CHECK (
    affidavit_status IN ('not_needed', 'needed', 'sent', 'received', 'waived')
  ),
  CONSTRAINT deed_investigation_case_actions_deed_status_check CHECK (
    deed_status IN ('not_started', 'pending', 'issued', 'not_issued', 'not_applicable')
  )
);

CREATE INDEX deed_investigation_case_actions_case_idx
  ON deed_investigation_case_actions (case_id, sort_order, created_at, id);

CREATE TRIGGER touch_deed_investigation_case_actions_updated_at
  BEFORE UPDATE ON deed_investigation_case_actions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_deed_investigation_case_actions_changes
  AFTER INSERT OR UPDATE OR DELETE ON deed_investigation_case_actions
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_deed_investigation_case_actions_changes ON deed_investigation_case_actions;
--rollback DROP TRIGGER IF EXISTS touch_deed_investigation_case_actions_updated_at ON deed_investigation_case_actions;
--rollback DROP TABLE IF EXISTS deed_investigation_case_actions;
