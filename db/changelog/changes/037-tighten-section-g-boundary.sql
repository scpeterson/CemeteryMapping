--liquibase formatted sql

--changeset scpeterson:037-tighten-section-g-boundary splitStatements:false
WITH trinity AS (
  SELECT id
  FROM cemeteries
  WHERE facility_id = '1'
     OR name = 'Trinity Lutheran Church Cemetery'
  ORDER BY facility_id = '1' DESC, name
  LIMIT 1
),
tight_section_g AS (
  SELECT ST_SetSRID(
    ST_GeomFromText('MULTIPOLYGON(((-80.079690101144 40.601359357888946,-80.07969321146533 40.60161124764567,-80.079577817127 40.601612069047306,-80.07957768189564 40.60160111731876,-80.07954883331107 40.60160132266917,-80.07954856284834 40.60157941921206,-80.07951971426375 40.60157962456247,-80.07951917333831 40.601535817648255,-80.07954802192289 40.601535612297845,-80.07954748099745 40.60149180538363,-80.07957632958203 40.60149160003323,-80.07957578865657 40.601447793119014,-80.07960463724115 40.601447587768604,-80.0796040963157 40.60140378085439,-80.07963294490028 40.60140357550398,-80.07963240397484 40.60135976858977,-80.079690101144 40.601359357888946)))'),
    4326
  )::geometry(MultiPolygon, 4326) AS geometry
)
UPDATE sections
SET geometry = tight_section_g.geometry,
    updated_at = now()
FROM trinity, tight_section_g
WHERE sections.cemetery_id = trinity.id
  AND sections.name = 'G'
  AND sections.deleted_at IS NULL;

--rollback WITH trinity AS (SELECT id FROM cemeteries WHERE facility_id = '1' OR name = 'Trinity Lutheran Church Cemetery' ORDER BY facility_id = '1' DESC, name LIMIT 1) UPDATE sections SET geometry = ST_SetSRID(ST_GeomFromText('MULTIPOLYGON(((-80.0794283 40.601633050000004,-80.079694493 40.601715033000005,-80.07968984700001 40.601338776000006,-80.07960752800001 40.601340808,-80.0794283 40.601633050000004)))'), 4326)::geometry(MultiPolygon, 4326), updated_at = now() FROM trinity WHERE sections.cemetery_id = trinity.id AND sections.name = 'G' AND sections.deleted_at IS NULL;
