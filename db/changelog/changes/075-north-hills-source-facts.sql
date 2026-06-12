--liquibase formatted sql

--changeset cemeterymapping:075-north-hills-source-facts
CREATE TABLE north_hills_ocr_source_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES north_hills_ocr_entries(id) ON DELETE CASCADE,
  source_code varchar(10) NOT NULL,
  source_label varchar(100) NOT NULL,
  fact_type varchar(50) NOT NULL,
  fact_value text NOT NULL,
  fact_date date,
  raw_text text NOT NULL,
  confidence varchar(50) NOT NULL DEFAULT 'review',
  status varchar(50) NOT NULL DEFAULT 'staged',
  promoted_burial_uuid uuid REFERENCES burials(id) ON DELETE SET NULL,
  reviewed_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_by_external_subject text,
  reviewed_by_email text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT north_hills_ocr_source_facts_source_check CHECK (source_code IN ('CR', 'CRG')),
  CONSTRAINT north_hills_ocr_source_facts_type_check CHECK (fact_type IN ('death_date', 'middle_initial', 'age_at_death', 'note')),
  CONSTRAINT north_hills_ocr_source_facts_confidence_check CHECK (confidence IN ('high', 'medium', 'low', 'review')),
  CONSTRAINT north_hills_ocr_source_facts_status_check CHECK (status IN ('staged', 'reviewed', 'promoted', 'rejected')),
  CONSTRAINT north_hills_ocr_source_facts_unique UNIQUE (entry_id, source_code, fact_type, fact_value)
);

CREATE INDEX north_hills_ocr_source_facts_entry_idx ON north_hills_ocr_source_facts (entry_id, status);
CREATE INDEX north_hills_ocr_source_facts_type_idx ON north_hills_ocr_source_facts (fact_type, fact_date);
CREATE INDEX north_hills_ocr_source_facts_promoted_idx ON north_hills_ocr_source_facts (promoted_burial_uuid);

CREATE TRIGGER touch_north_hills_ocr_source_facts_updated_at
  BEFORE UPDATE ON north_hills_ocr_source_facts
  FOR EACH ROW
  EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_north_hills_ocr_source_facts_changes
  AFTER INSERT OR UPDATE OR DELETE ON north_hills_ocr_source_facts
  FOR EACH ROW
  EXECUTE FUNCTION audit_record_change('id');

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, raw_text, confidence)
SELECT
  entry.id,
  match.source_code,
  CASE match.source_code WHEN 'CRG' THEN 'Church Records in German' ELSE 'Church Records' END,
  'note',
  match.fact_value,
  match.source_code || ': ' || match.fact_value,
  'review'
FROM north_hills_ocr_entries entry
CROSS JOIN LATERAL (
  SELECT
    upper(source_match.matches[1]) AS source_code,
    btrim(regexp_replace(source_match.matches[2], '\s+', ' ', 'g')) AS fact_value
  FROM regexp_matches(entry.raw_text, '\m(CRG|CR)\s*:\s*(.*?)(?=\m(?:CRG|CR)\s*:|$)', 'gi') AS source_match(matches)
) match
WHERE match.fact_value <> ''
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

INSERT INTO north_hills_ocr_source_facts (entry_id, source_code, source_label, fact_type, fact_value, fact_date, raw_text, confidence)
SELECT
  entry.id,
  upper(source_match.matches[1]) AS source_code,
  CASE upper(source_match.matches[1]) WHEN 'CRG' THEN 'Church Records in German' ELSE 'Church Records' END AS source_label,
  'death_date',
  to_char(make_date(death_match.matches[3]::integer, month_match.month_number, death_match.matches[2]::integer), 'FMMonth FMDD, YYYY'),
  make_date(death_match.matches[3]::integer, month_match.month_number, death_match.matches[2]::integer),
  upper(source_match.matches[1]) || ': ' || btrim(regexp_replace(source_match.matches[2], '\s+', ' ', 'g')),
  'high'
FROM north_hills_ocr_entries entry
CROSS JOIN LATERAL regexp_matches(entry.raw_text, '\m(CRG|CR)\s*:\s*(.*?)(?=\m(?:CRG|CR)\s*:|$)', 'gi') AS source_match(matches)
CROSS JOIN LATERAL regexp_matches(source_match.matches[2], '\md\.?\s+([A-Za-z]{3,9})\.?\s+([0-9]{1,2})(?:st|nd|rd|th)?(?:,)?\s+((?:17|18|19|20)[0-9]{2})\M', 'i') AS death_match(matches)
CROSS JOIN LATERAL (
  SELECT CASE lower(left(death_match.matches[1], 3))
    WHEN 'jan' THEN 1
    WHEN 'feb' THEN 2
    WHEN 'mar' THEN 3
    WHEN 'apr' THEN 4
    WHEN 'may' THEN 5
    WHEN 'jun' THEN 6
    WHEN 'jul' THEN 7
    WHEN 'aug' THEN 8
    WHEN 'sep' THEN 9
    WHEN 'oct' THEN 10
    WHEN 'nov' THEN 11
    WHEN 'dec' THEN 12
  END AS month_number
) month_match
WHERE month_match.month_number IS NOT NULL
ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO NOTHING;

--rollback DROP TRIGGER IF EXISTS audit_north_hills_ocr_source_facts_changes ON north_hills_ocr_source_facts;
--rollback DROP TRIGGER IF EXISTS touch_north_hills_ocr_source_facts_updated_at ON north_hills_ocr_source_facts;
--rollback DROP TABLE IF EXISTS north_hills_ocr_source_facts;
