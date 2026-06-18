--liquibase formatted sql

--changeset cemeterymapping:105-create-gravesites-for-missing-shapefile-markers splitStatements:false
WITH source_markers AS (
  SELECT
    headstones.id AS headstone_uuid,
    headstones.headstone_id,
    replace(headstones.headstone_id, 'TLC-HS-', '') AS grave_id,
    replace(headstones.headstone_id, 'TLC-HS-', 'TLC-GPS-') AS gravesite_id,
    headstones.latitude::double precision AS latitude,
    headstones.longitude::double precision AS longitude,
    headstones.geometry AS marker_geometry,
    headstones.source_properties ->> 'NhgSection' AS source_section_id,
    COALESCE(
      NULLIF(concat_ws(
        ' ',
        headstones.source_properties ->> 'Person1First',
        headstones.source_properties ->> 'Person1Last'
      ), ''),
      headstones.headstone_id
    ) AS gravesite_name
  FROM headstones
  WHERE headstones.deleted_at IS NULL
    AND headstones.headstone_id IN (
      'TLC-HS-0559', 'TLC-HS-0560', 'TLC-HS-0561', 'TLC-HS-0562', 'TLC-HS-0563',
      'TLC-HS-0564', 'TLC-HS-0565', 'TLC-HS-0566', 'TLC-HS-0567', 'TLC-HS-0568',
      'TLC-HS-0569', 'TLC-HS-0570', 'TLC-HS-0571', 'TLC-HS-0572', 'TLC-HS-0573'
    )
),
generated_geometries AS (
  SELECT
    source_markers.*,
    source_markers.longitude AS west_longitude,
    source_markers.longitude + ((10.0 * 0.3048) / (111320.0 * cos(radians(source_markers.latitude)))) AS east_longitude,
    source_markers.latitude - ((4.0 * 0.3048) / 2.0 / 111320.0) AS south_latitude,
    source_markers.latitude + ((4.0 * 0.3048) / 2.0 / 111320.0) AS north_latitude
  FROM source_markers
),
candidate_gravesites AS (
  SELECT
    generated_geometries.*,
    cemeteries.id AS cemetery_id,
    cemeteries.facility_id,
    sections.section_id AS section_uuid,
    COALESCE(sections.name, generated_geometries.source_section_id) AS section_id,
    ST_Multi(
      ST_MakeEnvelope(
        generated_geometries.west_longitude,
        generated_geometries.south_latitude,
        generated_geometries.east_longitude,
        generated_geometries.north_latitude,
        4326
      )
    )::geometry(MultiPolygon, 4326) AS geometry
  FROM generated_geometries
  JOIN LATERAL (
    SELECT cemeteries.id, cemeteries.facility_id
    FROM cemeteries
    WHERE cemeteries.deleted_at IS NULL
      AND ST_Covers(cemeteries.geometry, generated_geometries.marker_geometry)
    ORDER BY cemeteries.name, cemeteries.id
    LIMIT 1
  ) cemeteries ON true
  LEFT JOIN LATERAL (
    SELECT sections.section_id, sections.name
    FROM sections
    WHERE sections.deleted_at IS NULL
      AND sections.cemetery_id = cemeteries.id
      AND ST_Covers(sections.geometry, generated_geometries.marker_geometry)
    ORDER BY
      CASE WHEN sections.name = generated_geometries.source_section_id THEN 0 ELSE 1 END,
      sections.name,
      sections.section_id
    LIMIT 1
  ) sections ON true
),
inserted_gravesites AS (
  INSERT INTO gravesites (
    cemetery_id,
    section_uuid,
    name,
    facility_id,
    section_id,
    grave_id,
    gravesite_id,
    width_feet,
    length_feet,
    status_type_id,
    geometry,
    geometry_type,
    geometry_source,
    geometry_confidence,
    geometry_notes,
    updated_at
  )
  SELECT
    candidate_gravesites.cemetery_id,
    candidate_gravesites.section_uuid,
    candidate_gravesites.gravesite_name,
    candidate_gravesites.facility_id,
    candidate_gravesites.section_id,
    candidate_gravesites.grave_id,
    candidate_gravesites.gravesite_id,
    4,
    10,
    gravesite_status_types.id,
    candidate_gravesites.geometry,
    'operational',
    'Generated from recovered TrinityCemeteryFinal3.shp marker geometry.',
    'estimated',
    'Generated as a 4 ft x 10 ft operational gravesite with the 4 ft western edge centered on the recovered marker point and the 10 ft edges extending east.',
    now()
  FROM candidate_gravesites
  JOIN gravesite_status_types
    ON gravesite_status_types.code = 'occupied'
  ON CONFLICT (cemetery_id, gravesite_id) DO UPDATE SET
    section_uuid = EXCLUDED.section_uuid,
    name = EXCLUDED.name,
    facility_id = EXCLUDED.facility_id,
    section_id = EXCLUDED.section_id,
    grave_id = EXCLUDED.grave_id,
    width_feet = EXCLUDED.width_feet,
    length_feet = EXCLUDED.length_feet,
    status_type_id = EXCLUDED.status_type_id,
    geometry = EXCLUDED.geometry,
    geometry_type = EXCLUDED.geometry_type,
    geometry_source = EXCLUDED.geometry_source,
    geometry_confidence = EXCLUDED.geometry_confidence,
    geometry_notes = EXCLUDED.geometry_notes,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id, gravesite_id
),
updated_headstones AS (
  UPDATE headstones
  SET
    gravesite_uuid = inserted_gravesites.id,
    updated_at = now()
  FROM inserted_gravesites
  WHERE headstones.deleted_at IS NULL
    AND replace(headstones.headstone_id, 'TLC-HS-', 'TLC-GPS-') = inserted_gravesites.gravesite_id
    AND headstones.headstone_id IN (
      'TLC-HS-0559', 'TLC-HS-0560', 'TLC-HS-0561', 'TLC-HS-0562', 'TLC-HS-0563',
      'TLC-HS-0564', 'TLC-HS-0565', 'TLC-HS-0566', 'TLC-HS-0567', 'TLC-HS-0568',
      'TLC-HS-0569', 'TLC-HS-0570', 'TLC-HS-0571', 'TLC-HS-0572', 'TLC-HS-0573'
    )
  RETURNING headstones.id AS headstone_uuid, inserted_gravesites.id AS gravesite_uuid, inserted_gravesites.gravesite_id
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
    updated_headstones.headstone_uuid,
    updated_headstones.gravesite_uuid,
    'primary',
    'Generated from recovered TrinityCemeteryFinal3.shp marker geometry.',
    now()
  FROM updated_headstones
  ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
    relationship_type = EXCLUDED.relationship_type,
    notes = EXCLUDED.notes,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING headstone_uuid, gravesite_uuid
)
UPDATE burials
SET
  gravesite_uuid = updated_headstones.gravesite_uuid,
  gravesite_id = updated_headstones.gravesite_id,
  updated_at = now()
FROM updated_headstones
JOIN headstone_burials
  ON headstone_burials.headstone_uuid = updated_headstones.headstone_uuid
 AND headstone_burials.deleted_at IS NULL
WHERE burials.id = headstone_burials.burial_uuid
  AND burials.deleted_at IS NULL;

--rollback UPDATE burials SET gravesite_uuid = NULL, gravesite_id = NULL, updated_at = now() WHERE gravesite_id IN ('TLC-GPS-0559', 'TLC-GPS-0560', 'TLC-GPS-0561', 'TLC-GPS-0562', 'TLC-GPS-0563', 'TLC-GPS-0564', 'TLC-GPS-0565', 'TLC-GPS-0566', 'TLC-GPS-0567', 'TLC-GPS-0568', 'TLC-GPS-0569', 'TLC-GPS-0570', 'TLC-GPS-0571', 'TLC-GPS-0572', 'TLC-GPS-0573');
--rollback DELETE FROM headstone_gravesites WHERE gravesite_uuid IN (SELECT id FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0559', 'TLC-GPS-0560', 'TLC-GPS-0561', 'TLC-GPS-0562', 'TLC-GPS-0563', 'TLC-GPS-0564', 'TLC-GPS-0565', 'TLC-GPS-0566', 'TLC-GPS-0567', 'TLC-GPS-0568', 'TLC-GPS-0569', 'TLC-GPS-0570', 'TLC-GPS-0571', 'TLC-GPS-0572', 'TLC-GPS-0573'));
--rollback UPDATE headstones SET gravesite_uuid = NULL, updated_at = now() WHERE headstone_id IN ('TLC-HS-0559', 'TLC-HS-0560', 'TLC-HS-0561', 'TLC-HS-0562', 'TLC-HS-0563', 'TLC-HS-0564', 'TLC-HS-0565', 'TLC-HS-0566', 'TLC-HS-0567', 'TLC-HS-0568', 'TLC-HS-0569', 'TLC-HS-0570', 'TLC-HS-0571', 'TLC-HS-0572', 'TLC-HS-0573');
--rollback DELETE FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0559', 'TLC-GPS-0560', 'TLC-GPS-0561', 'TLC-GPS-0562', 'TLC-GPS-0563', 'TLC-GPS-0564', 'TLC-GPS-0565', 'TLC-GPS-0566', 'TLC-GPS-0567', 'TLC-GPS-0568', 'TLC-GPS-0569', 'TLC-GPS-0570', 'TLC-GPS-0571', 'TLC-GPS-0572', 'TLC-GPS-0573');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('headstone_gravesites', 'gravesites');
