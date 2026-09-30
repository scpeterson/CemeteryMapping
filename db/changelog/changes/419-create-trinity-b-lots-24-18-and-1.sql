--liquibase formatted sql

--changeset cemeterymapping:419-create-trinity-b-lots-24-18-and-1 splitStatements:false
DO $lots$
DECLARE
  anchor lots%ROWTYPE;
  east_anchor lots%ROWTYPE;
  cemetery_geometry geometry;
  lot_width double precision;
  lot_height double precision;
  gap_latitude double precision;
  north_edge geometry;
  lot_24 geometry;
  lot_18 geometry;
  lot_1 geometry;
  lot_1_box geometry;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lots WHERE facility_id='1' AND section_id='B'
    AND block_id IS NULL AND deleted_at IS NULL) THEN RETURN; END IF;
  SELECT * INTO STRICT anchor FROM lots WHERE facility_id='1' AND section_id='B'
    AND lot_id='23' AND block_id IS NULL AND deleted_at IS NULL;
  SELECT * INTO STRICT east_anchor FROM lots WHERE cemetery_id=anchor.cemetery_id
    AND section_id='B' AND lot_id='2' AND block_id IS NULL AND deleted_at IS NULL;
  SELECT geometry INTO STRICT cemetery_geometry FROM cemeteries
    WHERE id=anchor.cemetery_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(ST_IsValid(anchor.geometry)
    AND ST_Equals(anchor.geometry,ST_Envelope(anchor.geometry))
    AND ST_IsValid(cemetery_geometry), 'Migration 419 requires valid cemetery and rectangular B-23 geometry');
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM lots
    WHERE facility_id='1' AND section_id='B' AND block_id IS NULL AND lot_id IN ('24','18','1')),
    'Migration 419 lot identifiers must be unused, including retired lots');

  lot_width := ST_XMax(Box2D(anchor.geometry))-ST_XMin(Box2D(anchor.geometry));
  lot_height := ST_YMax(Box2D(anchor.geometry))-ST_YMin(Box2D(anchor.geometry));
  north_edge := ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(anchor.geometry)),ST_YMax(Box2D(anchor.geometry))),4326);
  gap_latitude := ST_Y(ST_Project(north_edge::geography,1.8288,0)::geometry)-ST_Y(north_edge);
  lot_24 := ST_Translate(anchor.geometry,0,lot_height+gap_latitude);
  lot_18 := ST_Translate(lot_24,lot_width,0);
  lot_1_box := ST_MakeEnvelope(ST_XMax(Box2D(lot_18)),ST_YMin(Box2D(lot_18)),
    ST_XMax(Box2D(east_anchor.geometry)),ST_YMax(Box2D(lot_18)),4326);
  lot_1 := ST_Multi(ST_CollectionExtract(ST_Intersection(lot_1_box,cemetery_geometry),3));
  PERFORM assert_migration_prerequisite(ST_IsValid(lot_1) AND NOT ST_IsEmpty(lot_1)
    AND ST_NumGeometries(lot_1)=1 AND ST_NumInteriorRings(ST_GeometryN(lot_1,1))=0
    AND ST_NPoints(lot_1)=6,
    'Migration 419 requires a single five-sided B-1 polygon following the cemetery boundary');
  PERFORM assert_migration_prerequisite(ST_Covers(cemetery_geometry,lot_24)
    AND ST_Covers(cemetery_geometry,lot_18)
    AND ST_Covers(lot_1,ST_SetSRID(ST_MakePoint(ST_XMax(Box2D(east_anchor.geometry)),ST_YMin(Box2D(lot_18))),4326))
    AND ST_Length(ST_Intersection(ST_Boundary(lot_1),ST_Boundary(lot_18))) >= lot_height-1e-12
    AND ST_Length(ST_Intersection(ST_Boundary(lot_1),ST_Boundary(cemetery_geometry)))>0,
    'Migration 419 requires full rectangular lots, the shared western B-1 edge, and the requested southeast corner');
  PERFORM assert_migration_prerequisite(NOT EXISTS (SELECT 1 FROM lots existing
    CROSS JOIN (VALUES (lot_24),(lot_18),(lot_1)) proposed(geometry)
    WHERE existing.cemetery_id=anchor.cemetery_id AND existing.deleted_at IS NULL
      AND ST_Area(ST_Intersection(existing.geometry,proposed.geometry))>1e-16),
    'Migration 419 proposed lots must not overlap existing active lots');

  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason','Migration 419: add B-24, B-18 and boundary-shaped B-1 six feet north of B-23.',true);
  INSERT INTO lots (cemetery_id,section_uuid,name,facility_id,section_id,block_id,lot_id,
    width_feet,length_feet,geometry,burial_use_status,geometry_type,geometry_source,geometry_confidence,geometry_notes)
  SELECT anchor.cemetery_id,anchor.section_uuid,'B-'||proposed.lot_id,anchor.facility_id,
    anchor.section_id,NULL,proposed.lot_id,
    CASE WHEN proposed.lot_id='1' THEN round((ST_Distance(
      ST_SetSRID(ST_MakePoint(ST_XMin(Box2D(lot_1)),ST_YMin(Box2D(lot_1))),4326)::geography,
      ST_SetSRID(ST_MakePoint(ST_XMax(Box2D(lot_1)),ST_YMin(Box2D(lot_1))),4326)::geography)/0.3048)::numeric,2)
      ELSE anchor.width_feet END,
    anchor.length_feet,proposed.geometry::geometry(MultiPolygon,4326),'standard','operational',
    'Migration 419: B-23 footprint and current cemetery boundary.','estimated',
    CASE WHEN proposed.lot_id='1' THEN
      'Irregular five-sided lot: west shares B-18 east; south ends at B-2 east alignment; north and east meet the cemetery boundary, which closes the northeast edge. Width is southern-edge span; length is western-edge nominal depth.'
      ELSE 'Standard B-23 footprint; six-foot gap above B-23; B-24 west aligned with B-23 and B-18 immediately east.' END
  FROM (VALUES ('24',lot_24),('18',lot_18),('1',lot_1)) proposed(lot_id,geometry);
END
$lots$;

--rollback empty
