--liquibase formatted sql

--changeset cemeterymapping:470-create-section-d-boundary-lot-row splitStatements:false
DO $$
DECLARE
  anchor lots%ROWTYPE;
  cemetery_geometry geometry;
  w double precision;
  dy double precision;
  dx double precision;
  proposed geometry;
  col integer;
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D'
    AND lot_id='25' AND block_id IS NULL AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT geometry INTO STRICT cemetery_geometry FROM cemeteries WHERE id=anchor.cemetery_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(ST_IsValid(cemetery_geometry) AND NOT ST_IsEmpty(cemetery_geometry),
    'Migration 470 requires a valid cemetery boundary');
  PERFORM assert_migration_prerequisite(
    (SELECT count(*)=8 FROM lots WHERE cemetery_id=anchor.cemetery_id AND section_id='D'
      AND block_id IS NULL AND deleted_at IS NULL AND lot_id IN ('25','32','34','51','54','TMP10','TMP11','TMP12')),
    'Migration 470 requires the complete preceding row');
  PERFORM assert_migration_prerequisite(ST_IsValid(anchor.geometry)
    AND ST_Equals(anchor.geometry,ST_Envelope(anchor.geometry)),
    'Migration 470 requires a rectangular D-25 footprint');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id=anchor.facility_id AND section_id='D' AND block_id IS NULL
      AND lot_id IN ('TMP13','TMP14','33','5','53','TMP15','TMP16','TMP17')),
    'Migration 470 destination identifiers must be unused, including retired lots');
  w := ST_XMax(anchor.geometry)-ST_XMin(anchor.geometry);
  dy := ST_Y(ST_Project(ST_SetSRID(ST_MakePoint(ST_XMax(anchor.geometry),ST_YMax(anchor.geometry)),4326)::geography,
    6*0.3048,0)::geometry)-ST_YMin(anchor.geometry);
  dx := ST_X(ST_Project(ST_Centroid(anchor.geometry)::geography,6.7*0.3048,3*pi()/2)::geometry)
    -ST_X(ST_Centroid(anchor.geometry));

  FOR col IN 0..7 LOOP
    proposed := ST_Translate(anchor.geometry,dx-col*w,dy);
    IF col<2 THEN
      PERFORM assert_migration_prerequisite(NOT ST_CoveredBy(proposed,cemetery_geometry),
        'Migration 470 expects the two eastern lots to need clipping');
      proposed := ST_Multi(ST_CollectionExtract(ST_Intersection(proposed,cemetery_geometry),3));
    END IF;
    PERFORM assert_migration_prerequisite(ST_IsValid(proposed) AND NOT ST_IsEmpty(proposed)
      AND ST_Area(proposed::geography)>0
      AND ST_CoveredBy(proposed,CASE WHEN col<2 THEN ST_Buffer(cemetery_geometry,1e-12) ELSE cemetery_geometry END),
      'Migration 470 all lots must fit within the cemetery; only eastern TMP lots may be clipped');
    PERFORM assert_migration_prerequisite(NOT EXISTS (
      SELECT 1 FROM lots WHERE cemetery_id=anchor.cemetery_id AND deleted_at IS NULL
      AND ST_Intersects(geometry,proposed)
      AND ST_Area(ST_Intersection(geometry,proposed)::geography)>0.001),
      'Migration 470 proposed row must not overlap existing lots');
  END LOOP;

  INSERT INTO lots(cemetery_id,section_uuid,name,facility_id,section_id,block_id,lot_id,
    width_feet,length_feet,geometry,burial_use_status,burial_use_notes,
    geometry_type,geometry_source,geometry_confidence,geometry_notes)
  SELECT anchor.cemetery_id,anchor.section_uuid,grid.name,anchor.facility_id,'D',NULL,grid.lot_id,
    anchor.width_feet,anchor.length_feet,
    CASE WHEN grid.col<2 THEN ST_Multi(ST_CollectionExtract(
      ST_Intersection(ST_Translate(anchor.geometry,dx-grid.col*w,dy),cemetery_geometry),3))
      ELSE ST_Translate(anchor.geometry,dx-grid.col*w,dy) END,
    CASE WHEN grid.col>=5 THEN 'non_burial' ELSE 'standard' END,
    CASE WHEN grid.col>=5 THEN 'Temporary label only; no official lot number assigned. Cannot contain gravesites or monuments.'
      WHEN grid.col<2 THEN 'Temporary label only; no official lot number assigned. Boundary-clipped lot.' END,
    'operational','Migration 470: D-25 footprint extended north, shifted west, and clipped to cemetery boundary.','estimated',
    CASE WHEN grid.col<2 THEN 'Actual footprint clipped to cemetery boundary; dimensions describe the nominal uncut lot. '
      ELSE '' END ||'Southern border six feet north of preceding row; new row shifted 6.7 feet west. Temporary labels are not official numbers.'
  FROM (VALUES ('TMP13','D-TEMP-13',0),('TMP14','D-TEMP-14',1),('33','D-33',2),('5','D-5',3),
    ('53','D-53',4),('TMP15','D-TEMP-15',5),('TMP16','D-TEMP-16',6),('TMP17','D-TEMP-17',7))
    grid(lot_id,name,col);
END $$;

-- Recovery uses the pre-migration backup; preserve the owner-directed layout.
--rollback empty
