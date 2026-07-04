--liquibase formatted sql

--changeset cemeterymapping:209-remove-duplicate-north-hills-page-227-steele-entry splitStatements:false
WITH duplicate_entries AS (
  SELECT id
  FROM north_hills_ocr_entries
  WHERE source_page_number = 227
    AND parsed_section_name = 'D'
    AND parsed_row_number = 7
    AND parsed_position_number = 1
    AND name_text = 'STEELE/STEEL/MEHRLICH'
),
removed_observations AS (
  DELETE FROM north_hills_ocr_entry_observations observation
  USING duplicate_entries
  WHERE observation.entry_id = duplicate_entries.id
  RETURNING observation.id
),
removed_facts AS (
  DELETE FROM north_hills_ocr_source_facts fact
  USING duplicate_entries
  WHERE fact.entry_id = duplicate_entries.id
  RETURNING fact.id
),
removed_entries AS (
  DELETE FROM north_hills_ocr_entries entry
  USING duplicate_entries
  WHERE entry.id = duplicate_entries.id
  RETURNING entry.id
)
SELECT
  (SELECT count(*) FROM removed_observations) AS removed_observations,
  (SELECT count(*) FROM removed_facts) AS removed_facts,
  (SELECT count(*) FROM removed_entries) AS removed_entries;

--rollback SELECT 1;
