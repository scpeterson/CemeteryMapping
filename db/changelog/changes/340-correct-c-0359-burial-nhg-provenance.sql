--liquibase formatted sql

--changeset cemeterymapping:340-correct-c-0359-burial-nhg-provenance splitStatements:false
SELECT assert_migration_prerequisite(
  (
    SELECT count(*)
    FROM burials
    WHERE lower(COALESCE(full_name, '')) IN (
      'eleanor brant',
      'elmer h brant',
      'bette c brandt',
      'bette c brant'
    )
      AND deleted_at IS NULL
  ) = 3,
  'exactly one active Eleanor Brant, Elmer H Brant, and Bette C Brandt/Brant burial must exist'
);

WITH target_burials AS (
  SELECT
    id,
    lower(COALESCE(full_name, '')) AS normalized_full_name
  FROM burials
  WHERE lower(COALESCE(full_name, '')) IN (
    'eleanor brant',
    'elmer h brant',
    'bette c brandt',
    'bette c brant'
  )
    AND deleted_at IS NULL
),
updated_burials AS (
  UPDATE burials
  SET
    first_name = CASE
      WHEN target_burials.normalized_full_name IN ('bette c brandt', 'bette c brant') THEN 'Bette C'
      ELSE burials.first_name
    END,
    last_name = CASE
      WHEN target_burials.normalized_full_name IN ('bette c brandt', 'bette c brant') THEN 'Brant'
      ELSE burials.last_name
    END,
    full_name = CASE
      WHEN target_burials.normalized_full_name IN ('bette c brandt', 'bette c brant') THEN 'Bette C Brant'
      ELSE burials.full_name
    END,
    source_properties = COALESCE(burials.source_properties, '{}'::jsonb)
      || jsonb_build_object(
        'NormalizedProvenance',
        COALESCE(burials.source_properties->'NormalizedProvenance', '{}'::jsonb)
          || jsonb_build_object(
            'nhgInclusion',
            CASE
              WHEN target_burials.normalized_full_name IN ('bette c brandt', 'bette c brant')
                THEN 'not_listed'
              ELSE 'listed'
            END,
            'verificationSourceType', 'manual',
            'verifiedAt', '2026-08-26'
          )
      ),
    notes = CASE
      WHEN target_burials.normalized_full_name IN ('bette c brandt', 'bette c brant') THEN concat_ws(
        ' ',
        NULLIF(burials.notes, ''),
        CASE
          WHEN COALESCE(burials.notes, '') ILIKE '%Not listed in the North Hills Genealogists book.%' THEN NULL
          ELSE 'Not listed in the North Hills Genealogists book.'
        END
      )
      ELSE burials.notes
    END,
    review_status = 'reviewed',
    review_notes = concat_ws(
      ' ',
      NULLIF(burials.review_notes, ''),
      CASE
        WHEN target_burials.normalized_full_name IN ('bette c brandt', 'bette c brant')
          THEN 'Bette C Brant was field-confirmed at TLC-HS-0359 but is not listed in the NHG book; surname corrected from Brandt to Brant.'
        ELSE 'NHG listing confirmed for the TLC-HS-0359 burial.'
      END
    ),
    source_conflict = false,
    reviewed_by = 'migration 340 corrected C-0359 burial NHG provenance',
    reviewed_at = now(),
    updated_at = now()
  FROM target_burials
  WHERE burials.id = target_burials.id
  RETURNING burials.id
)
UPDATE gravesites
SET
  name = 'Bette C Brant',
  geometry_notes = replace(
    COALESCE(geometry_notes, ''),
    'Bette C Brandt',
    'Bette C Brant'
  ),
  updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0359-02'
  AND deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM updated_burials);

--rollback empty
