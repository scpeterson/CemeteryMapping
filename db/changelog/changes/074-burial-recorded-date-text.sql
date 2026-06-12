--liquibase formatted sql

--changeset cemeterymapping:074-burial-recorded-date-text
ALTER TABLE burials
  ADD COLUMN birth_date_text varchar(50),
  ADD COLUMN death_date_text varchar(50);

UPDATE burials
SET
  birth_date_text = birth_date::text,
  death_date_text = death_date::text
WHERE birth_date IS NOT NULL
   OR death_date IS NOT NULL;

WITH linked_source AS (
  SELECT
    burials.id AS burial_uuid,
    (regexp_match(burials.notes, 'Person column: ([0-9]+)\.'))[1]::integer AS person_number,
    headstones.source_properties
  FROM burials
  JOIN headstone_burials
    ON headstone_burials.burial_uuid = burials.id
   AND headstone_burials.deleted_at IS NULL
  JOIN headstones
    ON headstones.id = headstone_burials.headstone_uuid
   AND headstones.deleted_at IS NULL
  WHERE burials.deleted_at IS NULL
    AND burials.notes ~ 'Person column: [0-9]+\.'
),
source_dates AS (
  SELECT
    burial_uuid,
    CASE
      WHEN person_number = 1 THEN NULLIF(source_properties ->> 'Person1Yob', '')
      WHEN person_number = 2 THEN COALESCE(
        NULLIF(source_properties ->> 'Person2Yob', ''),
        NULLIF(source_properties ->> 'Persons2Yob', ''),
        NULLIF(source_properties ->> 'Persons26Yob', '')
      )
      ELSE NULLIF(source_properties ->> ('Person' || person_number || 'Yob'), '')
    END AS source_birth_text,
    CASE
      WHEN person_number = 1 THEN NULLIF(source_properties ->> 'Person1Yod', '')
      WHEN person_number = 2 THEN COALESCE(
        NULLIF(source_properties ->> 'Person2Yod', ''),
        NULLIF(source_properties ->> 'Persons2Yod', ''),
        NULLIF(source_properties ->> 'Persons26Yod', '')
      )
      ELSE NULLIF(source_properties ->> ('Person' || person_number || 'Yod'), '')
    END AS source_death_text
  FROM linked_source
  WHERE person_number IS NOT NULL
),
normalized_source_dates AS (
  SELECT
    burial_uuid,
    CASE
      WHEN source_birth_text ~ '^[0-9]{4}$'
        AND source_birth_text::integer BETWEEN 1000 AND 9999
      THEN source_birth_text
    END AS source_birth_year,
    CASE
      WHEN source_death_text ~ '^[0-9]{4}$'
        AND source_death_text::integer BETWEEN 1000 AND 9999
      THEN source_death_text
    END AS source_death_year
  FROM source_dates
)
UPDATE burials
SET
  birth_date_text = COALESCE(normalized_source_dates.source_birth_year, burials.birth_date_text),
  birth_date = CASE
    WHEN normalized_source_dates.source_birth_year IS NOT NULL
      AND burials.birth_date = make_date(normalized_source_dates.source_birth_year::integer, 1, 1)
    THEN NULL
    ELSE burials.birth_date
  END,
  death_date_text = COALESCE(normalized_source_dates.source_death_year, burials.death_date_text),
  death_date = CASE
    WHEN normalized_source_dates.source_death_year IS NOT NULL
      AND burials.death_date = make_date(normalized_source_dates.source_death_year::integer, 1, 1)
    THEN NULL
    ELSE burials.death_date
  END
FROM normalized_source_dates
WHERE normalized_source_dates.burial_uuid = burials.id;

--rollback ALTER TABLE burials DROP COLUMN IF EXISTS death_date_text;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS birth_date_text;
