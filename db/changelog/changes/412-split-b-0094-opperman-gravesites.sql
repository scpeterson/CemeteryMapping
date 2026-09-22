--liquibase formatted sql

--changeset cemeterymapping:412-split-b-0094-opperman-gravesites splitStatements:false
CREATE TEMP TABLE opperman_layout (
  person text, grave_code text, record_id text, east_ft double precision, north_ft double precision
) ON COMMIT DROP;
-- Southwest corners; ordering within each face group is estimated, not surveyed.
INSERT INTO opperman_layout VALUES
  ('Carl Opperman', '0094', 'TLC-GPS-0094', -10, 2.5),
  ('Ida O Opperman', '0094A', 'TLC-GPS-0094-01', 0, -4),
  ('Anna A Opperman', '0094B', 'TLC-GPS-0094-02', -10, -1.5),
  ('Caroline M Opperman', '0094C', 'TLC-GPS-0094-03', 0, 0),
  ('Mary S Opperman', '0094D', 'TLC-GPS-0094-04', -10, -5.5),
  ('William Opperman', '0094E', 'TLC-GPS-0094-05', -10, -9.5);

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0094' AND deleted_at IS NULL)
  OR EXISTS (
    SELECT 1 FROM gravesites g JOIN headstones h ON h.gravesite_uuid = g.id
    WHERE g.gravesite_id = 'TLC-GPS-0094' AND g.section_id = 'B' AND g.deleted_at IS NULL
      AND h.headstone_id = 'TLC-HS-0094' AND h.deleted_at IS NULL AND h.geometry IS NOT NULL
      AND (SELECT count(*) FROM burials b WHERE b.gravesite_uuid = g.id AND b.deleted_at IS NULL) = 6
      AND (SELECT count(DISTINCT l.person) FROM opperman_layout l
        JOIN burials b ON b.full_name = l.person AND b.gravesite_uuid = g.id AND b.deleted_at IS NULL
        JOIN headstone_burials hb ON hb.burial_uuid = b.id AND hb.headstone_uuid = h.id AND hb.deleted_at IS NULL) = 6
  ), 'B-0094 must contain exactly the six linked Opperman burials and fixed TLC-HS-0094'
);
SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM gravesites WHERE gravesite_id = 'TLC-GPS-0094' AND deleted_at IS NULL)
  OR NOT EXISTS (
    SELECT 1 FROM gravesites g JOIN opperman_layout l ON l.grave_code <> '0094'
      AND (g.gravesite_id = l.record_id OR (g.section_id = 'B' AND g.grave_id = l.grave_code))
    WHERE g.cemetery_id = (SELECT cemetery_id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0094')
  ), 'new B-0094A through B-0094E identifiers must be unused'
);

CREATE TEMP TABLE opperman_source ON COMMIT DROP AS
SELECT g.*, h.id AS marker_id, h.geometry AS marker_point
FROM gravesites g JOIN headstones h ON h.gravesite_uuid = g.id
WHERE g.gravesite_id = 'TLC-GPS-0094' AND g.deleted_at IS NULL
  AND h.headstone_id = 'TLC-HS-0094' AND h.deleted_at IS NULL;

CREATE TEMP TABLE opperman_polygons ON COMMIT DROP AS
SELECT l.*, ST_Multi(ST_MakePolygon(ST_MakeLine(array_agg(
  ST_Project(s.marker_point::geography,
    sqrt(power(l.east_ft + c.dx, 2) + power(l.north_ft + c.dy, 2)) * 0.3048,
    atan2(l.east_ft + c.dx, l.north_ft + c.dy))::geometry ORDER BY c.ordinal
))))::geometry(MultiPolygon,4326) AS shape
FROM opperman_layout l CROSS JOIN opperman_source s
CROSS JOIN (VALUES (0,0,1),(10,0,2),(10,4,3),(0,4,4),(0,0,5)) c(dx,dy,ordinal)
GROUP BY l.person,l.grave_code,l.record_id,l.east_ft,l.north_ft;

UPDATE gravesites g SET name = p.person, geometry = p.shape,
  width_feet = 4, length_feet = 10, geometry_type = 'operational', geometry_confidence = 'estimated',
  geometry_source = 'Six Opperman graves grouped by east-facing Front and west-facing Back of fixed TLC-HS-0094.',
  geometry_notes = concat_ws(' ', NULLIF(g.geometry_notes,''),
    'Carl retained in B-0094; position estimated west of monument. Within-group order and boundaries require field verification; see ADR 0070.'), updated_at = now()
FROM opperman_polygons p, opperman_source s WHERE g.id = s.id AND p.grave_code = '0094';

INSERT INTO gravesites (
  cemetery_id,section_uuid,block_uuid,lot_uuid,name,facility_id,section_id,block_id,lot_id,
  grave_id,gravesite_id,cost,geometry,width_feet,length_feet,status_type_id,
  geometry_type,geometry_source,geometry_confidence,geometry_notes
)
SELECT s.cemetery_id,s.section_uuid,s.block_uuid,s.lot_uuid,p.person,s.facility_id,s.section_id,s.block_id,s.lot_id,
  p.grave_code,p.record_id,s.cost,p.shape,4,10,s.status_type_id,'operational',
  'Split from B-0094 around fixed TLC-HS-0094; Caroline and Ida east, Carl, Anna, Mary and William west.',
  'estimated','Estimated 4 by 10 foot boundary. Within-group order and boundaries require field verification; see ADR 0070.'
FROM opperman_source s CROSS JOIN opperman_polygons p WHERE p.grave_code <> '0094';

UPDATE burials b SET gravesite_uuid = g.id, gravesite_id = g.gravesite_id, updated_at = now()
FROM opperman_source s, opperman_layout l, gravesites g
WHERE b.gravesite_uuid = s.id AND b.deleted_at IS NULL AND b.full_name = l.person
  AND g.cemetery_id = s.cemetery_id AND g.gravesite_id = l.record_id;

INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type)
SELECT s.marker_id,g.id,'spans' FROM opperman_source s CROSS JOIN opperman_layout l
JOIN gravesites g ON g.gravesite_id = l.record_id WHERE g.cemetery_id = s.cemetery_id
ON CONFLICT(headstone_uuid,gravesite_uuid) DO UPDATE SET relationship_type='spans',
  deleted_at=NULL,deleted_by=NULL,delete_reason=NULL,updated_at=now();

-- Existing marker coordinates, faces, person/photo associations, and burial details are preserved.
--rollback empty
