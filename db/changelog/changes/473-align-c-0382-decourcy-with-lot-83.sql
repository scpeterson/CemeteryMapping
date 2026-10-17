--liquibase formatted sql

--changeset cemeterymapping:473-align-c-0382-decourcy-with-lot-83 splitStatements:false
DO $$
DECLARE
  target_count integer;
  target_lot lots%ROWTYPE;
  marker headstones%ROWTYPE;
BEGIN
  SELECT count(*) INTO target_count FROM gravesites
  WHERE gravesite_id IN ('TLC-GPS-0382','TLC-GPS-0382-01') AND deleted_at IS NULL;
  IF target_count = 0 THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(target_count = 2,
    'Migration 473 requires both active DeCourcy gravesites');
  SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0382' AND deleted_at IS NULL;
  SELECT l.* INTO target_lot FROM lots l JOIN gravesites g ON g.lot_uuid=l.id
  WHERE g.gravesite_id='TLC-GPS-0382' AND g.deleted_at IS NULL AND l.deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(
    target_lot.id IS NOT NULL AND target_lot.section_id='C' AND target_lot.lot_id='83'
    AND target_lot.geometry IS NOT NULL AND marker.geometry IS NOT NULL
    AND ST_Covers(target_lot.geometry,marker.geometry)
    AND (SELECT count(*)=2 FROM gravesites g WHERE g.deleted_at IS NULL
      AND g.gravesite_id IN ('TLC-GPS-0382','TLC-GPS-0382-01')
      AND g.cemetery_id=target_lot.cemetery_id AND g.lot_uuid=target_lot.id
      AND g.section_id='C' AND g.lot_id='83' AND g.width_feet=4 AND g.length_feet=10
      AND g.geometry IS NOT NULL AND g.geometry_type='operational' AND g.geometry_confidence='estimated'
      AND g.name=CASE g.gravesite_id WHEN 'TLC-GPS-0382' THEN 'William DeWitt DeCourcy' ELSE 'Louise Hamilton DeCourcy' END
      AND EXISTS(SELECT 1 FROM headstone_gravesites hg WHERE hg.headstone_uuid=marker.id
        AND hg.gravesite_uuid=g.id AND hg.deleted_at IS NULL AND hg.relationship_type='spans')),
    'Migration 473 requires the reviewed DeCourcy pair, shared marker, and unchanged C-83 assignments');

  -- A repeated execution must not accumulate the translation.
  IF (SELECT bool_and(ST_Covers(target_lot.geometry,geometry)) FROM gravesites
      WHERE gravesite_id IN ('TLC-GPS-0382','TLC-GPS-0382-01') AND deleted_at IS NULL) THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(
    (SELECT bool_and(NOT ST_Covers(target_lot.geometry,geometry)) FROM gravesites
      WHERE gravesite_id IN ('TLC-GPS-0382','TLC-GPS-0382-01') AND deleted_at IS NULL),
    'Migration 473 requires review of a partially aligned DeCourcy pair');

  -- Only translate the reviewed migration-346 footprints; later edits require review.
  PERFORM assert_migration_prerequisite((
    WITH corners AS (
      SELECT ST_Project(marker.geometry::geography,offset_feet*0.3048,pi())::geometry AS south,
        ST_Project(marker.geometry::geography,(offset_feet-4)*0.3048,pi())::geometry AS north,
        public_id
      FROM (VALUES ('TLC-GPS-0382',5),('TLC-GPS-0382-01',1)) v(public_id,offset_feet)
    ), expected AS (
      SELECT public_id,ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[
        south,ST_Project(south::geography,10*0.3048,pi()/2)::geometry,
        ST_Project(north::geography,10*0.3048,pi()/2)::geometry,north,south]))) AS geometry
      FROM corners
    )
    SELECT bool_and(ST_Equals(g.geometry,e.geometry)) FROM gravesites g JOIN expected e
      ON e.public_id=g.gravesite_id WHERE g.deleted_at IS NULL),
    'Migration 473 requires unchanged migration-346 footprints; review later geometry edits');

  PERFORM assert_migration_prerequisite((
    WITH proposed AS (
      SELECT g.id,g.cemetery_id,
        ST_Transform(ST_Translate(ST_Transform(g.geometry,32617),-0.38*0.3048,0),4326) AS geometry
      FROM gravesites g WHERE g.gravesite_id IN ('TLC-GPS-0382','TLC-GPS-0382-01') AND g.deleted_at IS NULL
    )
    SELECT bool_and(ST_Covers(target_lot.geometry,p.geometry) AND NOT EXISTS(
      SELECT 1 FROM gravesites n WHERE n.deleted_at IS NULL AND n.cemetery_id=p.cemetery_id
        AND n.gravesite_id NOT IN ('TLC-GPS-0382','TLC-GPS-0382-01')
        AND ST_Intersects(p.geometry,n.geometry)
        AND ST_Area(ST_Intersection(p.geometry,n.geometry)::geography)>0.00001))
      AND NOT EXISTS(SELECT 1 FROM proposed a JOIN proposed b ON a.id<b.id
        WHERE ST_Area(ST_Intersection(a.geometry,b.geometry)::geography)>0.00001)
    FROM proposed p),
    'Migration 473 proposed polygons must fit C-83 without neighboring or mutual overlaps');

  UPDATE gravesites SET
    geometry=ST_Transform(ST_Translate(ST_Transform(geometry,32617),-0.38*0.3048,0),4326),
    geometry_source='Migration 473: estimated DeCourcy pair translated 0.38 feet west in EPSG:32617 to fit schematic lot C-83; observed marker unchanged.',
    geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
      '2026-10-17: translated 4.56 inches west to remove the approximately 1.50-square-foot spill per grave into schematic lot C-82. Preserves the migration 346 north/south arrangement, 4-by-10-foot dimensions, C-83 assignments, and observed marker. C-0383 remains unchanged for separate review. This alignment is not a surveyed burial boundary.'),
    updated_at=now()
  WHERE gravesite_id IN ('TLC-GPS-0382','TLC-GPS-0382-01') AND deleted_at IS NULL;
END $$;

-- Preserve subsequent edits; recovery uses a backup or reviewed forward correction.
--rollback empty
