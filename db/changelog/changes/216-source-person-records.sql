--liquibase formatted sql

--changeset cemeterymapping:216-source-person-records
CREATE TABLE source_person_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE SET NULL,
  north_hills_ocr_entry_id uuid REFERENCES north_hills_ocr_entries(id) ON DELETE SET NULL,
  north_hills_ocr_source_fact_id uuid REFERENCES north_hills_ocr_source_facts(id) ON DELETE SET NULL,
  source_name varchar(250) NOT NULL DEFAULT 'North Hills Genealogists Trinity OCR',
  source_code varchar(20) NOT NULL DEFAULT 'OTHER',
  source_label varchar(150),
  source_page_number integer,
  source_location_text varchar(250),
  record_type varchar(50) NOT NULL DEFAULT 'death_record',
  status varchar(50) NOT NULL DEFAULT 'unmatched',
  confidence varchar(50) NOT NULL DEFAULT 'review',
  first_name varchar(150),
  middle_name varchar(150),
  last_name varchar(150),
  maiden_name varchar(150),
  full_name varchar(500) NOT NULL,
  birth_date date,
  birth_date_text varchar(100),
  death_date date,
  death_date_text varchar(100),
  burial_date date,
  burial_date_text varchar(100),
  funeral_date date,
  funeral_date_text varchar(100),
  age_text varchar(100),
  raw_text text NOT NULL,
  notes text,
  reviewed_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_by_external_subject text,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_person_records_source_code_check CHECK (source_code IN ('CR', 'CRG', 'FH', 'SK', 'NOTE', 'OTHER')),
  CONSTRAINT source_person_records_record_type_check CHECK (record_type IN ('death_record', 'burial_record', 'funeral_record', 'church_record', 'family_history', 'other')),
  CONSTRAINT source_person_records_status_check CHECK (status IN ('unmatched', 'candidate_match', 'linked', 'rejected')),
  CONSTRAINT source_person_records_confidence_check CHECK (confidence IN ('high', 'medium', 'low', 'review')),
  CONSTRAINT source_person_records_page_check CHECK (source_page_number IS NULL OR source_page_number > 0),
  CONSTRAINT source_person_records_full_name_check CHECK (btrim(full_name) <> ''),
  CONSTRAINT source_person_records_raw_text_check CHECK (btrim(raw_text) <> '')
);

CREATE TABLE source_person_record_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_person_record_id uuid NOT NULL REFERENCES source_person_records(id) ON DELETE CASCADE,
  burial_uuid uuid REFERENCES burials(id) ON DELETE CASCADE,
  gravesite_uuid uuid REFERENCES gravesites(id) ON DELETE CASCADE,
  headstone_uuid uuid REFERENCES headstones(id) ON DELETE CASCADE,
  link_type varchar(50) NOT NULL DEFAULT 'candidate',
  confidence varchar(50) NOT NULL DEFAULT 'review',
  notes text,
  reviewed_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_by_external_subject text,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT source_person_record_links_target_check CHECK (num_nonnulls(burial_uuid, gravesite_uuid, headstone_uuid) = 1),
  CONSTRAINT source_person_record_links_type_check CHECK (link_type IN ('candidate', 'matched', 'rejected')),
  CONSTRAINT source_person_record_links_confidence_check CHECK (confidence IN ('high', 'medium', 'low', 'review'))
);

CREATE INDEX source_person_records_cemetery_page_idx
  ON source_person_records (cemetery_id, source_page_number, status);

CREATE INDEX source_person_records_status_idx
  ON source_person_records (status, confidence, record_type);

CREATE INDEX source_person_records_nhg_entry_idx
  ON source_person_records (north_hills_ocr_entry_id)
  WHERE north_hills_ocr_entry_id IS NOT NULL;

CREATE INDEX source_person_records_nhg_fact_idx
  ON source_person_records (north_hills_ocr_source_fact_id)
  WHERE north_hills_ocr_source_fact_id IS NOT NULL;

CREATE INDEX source_person_records_full_name_trgm_idx
  ON source_person_records USING gin (lower(full_name) gin_trgm_ops);

CREATE INDEX source_person_record_links_record_idx
  ON source_person_record_links (source_person_record_id, link_type);

CREATE INDEX source_person_record_links_burial_idx
  ON source_person_record_links (burial_uuid)
  WHERE burial_uuid IS NOT NULL;

CREATE UNIQUE INDEX source_person_record_links_burial_unique_idx
  ON source_person_record_links (source_person_record_id, burial_uuid)
  WHERE burial_uuid IS NOT NULL;

CREATE INDEX source_person_record_links_gravesite_idx
  ON source_person_record_links (gravesite_uuid)
  WHERE gravesite_uuid IS NOT NULL;

CREATE UNIQUE INDEX source_person_record_links_gravesite_unique_idx
  ON source_person_record_links (source_person_record_id, gravesite_uuid)
  WHERE gravesite_uuid IS NOT NULL;

CREATE INDEX source_person_record_links_headstone_idx
  ON source_person_record_links (headstone_uuid)
  WHERE headstone_uuid IS NOT NULL;

CREATE UNIQUE INDEX source_person_record_links_headstone_unique_idx
  ON source_person_record_links (source_person_record_id, headstone_uuid)
  WHERE headstone_uuid IS NOT NULL;

CREATE TRIGGER touch_source_person_records_updated_at
  BEFORE UPDATE ON source_person_records
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_source_person_record_links_updated_at
  BEFORE UPDATE ON source_person_record_links
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_source_person_records_changes
  AFTER INSERT OR UPDATE OR DELETE ON source_person_records
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_source_person_record_links_changes
  AFTER INSERT OR UPDATE OR DELETE ON source_person_record_links
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_source_person_record_links_changes ON source_person_record_links;
--rollback DROP TRIGGER IF EXISTS audit_source_person_records_changes ON source_person_records;
--rollback DROP TRIGGER IF EXISTS touch_source_person_record_links_updated_at ON source_person_record_links;
--rollback DROP TRIGGER IF EXISTS touch_source_person_records_updated_at ON source_person_records;
--rollback DROP TABLE IF EXISTS source_person_record_links;
--rollback DROP TABLE IF EXISTS source_person_records;
