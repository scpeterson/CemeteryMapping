--liquibase formatted sql

--changeset scpeterson:040-angle-section-g-boundary splitStatements:false
WITH trinity AS (
  SELECT id
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY facility_id = '1' DESC, name
  LIMIT 1
),
angled_section_g AS (
  SELECT ST_Multi(
    ST_Buffer(
      ST_SetSRID(
        ST_GeomFromText('MULTIPOLYGON(((-80.079690101144 40.601359357888946,-80.07969321146533 40.60161124764567,-80.079577817127 40.601612069047306,-80.07954883331107 40.60160132266917,-80.07951971426375 40.60157962456247,-80.07951917333831 40.601535817648255,-80.07963240397484 40.60135976858977,-80.079690101144 40.601359357888946)))'),
        4326
      ),
      0.00000000001
    )
  )::geometry(MultiPolygon, 4326) AS geometry
)
UPDATE sections
SET geometry = angled_section_g.geometry,
    updated_at = now()
FROM trinity, angled_section_g
WHERE sections.cemetery_id = trinity.id
  AND sections.name = 'G'
  AND sections.deleted_at IS NULL;

--rollback WITH trinity AS (SELECT id FROM cemeteries WHERE facility_id = '1' OR name = 'Trinity Lutheran Church Cemetery' ORDER BY facility_id = '1' DESC, name LIMIT 1), section_g_gravesites AS (SELECT ST_Multi(ST_Buffer(ST_Union(gravesites.geometry), 0))::geometry(MultiPolygon, 4326) AS geometry FROM gravesites JOIN trinity ON trinity.id = gravesites.cemetery_id WHERE gravesites.section_id = 'G' AND gravesites.gravesite_id BETWEEN 'G-001' AND 'G-094' AND gravesites.deleted_at IS NULL) UPDATE sections SET geometry = section_g_gravesites.geometry, updated_at = now() FROM trinity, section_g_gravesites WHERE sections.cemetery_id = trinity.id AND sections.name = 'G' AND sections.deleted_at IS NULL AND section_g_gravesites.geometry IS NOT NULL;
