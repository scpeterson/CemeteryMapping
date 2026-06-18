--liquibase formatted sql

--changeset cemeterymapping:104-import-trinity-missing-shapefile-markers splitStatements:false
WITH source_markers (
  headstone_id,
  shapefile_feature_index,
  shapefile_title,
  longitude,
  latitude,
  nhg_section,
  nhg_row,
  nhg_site_id,
  original_nhg_site_id
) AS (
  VALUES
    ('TLC-HS-0559', 549, 0, -80.07981770360526::numeric, 40.60167649177479::numeric, 'B', '3', '24', '24'),
    ('TLC-HS-0560', 550, 0, -80.07996776558896::numeric, 40.60164897477933::numeric, 'B', '6', '1', '1'),
    ('TLC-HS-0561', 551, 0, -80.07996813058857::numeric, 40.601655642779384::numeric, 'B', '6', '2', '2'),
    ('TLC-HS-0562', 552, 0, -80.0799686805881::numeric, 40.601663745779376::numeric, 'B', '6', '3', '3'),
    ('TLC-HS-0563', 547, 0, -80.07985294860183::numeric, 40.60166268377582::numeric, 'C', NULL, NULL, NULL),
    ('TLC-HS-0564', 548, 0, -80.07981747960561::numeric, 40.60167001777476::numeric, 'C', '3', '23', '23'),
    ('TLC-HS-0565', 292, 294, -80.08044047453191::numeric, 40.60167299179375::numeric, 'E', '6', NULL, E'\\b'),
    ('TLC-HS-0566', 293, 295, -80.08045196453014::numeric, 40.6016796217942::numeric, 'E', '6', '2', E'2\\b'),
    ('TLC-HS-0567', 294, 296, -80.08046225452865::numeric, 40.601685701794516::numeric, 'E', '6', '3', '3'),
    ('TLC-HS-0568', 553, 0, -80.08047502948472::numeric, 40.601693404289556::numeric, 'E', '6', '4', '4'),
    ('TLC-HS-0569', 295, 297, -80.08048070452583::numeric, 40.60169723179512::numeric, 'E', '6', '5', '5'),
    ('TLC-HS-0570', 296, 298, -80.08049132452417::numeric, 40.60170491179542::numeric, 'E', '6', '6', '6'),
    ('TLC-HS-0571', 298, 300, -80.08051081452095::numeric, 40.60172168179606::numeric, 'E', '6', '8', '8'),
    ('TLC-HS-0572', 300, 302, -80.08052946451815::numeric, 40.60173383179662::numeric, 'E', '6', '10', '10'),
    ('TLC-HS-0573', 301, 303, -80.08054101451636::numeric, 40.601742351796986::numeric, 'E', '6', '11', '11')
),
source_people (
  headstone_id,
  person_number,
  first_name,
  last_name,
  birth_date,
  birth_date_text,
  death_date,
  death_date_text
) AS (
  VALUES
    ('TLC-HS-0559', 1, 'Alfred', 'Hieber', DATE '1906-05-10', 'May 10, 1906', DATE '1909-06-24', 'June 24, 1909'),
    ('TLC-HS-0560', 1, 'Herman A', 'Hieber', DATE '1905-02-15', 'February 15, 1905', DATE '1905-06-20', 'June 20, 1905'),
    ('TLC-HS-0561', 1, 'Amanda L', 'Will/Bruermann/Pfeiffer', DATE '1883-01-24', 'January 24, 1883', DATE '1888-04-11', 'April 11, 1888'),
    ('TLC-HS-0562', 1, 'Wilhelm J', 'Heck/Hoch', DATE '1875-01-21', 'January 21, 1875', DATE '1876-01-19', 'January 19, 1876'),
    ('TLC-HS-0563', 1, NULL, 'Plot Marker, H', NULL, NULL, NULL, NULL),
    ('TLC-HS-0564', 1, 'Esther', 'Hieber', DATE '1898-11-15', 'November 15, 1898', DATE '1905-12-16', 'December 16, 1905'),
    ('TLC-HS-0565', 1, NULL, 'illegible', DATE '1851-05-02', 'May 2, 1851', DATE '1875-01-23', 'January 23, 1875'),
    ('TLC-HS-0566', 1, '(Elizabeth)', 'Ziegenthaler', NULL, NULL, NULL, NULL),
    ('TLC-HS-0567', 1, NULL, 'Illegible', NULL, NULL, NULL, NULL),
    ('TLC-HS-0568', 1, NULL, 'Heck', NULL, NULL, NULL, NULL),
    ('TLC-HS-0569', 1, NULL, 'Illegible', NULL, NULL, NULL, NULL),
    ('TLC-HS-0570', 1, 'Georg', 'Brant', DATE '1845-07-06', 'July 6, 1845', DATE '1848-09-07', 'September 7, 1848'),
    ('TLC-HS-0571', 1, 'Susanna', 'Brand/Heniger', DATE '1780-03-20', 'March 20,1780', DATE '1851-09-25', 'September 25, 1851'),
    ('TLC-HS-0572', 1, NULL, 'Illegible', NULL, NULL, NULL, NULL),
    ('TLC-HS-0573', 1, NULL, 'Illegible', DATE '1857-06-19', 'June 19, 1857', NULL, NULL)
),
inserted_headstones AS (
  INSERT INTO headstones (
    headstone_id,
    marker_type,
    marker_type_id,
    material_type_id,
    condition_type_id,
    latitude,
    longitude,
    geometry,
    source_properties,
    updated_at
  )
  SELECT
    source_markers.headstone_id,
    'headstone',
    marker_types.id,
    marker_material_types.id,
    headstone_condition_types.id,
    source_markers.latitude,
    source_markers.longitude,
    ST_SetSRID(
      ST_MakePoint(source_markers.longitude::double precision, source_markers.latitude::double precision),
      4326
    )::geometry(Point, 4326),
    jsonb_strip_nulls(
      jsonb_build_object(
        'Source', 'TrinityCemeteryFinal3.shp',
        'SourceFormat', 'ESRI Shapefile',
        'ImportReason', 'Recovered marker present in original shapefile but missing from spreadsheet-derived marker import.',
        'ShapefileFeatureIndex', source_markers.shapefile_feature_index,
        'Title', source_markers.shapefile_title,
        'Latitude', source_markers.latitude,
        'Longitude', source_markers.longitude,
        'CoordinateSource', 'shapefile geometry',
        'NhgSection', source_markers.nhg_section,
        'NhgRow', source_markers.nhg_row,
        'Number', source_markers.nhg_site_id,
        'OriginalNHGSiteID', source_markers.original_nhg_site_id,
        'Person1First', p1.first_name,
        'Person1Last', p1.last_name,
        'Person1DOB', p1.birth_date_text,
        'Person1DOD', p1.death_date_text,
        'Person2First', p2.first_name,
        'Person2Last', p2.last_name,
        'Person2DOB', p2.birth_date_text,
        'Person2DOD', p2.death_date_text,
        'Person3First', p3.first_name,
        'Person3Last', p3.last_name,
        'Person3DOB', p3.birth_date_text,
        'Person3DOD', p3.death_date_text,
        'Person4First', p4.first_name,
        'Person4Last', p4.last_name,
        'Person4DOB', p4.birth_date_text,
        'Person4DOD', p4.death_date_text,
        'Person5First', p5.first_name,
        'Person5Last', p5.last_name,
        'Person5DOB', p5.birth_date_text,
        'Person5DOD', p5.death_date_text,
        'Person6First', p6.first_name,
        'Person6Last', p6.last_name,
        'Person6DOB', p6.birth_date_text,
        'Person6DOD', p6.death_date_text
      )
    ),
    now()
  FROM source_markers
  JOIN marker_types
    ON marker_types.code = 'unknown'
  JOIN marker_material_types
    ON marker_material_types.code = 'unknown'
  JOIN headstone_condition_types
    ON headstone_condition_types.code = 'unknown'
  LEFT JOIN source_people p1
    ON p1.headstone_id = source_markers.headstone_id
   AND p1.person_number = 1
  LEFT JOIN source_people p2
    ON p2.headstone_id = source_markers.headstone_id
   AND p2.person_number = 2
  LEFT JOIN source_people p3
    ON p3.headstone_id = source_markers.headstone_id
   AND p3.person_number = 3
  LEFT JOIN source_people p4
    ON p4.headstone_id = source_markers.headstone_id
   AND p4.person_number = 4
  LEFT JOIN source_people p5
    ON p5.headstone_id = source_markers.headstone_id
   AND p5.person_number = 5
  LEFT JOIN source_people p6
    ON p6.headstone_id = source_markers.headstone_id
   AND p6.person_number = 6
  ON CONFLICT (headstone_id) DO UPDATE SET
    marker_type = EXCLUDED.marker_type,
    marker_type_id = EXCLUDED.marker_type_id,
    material_type_id = EXCLUDED.material_type_id,
    condition_type_id = EXCLUDED.condition_type_id,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    geometry = EXCLUDED.geometry,
    source_properties = EXCLUDED.source_properties,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id, headstone_id
),
deleted_existing_burials AS (
  UPDATE burials
  SET
    deleted_at = now(),
    delete_reason = 'Replaced by shapefile missing marker import.',
    updated_at = now()
  WHERE id IN (
    SELECT headstone_burials.burial_uuid
    FROM headstone_burials
    JOIN inserted_headstones
      ON inserted_headstones.id = headstone_burials.headstone_uuid
    WHERE headstone_burials.deleted_at IS NULL
  )
  RETURNING id
),
deleted_existing_links AS (
  UPDATE headstone_burials
  SET
    deleted_at = now(),
    delete_reason = 'Replaced by shapefile missing marker import.'
  FROM inserted_headstones
  WHERE headstone_burials.headstone_uuid = inserted_headstones.id
    AND headstone_burials.deleted_at IS NULL
  RETURNING headstone_burials.headstone_uuid
),
inserted_burials AS (
  INSERT INTO burials (
    first_name,
    last_name,
    full_name,
    birth_date,
    birth_date_text,
    death_date,
    death_date_text,
    interment_type_id,
    notes,
    updated_at
  )
  SELECT
    source_people.first_name,
    source_people.last_name,
    NULLIF(concat_ws(' ', source_people.first_name, source_people.last_name), ''),
    source_people.birth_date,
    source_people.birth_date_text,
    source_people.death_date,
    source_people.death_date_text,
    burial_interment_types.id,
    concat(
      'Imported from TrinityCemeteryFinal3.shp feature ',
      source_markers.shapefile_feature_index,
      '. North Hills Genealogists section: ',
      COALESCE(source_markers.nhg_section, 'not recorded'),
      '. North Hills Genealogists row: ',
      COALESCE(source_markers.nhg_row, 'not recorded'),
      '. North Hills Genealogists site: ',
      COALESCE(source_markers.nhg_site_id, 'not recorded'),
      '. Person column: ',
      source_people.person_number,
      '.'
    ),
    now()
  FROM source_people
  JOIN source_markers
    ON source_markers.headstone_id = source_people.headstone_id
  JOIN burial_interment_types
    ON burial_interment_types.code = 'casket'
  WHERE source_people.first_name IS NOT NULL
     OR source_people.last_name IS NOT NULL
     OR source_people.birth_date_text IS NOT NULL
     OR source_people.death_date_text IS NOT NULL
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
  inserted_headstones.id,
  inserted_burials.id,
  NULL,
  NULL,
  NULL
FROM inserted_burials
JOIN source_people
  ON inserted_burials.notes LIKE concat(
    'Imported from TrinityCemeteryFinal3.shp feature %. Person column: ',
    source_people.person_number,
    '.'
  )
JOIN source_markers
  ON source_markers.headstone_id = source_people.headstone_id
 AND inserted_burials.notes LIKE concat(
    'Imported from TrinityCemeteryFinal3.shp feature ',
    source_markers.shapefile_feature_index,
    '.%'
  )
JOIN inserted_headstones
  ON inserted_headstones.headstone_id = source_markers.headstone_id
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback DELETE FROM burials WHERE id IN (SELECT headstone_burials.burial_uuid FROM headstone_burials JOIN headstones ON headstones.id = headstone_burials.headstone_uuid WHERE headstones.headstone_id IN ('TLC-HS-0559', 'TLC-HS-0560', 'TLC-HS-0561', 'TLC-HS-0562', 'TLC-HS-0563', 'TLC-HS-0564', 'TLC-HS-0565', 'TLC-HS-0566', 'TLC-HS-0567', 'TLC-HS-0568', 'TLC-HS-0569', 'TLC-HS-0570', 'TLC-HS-0571', 'TLC-HS-0572', 'TLC-HS-0573'));
--rollback DELETE FROM headstones WHERE headstone_id IN ('TLC-HS-0559', 'TLC-HS-0560', 'TLC-HS-0561', 'TLC-HS-0562', 'TLC-HS-0563', 'TLC-HS-0564', 'TLC-HS-0565', 'TLC-HS-0566', 'TLC-HS-0567', 'TLC-HS-0568', 'TLC-HS-0569', 'TLC-HS-0570', 'TLC-HS-0571', 'TLC-HS-0572', 'TLC-HS-0573');
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('burials', 'headstone_burials', 'headstones');
