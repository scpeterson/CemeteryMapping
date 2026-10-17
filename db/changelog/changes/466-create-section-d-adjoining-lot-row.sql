--liquibase formatted sql

--changeset cemeterymapping:466-create-section-d-adjoining-lot-row splitStatements:false
DO $$
DECLARE
  anchor lots%ROWTYPE;
  lot_width double precision;
  north_shift double precision;
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D'
    AND lot_id='28' AND block_id IS NULL AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM assert_migration_prerequisite(
    (SELECT count(*)=8 FROM lots WHERE cemetery_id=anchor.cemetery_id AND section_id='D'
      AND block_id IS NULL AND deleted_at IS NULL AND lot_id IN ('28','29','37','48','57','TMP01','TMP02','TMP03')),
    'Migration 466 requires the complete eight-lot Section D reference row');
  PERFORM assert_migration_prerequisite(
    ST_IsValid(anchor.geometry) AND NOT ST_IsEmpty(anchor.geometry)
      AND ST_Equals(anchor.geometry,ST_Envelope(anchor.geometry)),
    'Migration 466 requires a rectangular D-28 reference lot');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id=anchor.facility_id AND section_id='D'
      AND block_id IS NULL AND lot_id IN ('27','30','36','49','56','TMP04','TMP05','TMP06')),
    'Migration 466 destination lot identifiers must be unused, including retired lots');

  lot_width := ST_XMax(anchor.geometry)-ST_XMin(anchor.geometry);
  north_shift := ST_YMax(anchor.geometry)-ST_YMin(anchor.geometry);

  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots existing CROSS JOIN generate_series(0,7) col
    WHERE existing.cemetery_id=anchor.cemetery_id AND existing.deleted_at IS NULL
      AND ST_Intersects(existing.geometry,ST_Translate(anchor.geometry,-col*lot_width,north_shift))
      AND ST_Area(ST_Intersection(existing.geometry,
        ST_Translate(anchor.geometry,-col*lot_width,north_shift))::geography)>0.001),
    'Migration 466 proposed row must not overlap existing active lots');

  INSERT INTO lots(cemetery_id,section_uuid,name,facility_id,section_id,block_id,lot_id,
    width_feet,length_feet,geometry,burial_use_status,burial_use_notes,
    geometry_type,geometry_source,geometry_confidence,geometry_notes)
  SELECT anchor.cemetery_id,anchor.section_uuid,grid.name,anchor.facility_id,'D',NULL,grid.lot_id,
    anchor.width_feet,anchor.length_feet,
    ST_Translate(anchor.geometry,-grid.col*lot_width,north_shift),
    CASE WHEN grid.col>=5 THEN 'non_burial' ELSE 'standard' END,
    CASE WHEN grid.col>=5 THEN 'Temporary label only; no official lot number assigned. Cannot contain gravesites or monuments.' END,
    'operational','Migration 466: D-28 footprint translated directly north.','estimated',
    'Southern border shares the preceding Section D row northern border; east-west alignment retained. Temporary western labels are not official lot numbers.'
  FROM (VALUES ('27','D-27',0),('30','D-30',1),('36','D-36',2),('49','D-49',3),
    ('56','D-56',4),('TMP04','D-TEMP-04',5),('TMP05','D-TEMP-05',6),
    ('TMP06','D-TEMP-06',7)) grid(lot_id,name,col);
END $$;

-- Recovery uses the pre-migration backup; preserve the owner-directed layout.
--rollback empty
