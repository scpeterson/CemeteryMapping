--liquibase formatted sql

--changeset cemeterymapping:468-create-section-d-two-northern-rows splitStatements:false
DO $$
DECLARE
  anchor lots%ROWTYPE;
  lot_width double precision;
  north_shift double precision;
  lot_height double precision;
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D'
    AND lot_id='27' AND block_id IS NULL AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM assert_migration_prerequisite(
    (SELECT count(*)=8 FROM lots WHERE cemetery_id=anchor.cemetery_id AND section_id='D'
      AND block_id IS NULL AND deleted_at IS NULL AND lot_id IN ('27','30','36','49','56','TMP04','TMP05','TMP06')),
    'Migration 468 requires the complete eight-lot Section D reference row');
  PERFORM assert_migration_prerequisite(
    ST_IsValid(anchor.geometry) AND NOT ST_IsEmpty(anchor.geometry)
      AND ST_Equals(anchor.geometry,ST_Envelope(anchor.geometry)),
    'Migration 468 requires a rectangular D-27 reference lot');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id=anchor.facility_id AND section_id='D'
      AND block_id IS NULL AND lot_id IN ('26','31','35','50','55','TMP07','TMP08','TMP09','25','32','34','51','54','TMP10','TMP11','TMP12')),
    'Migration 468 destination lot identifiers must be unused, including retired lots');

  lot_width := ST_XMax(anchor.geometry)-ST_XMin(anchor.geometry);
  lot_height := ST_YMax(anchor.geometry)-ST_YMin(anchor.geometry);
  north_shift := ST_Y(ST_Project(
    ST_SetSRID(ST_MakePoint(ST_XMax(anchor.geometry),ST_YMax(anchor.geometry)),4326)::geography,
    6*0.3048,0)::geometry)-ST_YMin(anchor.geometry);

  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots existing CROSS JOIN generate_series(0,7) col CROSS JOIN generate_series(0,1) row_index
    WHERE existing.cemetery_id=anchor.cemetery_id AND existing.deleted_at IS NULL
      AND ST_Intersects(existing.geometry,ST_Translate(anchor.geometry,-col*lot_width,north_shift+row_index*lot_height))
      AND ST_Area(ST_Intersection(existing.geometry,
        ST_Translate(anchor.geometry,-col*lot_width,north_shift+row_index*lot_height))::geography)>0.001),
    'Migration 468 proposed row must not overlap existing active lots');

  INSERT INTO lots(cemetery_id,section_uuid,name,facility_id,section_id,block_id,lot_id,
    width_feet,length_feet,geometry,burial_use_status,burial_use_notes,
    geometry_type,geometry_source,geometry_confidence,geometry_notes)
  SELECT anchor.cemetery_id,anchor.section_uuid,grid.name,anchor.facility_id,'D',NULL,grid.lot_id,
    anchor.width_feet,anchor.length_feet,
    ST_Translate(anchor.geometry,-grid.col*lot_width,north_shift+grid.row_index*lot_height),
    CASE WHEN grid.col>=5 THEN 'non_burial' ELSE 'standard' END,
    CASE WHEN grid.col>=5 THEN 'Temporary label only; no official lot number assigned. Cannot contain gravesites or monuments.' END,
    'operational','Migration 468: D-27 footprint extended to two northern rows.','estimated',
    'Southern row is six feet north of the preceding row; the new rows share a border and retain east-west alignment. Temporary western labels are not official lot numbers.'
  FROM (VALUES
    ('26','D-26',0,0),('31','D-31',1,0),('35','D-35',2,0),('50','D-50',3,0),
    ('55','D-55',4,0),('TMP07','D-TEMP-07',5,0),('TMP08','D-TEMP-08',6,0),('TMP09','D-TEMP-09',7,0),
    ('25','D-25',0,1),('32','D-32',1,1),('34','D-34',2,1),('51','D-51',3,1),
    ('54','D-54',4,1),('TMP10','D-TEMP-10',5,1),('TMP11','D-TEMP-11',6,1),('TMP12','D-TEMP-12',7,1)
  ) grid(lot_id,name,col,row_index);
END $$;

-- Recovery uses the pre-migration backup; preserve the owner-directed layout.
--rollback empty
