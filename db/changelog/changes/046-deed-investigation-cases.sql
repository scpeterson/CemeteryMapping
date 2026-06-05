--liquibase formatted sql

--changeset cemeterymapping:046-deed-investigation-cases splitStatements:false
CREATE TABLE deed_investigation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  case_number varchar(50) NOT NULL UNIQUE,
  status varchar(50) NOT NULL DEFAULT 'open',
  subject_name varchar(250) NOT NULL,
  requester_name varchar(250),
  requester_contact varchar(500),
  plot_reference varchar(250),
  request_summary varchar(4000),
  family_summary varchar(4000),
  findings varchar(4000),
  council_decision varchar(4000),
  affidavit_status varchar(50) NOT NULL DEFAULT 'not_needed',
  outcome varchar(4000),
  opened_at date NOT NULL DEFAULT CURRENT_DATE,
  closed_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deed_investigation_cases_status_check CHECK (status IN ('open', 'researching', 'awaiting_family', 'awaiting_council', 'approved', 'denied', 'closed')),
  CONSTRAINT deed_investigation_cases_affidavit_status_check CHECK (affidavit_status IN ('not_needed', 'needed', 'sent', 'received', 'waived'))
);

CREATE TABLE deed_investigation_case_entries (
  case_id uuid NOT NULL REFERENCES deed_investigation_cases(id) ON DELETE CASCADE,
  deed_registry_entry_id uuid NOT NULL REFERENCES deed_registry_entries(id) ON DELETE CASCADE,
  note varchar(1000),
  linked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, deed_registry_entry_id)
);

CREATE INDEX deed_investigation_cases_status_idx ON deed_investigation_cases (status, opened_at DESC, id DESC);
CREATE INDEX deed_investigation_cases_subject_trgm_idx ON deed_investigation_cases USING gin (lower(subject_name) gin_trgm_ops);
CREATE INDEX deed_investigation_case_entries_entry_idx ON deed_investigation_case_entries (deed_registry_entry_id);

CREATE TRIGGER touch_deed_investigation_cases_updated_at
  BEFORE UPDATE ON deed_investigation_cases
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_deed_investigation_cases_changes
  AFTER INSERT OR UPDATE OR DELETE ON deed_investigation_cases
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_deed_investigation_case_entries_changes
  AFTER INSERT OR UPDATE OR DELETE ON deed_investigation_case_entries
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('case_id');

--rollback DROP TRIGGER IF EXISTS audit_deed_investigation_case_entries_changes ON deed_investigation_case_entries;
--rollback DROP TRIGGER IF EXISTS audit_deed_investigation_cases_changes ON deed_investigation_cases;
--rollback DROP TRIGGER IF EXISTS touch_deed_investigation_cases_updated_at ON deed_investigation_cases;
--rollback DROP TABLE IF EXISTS deed_investigation_case_entries;
--rollback DROP TABLE IF EXISTS deed_investigation_cases;
