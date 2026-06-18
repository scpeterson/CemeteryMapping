--liquibase formatted sql

--changeset cemeterymapping:109-link-remaining-trinity-section-e-shapefile-markers splitStatements:false
WITH source_markers (
  headstone_id,
  gravesite_id,
  shapefile_feature_index,
  nhg_section,
  nhg_row,
  nhg_site_id,
  first_name,
  last_name,
  birth_date,
  birth_date_text,
  death_date,
  death_date_text
) AS (
  VALUES
    ('TLC-HS-0574', 'TLC-GPS-0574', 297, 'E', '6', '7', 'Heinrich', 'Brant', NULL, 'February 29, 1773', DATE '1849-02-14', 'February 14, 1849'),
    ('TLC-HS-0575', 'TLC-GPS-0575', 299, 'E', '6', '9', 'Conrad', 'Brand', DATE '1862-02-25', 'February 25, 1862', DATE '1862-05-31', 'May 31, 1862')
),
marker_gravesites AS (
  SELECT
    headstones.id AS headstone_uuid,
    headstones.headstone_id,
    gravesites.id AS gravesite_uuid,
    gravesites.gravesite_id,
    source_markers.shapefile_feature_index,
    source_markers.nhg_section,
    source_markers.nhg_row,
    source_markers.nhg_site_id,
    source_markers.first_name,
    source_markers.last_name,
    source_markers.birth_date,
    source_markers.birth_date_text,
    source_markers.death_date,
    source_markers.death_date_text
  FROM source_markers
  JOIN headstones
    ON headstones.headstone_id = source_markers.headstone_id
   AND headstones.deleted_at IS NULL
  JOIN gravesites
    ON gravesites.gravesite_id = source_markers.gravesite_id
   AND gravesites.deleted_at IS NULL
),
updated_headstones AS (
  UPDATE headstones
  SET
    gravesite_uuid = marker_gravesites.gravesite_uuid,
    updated_at = now()
  FROM marker_gravesites
  WHERE headstones.id = marker_gravesites.headstone_uuid
  RETURNING headstones.id AS headstone_uuid, marker_gravesites.gravesite_uuid, marker_gravesites.gravesite_id
),
linked_headstones AS (
  INSERT INTO headstone_gravesites (
    headstone_uuid,
    gravesite_uuid,
    relationship_type,
    notes,
    updated_at
  )
  SELECT
    marker_gravesites.headstone_uuid,
    marker_gravesites.gravesite_uuid,
    'primary',
    'Generated from recovered TrinityCemeteryFinal3.shp marker geometry.',
    now()
  FROM marker_gravesites
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    notes = EXCLUDED.notes,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING headstone_uuid, gravesite_uuid
),
inserted_burials AS (
  INSERT INTO burials (
    gravesite_uuid,
    first_name,
    last_name,
    full_name,
    birth_date,
    birth_date_text,
    death_date,
    death_date_text,
    gravesite_id,
    interment_type_id,
    notes,
    updated_at
  )
  SELECT
    marker_gravesites.gravesite_uuid,
    marker_gravesites.first_name,
    marker_gravesites.last_name,
    NULLIF(concat_ws(' ', marker_gravesites.first_name, marker_gravesites.last_name), ''),
    marker_gravesites.birth_date,
    marker_gravesites.birth_date_text,
    marker_gravesites.death_date,
    marker_gravesites.death_date_text,
    marker_gravesites.gravesite_id,
    burial_interment_types.id,
    concat(
      'Imported from TrinityCemeteryFinal3.shp feature ',
      marker_gravesites.shapefile_feature_index,
      '. North Hills Genealogists section: ',
      COALESCE(marker_gravesites.nhg_section, 'not recorded'),
      '. North Hills Genealogists row: ',
      COALESCE(marker_gravesites.nhg_row, 'not recorded'),
      '. North Hills Genealogists site: ',
      COALESCE(marker_gravesites.nhg_site_id, 'not recorded'),
      '. Person column: 1.'
    ),
    now()
  FROM marker_gravesites
  JOIN burial_interment_types
    ON burial_interment_types.code = 'casket'
  WHERE NOT EXISTS (
    SELECT 1
    FROM headstone_burials
    JOIN burials existing_burials
      ON existing_burials.id = headstone_burials.burial_uuid
     AND existing_burials.deleted_at IS NULL
    WHERE headstone_burials.headstone_uuid = marker_gravesites.headstone_uuid
      AND headstone_burials.deleted_at IS NULL
  )
  RETURNING id, notes
)
INSERT INTO headstone_burials (
  headstone_uuid,
  burial_uuid,
  deleted_at,
  deleted_by,
  delete_reason
)
SELECT
  marker_gravesites.headstone_uuid,
  inserted_burials.id,
  NULL,
  NULL,
  NULL
FROM inserted_burials
JOIN marker_gravesites
  ON inserted_burials.notes LIKE concat(
    'Imported from TrinityCemeteryFinal3.shp feature ',
    marker_gravesites.shapefile_feature_index,
    '.%'
  )
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback DELETE FROM burials WHERE id IN (SELECT headstone_burials.burial_uuid FROM headstone_burials JOIN headstones ON headstones.id = headstone_burials.headstone_uuid WHERE headstones.headstone_id IN ('TLC-HS-0574', 'TLC-HS-0575'));
--rollback DELETE FROM headstone_gravesites WHERE headstone_uuid IN (SELECT id FROM headstones WHERE headstone_id IN ('TLC-HS-0574', 'TLC-HS-0575'));
--rollback UPDATE headstones SET gravesite_uuid = NULL, updated_at = now() WHERE headstone_id IN ('TLC-HS-0574', 'TLC-HS-0575');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('burials', 'headstone_burials', 'headstone_gravesites');
