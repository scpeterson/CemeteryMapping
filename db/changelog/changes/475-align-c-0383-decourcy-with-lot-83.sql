--liquibase formatted sql

--changeset cemeterymapping:475-align-c-0383-decourcy-with-lot-83 splitStatements:false
DO $$
DECLARE
  grave gravesites%ROWTYPE;
  target_lot lots%ROWTYPE;
  marker headstones%ROWTYPE;
  proposed geometry(MultiPolygon,4326);
  remaining_overlap_sqft numeric;
BEGIN
  SELECT * INTO grave FROM gravesites WHERE gravesite_id='TLC-GPS-0383' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO target_lot FROM lots WHERE id=grave.lot_uuid AND deleted_at IS NULL;
  SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0383' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(
    grave.section_id='C' AND grave.lot_id='83' AND grave.name='William Hamilton DeCourcy'
    AND target_lot.id IS NOT NULL AND target_lot.section_id='C' AND target_lot.lot_id='83'
    AND target_lot.cemetery_id=grave.cemetery_id AND target_lot.geometry IS NOT NULL
    AND grave.width_feet=4 AND grave.length_feet=10 AND grave.geometry_type='operational'
    AND grave.geometry_confidence='estimated' AND grave.geometry IS NOT NULL
    AND marker.id IS NOT NULL AND marker.gravesite_uuid=grave.id AND marker.geometry IS NOT NULL
    AND ST_Covers(target_lot.geometry,marker.geometry)
    AND EXISTS(SELECT 1 FROM headstone_gravesites WHERE headstone_uuid=marker.id AND gravesite_uuid=grave.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM gravesites WHERE gravesite_id='TLC-GPS-0425' AND deleted_at IS NULL),
    'Migration 475 requires reviewed C-0383, its unchanged C-83 assignment and marker, and retired C-0425');
  IF ST_Covers(target_lot.geometry,grave.geometry) THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(ST_Equals(grave.geometry,ST_GeomFromText(
    'MULTIPOLYGON(((-80.08058801 40.60110323039324,-80.08055199881682 40.60110323038763,-80.08055199881092 40.60111420960113,-80.08058801 40.601114209606735,-80.08058801 40.60110323039324)))',4326)),
    'Migration 475 requires the reviewed original C-0383 footprint; review later geometry edits');
  proposed := ST_Transform(ST_Translate(ST_Transform(grave.geometry,32617),-0.295*0.3048,0),4326);
  PERFORM assert_migration_prerequisite(ST_Covers(target_lot.geometry,proposed) AND NOT EXISTS(
    SELECT 1 FROM gravesites n WHERE n.deleted_at IS NULL AND n.cemetery_id=grave.cemetery_id AND n.id<>grave.id
      AND ST_Intersects(proposed,n.geometry)
      AND ST_Area(ST_Intersection(proposed,n.geometry)::geography)>0.00001
      AND NOT (n.gravesite_id='TLC-GPS-0384' AND n.name='Allan J Watenpool'
        AND ST_Equals(n.geometry,ST_GeomFromText('MULTIPOLYGON(((-80.08058766 40.60111284039325,-80.08055164881166 40.60111284038764,-80.08055164880577 40.60112381960111,-80.08058766 40.60112381960672,-80.08058766 40.60111284039325)))',4326))
        AND ST_Area(ST_Intersection(proposed,n.geometry)::geography)
          <=ST_Area(ST_Intersection(grave.geometry,n.geometry)::geography)+0.00001)),
    'Migration 475 proposed C-0383 must fit C-83 with no new overlaps or increased C-0384 overlap');
  SELECT round((COALESCE(sum(ST_Area(ST_Intersection(proposed,geometry)::geography)),0)/0.09290304)::numeric,3)
  INTO remaining_overlap_sqft FROM gravesites WHERE gravesite_id='TLC-GPS-0384'
    AND cemetery_id=grave.cemetery_id AND deleted_at IS NULL;
  UPDATE gravesites SET geometry=proposed,
    geometry_source='Migration 475: estimated C-0383 translated 0.295 feet west in EPSG:32617 to fit schematic C-83; observed marker unchanged.',
    geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
      format('2026-10-17: translated 3.54 inches west, removing approximately 1.15 square feet of spill into schematic C-82. C-83 assignment and 4-by-10-foot dimensions retained. Remaining C-0384 overlap is %s square feet and requires separate review; C-0384 was not changed. No surveyed burial boundary is inferred.',remaining_overlap_sqft)),
    updated_at=now() WHERE id=grave.id;
END $$;

-- Preserve subsequent edits; recovery uses a backup or reviewed forward correction.
--rollback empty
