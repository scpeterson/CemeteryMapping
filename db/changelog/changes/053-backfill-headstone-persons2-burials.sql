--liquibase formatted sql

--changeset cemeterymapping:053-backfill-headstone-persons2-burials splitStatements:false
WITH source_person2 AS (
  SELECT
    headstones.id AS headstone_uuid,
    headstones.gravesite_uuid,
    gravesites.gravesite_id,
    NULLIF(headstones.source_properties ->> 'Persons2First', '') AS first_name,
    NULLIF(headstones.source_properties ->> 'Persons2Last', '') AS last_name,
    CASE
      WHEN NULLIF(headstones.source_properties ->> 'Person2Yob', '') ~ '^[0-9]{4}$'
        AND (headstones.source_properties ->> 'Person2Yob')::integer BETWEEN 1000 AND 9999
      THEN make_date((headstones.source_properties ->> 'Person2Yob')::integer, 1, 1)
      ELSE NULL
    END AS birth_date,
    CASE
      WHEN NULLIF(headstones.source_properties ->> 'Person2Yod', '') ~ '^[0-9]{4}$'
        AND (headstones.source_properties ->> 'Person2Yod')::integer BETWEEN 1000 AND 9999
      THEN make_date((headstones.source_properties ->> 'Person2Yod')::integer, 1, 1)
      ELSE NULL
    END AS death_date,
    concat_ws(
      ' ',
      'Imported from headstone spreadsheet row ' || ltrim(replace(headstones.headstone_id, 'TLC-HS-', ''), '0') || '.',
      CASE
        WHEN NULLIF(headstones.source_properties ->> 'NhgSection', '') IS NOT NULL
        THEN 'North Hills Genealogists section: ' || (headstones.source_properties ->> 'NhgSection') || '.'
        ELSE NULL
      END,
      CASE
        WHEN NULLIF(headstones.source_properties ->> 'NhgRow', '') IS NOT NULL
        THEN 'North Hills Genealogists row: ' || (headstones.source_properties ->> 'NhgRow') || '.'
        ELSE NULL
      END,
      CASE
        WHEN NULLIF(headstones.source_properties ->> 'NhgPage', '') IS NOT NULL
        THEN 'North Hills Genealogists page: ' || (headstones.source_properties ->> 'NhgPage') || '.'
        ELSE NULL
      END,
      CASE
        WHEN NULLIF(headstones.source_properties ->> 'TlcSec', '') IS NOT NULL
        THEN 'Trinity Lutheran Church section: ' || (headstones.source_properties ->> 'TlcSec') || '.'
        ELSE NULL
      END,
      CASE
        WHEN NULLIF(headstones.source_properties ->> 'TlcPlot', '') IS NOT NULL
        THEN 'Trinity Lutheran Church plot: ' || (headstones.source_properties ->> 'TlcPlot') || '.'
        ELSE NULL
      END,
      CASE
        WHEN NULLIF(headstones.source_properties ->> 'GraveNumber', '') IS NOT NULL
        THEN 'Source grave number: ' || (headstones.source_properties ->> 'GraveNumber') || '.'
        ELSE NULL
      END,
      'Person column: 2.'
    ) AS notes
  FROM headstones
  JOIN gravesites
    ON gravesites.id = headstones.gravesite_uuid
   AND gravesites.deleted_at IS NULL
  WHERE headstones.deleted_at IS NULL
    AND (
      NULLIF(headstones.source_properties ->> 'Persons2First', '') IS NOT NULL
      OR NULLIF(headstones.source_properties ->> 'Persons2Last', '') IS NOT NULL
    )
),
updated_blank_burials AS (
  UPDATE burials
  SET
    first_name = source_person2.first_name,
    last_name = source_person2.last_name,
    full_name = NULLIF(concat_ws(' ', source_person2.first_name, source_person2.last_name), ''),
    updated_at = now()
  FROM source_person2
  JOIN headstone_burials
    ON headstone_burials.headstone_uuid = source_person2.headstone_uuid
   AND headstone_burials.deleted_at IS NULL
  WHERE burials.id = headstone_burials.burial_uuid
    AND burials.deleted_at IS NULL
    AND burials.notes LIKE '%Person column: 2.%'
    AND NULLIF(COALESCE(burials.full_name, ''), '') IS NULL
  RETURNING burials.id
),
inserted_missing_burials AS (
  INSERT INTO burials (
    gravesite_uuid,
    first_name,
    last_name,
    full_name,
    birth_date,
    death_date,
    notes,
    gravesite_id,
    updated_at
  )
  SELECT
    source_person2.gravesite_uuid,
    source_person2.first_name,
    source_person2.last_name,
    NULLIF(concat_ws(' ', source_person2.first_name, source_person2.last_name), ''),
    source_person2.birth_date,
    source_person2.death_date,
    source_person2.notes,
    source_person2.gravesite_id,
    now()
  FROM source_person2
  WHERE NOT EXISTS (
    SELECT 1
    FROM headstone_burials
    JOIN burials
      ON burials.id = headstone_burials.burial_uuid
     AND burials.deleted_at IS NULL
    WHERE headstone_burials.headstone_uuid = source_person2.headstone_uuid
      AND headstone_burials.deleted_at IS NULL
      AND burials.notes LIKE '%Person column: 2.%'
  )
  RETURNING id, notes
)
INSERT INTO headstone_burials (
  headstone_uuid,
  burial_uuid
)
SELECT
  source_person2.headstone_uuid,
  inserted_missing_burials.id
FROM source_person2
JOIN inserted_missing_burials
  ON inserted_missing_burials.notes = source_person2.notes
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback empty
