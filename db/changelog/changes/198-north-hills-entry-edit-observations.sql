--liquibase formatted sql

--changeset cemeterymapping:198-north-hills-entry-edit-observations
CREATE TABLE north_hills_ocr_entry_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES north_hills_ocr_entries(id) ON DELETE CASCADE,
  observation_type varchar(50) NOT NULL,
  observation_text text NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'staged',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT north_hills_ocr_entry_observations_type_check CHECK (observation_type IN ('plot_marker', 'gap', 'marker_observation', 'entry_note')),
  CONSTRAINT north_hills_ocr_entry_observations_status_check CHECK (status IN ('staged', 'reviewed', 'rejected')),
  CONSTRAINT north_hills_ocr_entry_observations_text_check CHECK (length(btrim(observation_text)) > 0),
  CONSTRAINT north_hills_ocr_entry_observations_unique UNIQUE (entry_id, observation_type, observation_text)
);

CREATE INDEX north_hills_ocr_entry_observations_entry_idx ON north_hills_ocr_entry_observations (entry_id, status);
CREATE INDEX north_hills_ocr_entry_observations_type_idx ON north_hills_ocr_entry_observations (observation_type, status);

CREATE TRIGGER touch_north_hills_ocr_entry_observations_updated_at
  BEFORE UPDATE ON north_hills_ocr_entry_observations
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_north_hills_ocr_entry_observations_changes
  AFTER INSERT OR UPDATE OR DELETE ON north_hills_ocr_entry_observations
  FOR EACH ROW
  EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_north_hills_ocr_entry_observations_changes ON north_hills_ocr_entry_observations;
--rollback DROP TRIGGER IF EXISTS touch_north_hills_ocr_entry_observations_updated_at ON north_hills_ocr_entry_observations;
--rollback DROP TABLE IF EXISTS north_hills_ocr_entry_observations;
