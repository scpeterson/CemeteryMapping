--liquibase formatted sql

--changeset scpeterson:039-align-section-g-boundary-to-gravesites splitStatements:false
WITH trinity AS (
  SELECT id
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY facility_id = '1' DESC, name
  LIMIT 1
),
section_g_gravesites AS (
  SELECT ST_Multi(ST_Buffer(ST_Union(gravesites.geometry), 0))::geometry(MultiPolygon, 4326) AS geometry
  FROM gravesites
  JOIN trinity ON trinity.id = gravesites.cemetery_id
  WHERE gravesites.section_id = 'G'
    AND gravesites.gravesite_id BETWEEN 'G-001' AND 'G-094'
    AND gravesites.deleted_at IS NULL
)
UPDATE sections
SET geometry = section_g_gravesites.geometry,
    updated_at = now()
FROM trinity, section_g_gravesites
WHERE sections.cemetery_id = trinity.id
  AND sections.name = 'G'
  AND sections.deleted_at IS NULL
  AND section_g_gravesites.geometry IS NOT NULL;

--rollback WITH trinity AS (SELECT id FROM cemeteries WHERE facility_id = '1' OR name = 'Trinity Lutheran Church Cemetery' ORDER BY facility_id = '1' DESC, name LIMIT 1) UPDATE sections SET geometry = ST_SetSRID(ST_GeomFromText('MULTIPOLYGON(((-80.079690101144 40.601359357888946,-80.07969321146533 40.60161124764567,-80.079577817127 40.601612069047306,-80.07957768189564 40.60160111731876,-80.07954883331107 40.60160132266917,-80.07954856284834 40.60157941921206,-80.07951971426375 40.60157962456247,-80.07951917333831 40.601535817648255,-80.07954802192289 40.601535612297845,-80.07954748099745 40.60149180538363,-80.07957632958203 40.60149160003323,-80.07957578865657 40.601447793119014,-80.07960463724115 40.601447587768604,-80.0796040963157 40.60140378085439,-80.07963294490028 40.60140357550398,-80.07963240397484 40.60135976858977,-80.079690101144 40.601359357888946)))'), 4326)::geometry(MultiPolygon, 4326), updated_at = now() FROM trinity WHERE sections.cemetery_id = trinity.id AND sections.name = 'G' AND sections.deleted_at IS NULL;
