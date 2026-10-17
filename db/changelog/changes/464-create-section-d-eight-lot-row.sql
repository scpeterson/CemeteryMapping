--liquibase formatted sql

--changeset cemeterymapping:464-create-section-d-eight-lot-row splitStatements:false
DO $$
DECLARE
  anchor lots%ROWTYPE;
  lot_width double precision;
  north_shift double precision;
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D'
    AND lot_id='38' AND block_id IS NULL AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM assert_migration_prerequisite(
    (SELECT count(*)=6 FROM lots WHERE cemetery_id=anchor.cemetery_id AND section_id='D'
      AND block_id IS NULL AND deleted_at IS NULL AND lot_id IN ('38','47','58','67','68','77')),
    'Migration 464 requires the complete six-lot Section D reference row');
  PERFORM assert_migration_prerequisite(
    ST_IsValid(anchor.geometry) AND NOT ST_IsEmpty(anchor.geometry)
      AND ST_Equals(anchor.geometry,ST_Envelope(anchor.geometry)),
    'Migration 464 requires a rectangular D-38 reference lot');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id=anchor.facility_id AND section_id='D'
      AND block_id IS NULL AND lot_id IN ('28','29','37','48','57','TMP01','TMP02','TMP03')),
    'Migration 464 destination lot identifiers must be unused, including retired lots');

  lot_width := ST_XMax(anchor.geometry)-ST_XMin(anchor.geometry);
  north_shift := ST_Y(ST_Project(
    ST_SetSRID(ST_MakePoint(ST_XMax(anchor.geometry),ST_YMax(anchor.geometry)),4326)::geography,
    6*0.3048,0)::geometry)-ST_YMin(anchor.geometry);

  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots existing CROSS JOIN generate_series(0,7) col
    WHERE existing.cemetery_id=anchor.cemetery_id AND existing.deleted_at IS NULL
      AND ST_Intersects(existing.geometry,ST_Translate(anchor.geometry,(2-col)*lot_width,north_shift))
      AND ST_Area(ST_Intersection(existing.geometry,
        ST_Translate(anchor.geometry,(2-col)*lot_width,north_shift))::geography)>0.001),
    'Migration 464 proposed row must not overlap existing active lots');

  INSERT INTO lots(cemetery_id,section_uuid,name,facility_id,section_id,block_id,lot_id,
    width_feet,length_feet,geometry,burial_use_status,burial_use_notes,
    geometry_type,geometry_source,geometry_confidence,geometry_notes)
  SELECT anchor.cemetery_id,anchor.section_uuid,grid.name,anchor.facility_id,'D',NULL,grid.lot_id,
    anchor.width_feet,anchor.length_feet,
    ST_Translate(anchor.geometry,(2-grid.col)*lot_width,north_shift),
    CASE WHEN grid.col>=5 THEN 'non_burial' ELSE 'standard' END,
    CASE WHEN grid.col>=5 THEN 'Temporary label only; no official lot number assigned. Cannot contain gravesites or monuments.' END,
    'operational','Migration 464: D-38 footprint extended to an eight-lot row.','estimated',
    'Southern border six feet north of the preceding Section D row; two additional lots extend east. Temporary western labels are not official lot numbers.'
  FROM (VALUES ('28','D-28',0),('29','D-29',1),('37','D-37',2),('48','D-48',3),
    ('57','D-57',4),('TMP01','D-TEMP-01',5),('TMP02','D-TEMP-02',6),
    ('TMP03','D-TEMP-03',7)) grid(lot_id,name,col);
END $$;

-- Recovery uses the pre-migration backup; preserve the owner-directed layout.
--rollback empty
