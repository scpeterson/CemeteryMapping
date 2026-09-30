--liquibase formatted sql

--changeset cemeterymapping:420-shift-trinity-b-boundary-row-west splitStatements:false
DO $shift$
DECLARE
  old_1 lots%ROWTYPE;
  old_18 lots%ROWTYPE;
  old_24 lots%ROWTYPE;
  outline geometry;
  west_delta double precision;
  reference geometry;
  new_1 geometry;
  new_18 geometry;
  new_24 geometry;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lots WHERE facility_id='1' AND section_id='B'
    AND block_id IS NULL AND deleted_at IS NULL) THEN RETURN; END IF;
  SELECT * INTO STRICT old_1 FROM lots WHERE facility_id='1' AND section_id='B'
    AND lot_id='1' AND block_id IS NULL AND deleted_at IS NULL;
  SELECT * INTO STRICT old_18 FROM lots WHERE cemetery_id=old_1.cemetery_id AND section_id='B'
    AND lot_id='18' AND block_id IS NULL AND deleted_at IS NULL;
  SELECT * INTO STRICT old_24 FROM lots WHERE cemetery_id=old_1.cemetery_id AND section_id='B'
    AND lot_id='24' AND block_id IS NULL AND deleted_at IS NULL;
  SELECT geometry INTO STRICT outline FROM cemeteries WHERE id=old_1.cemetery_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(ST_IsValid(outline)
    AND ST_IsValid(old_1.geometry) AND ST_NPoints(old_1.geometry)=6
    AND ST_Equals(old_18.geometry,ST_Envelope(old_18.geometry))
    AND ST_Equals(old_24.geometry,ST_Envelope(old_24.geometry))
    AND abs(ST_XMax(Box2D(old_18.geometry))-ST_XMin(Box2D(old_1.geometry)))<1e-12,
    'Migration 420 requires the established boundary row and valid cemetery geometry');

  -- A constant longitude translation keeps latitude, footprint, and southern
  -- edge length unchanged. Convert two feet due west at B-1's southern midpoint.
  reference := ST_SetSRID(ST_MakePoint((ST_XMin(Box2D(old_1.geometry))+ST_XMax(Box2D(old_1.geometry)))/2,
    ST_YMin(Box2D(old_1.geometry))),4326);
  west_delta := ST_X(ST_Project(reference::geography,0.6096,radians(270))::geometry)-ST_X(reference);
  new_18 := ST_Translate(old_18.geometry,west_delta,0);
  new_24 := ST_Translate(old_24.geometry,west_delta,0);
  new_1 := ST_Multi(ST_CollectionExtract(ST_Intersection(outline,
    ST_MakeEnvelope(ST_XMin(Box2D(old_1.geometry))+west_delta,ST_YMin(Box2D(old_1.geometry)),
      ST_XMax(Box2D(old_1.geometry))+west_delta,ST_YMax(Box2D(old_1.geometry)),4326)),3));
  PERFORM assert_migration_prerequisite(ST_IsValid(new_1) AND NOT ST_IsEmpty(new_1)
    AND ST_NumGeometries(new_1)=1 AND ST_NumInteriorRings(ST_GeometryN(new_1,1))=0
    AND ST_NPoints(new_1)=6
    AND abs(ST_XMin(Box2D(new_1))-(ST_XMin(Box2D(old_1.geometry))+west_delta))<1e-12
    AND abs(ST_XMax(Box2D(new_1))-(ST_XMax(Box2D(old_1.geometry))+west_delta))<1e-12
    AND ST_YMin(Box2D(new_1))=ST_YMin(Box2D(old_1.geometry))
    AND ST_YMax(Box2D(new_1))=ST_YMax(Box2D(old_1.geometry))
    AND ST_Length(ST_Intersection(ST_Boundary(new_1),ST_Boundary(new_18))) >=
      ST_YMax(Box2D(old_1.geometry))-ST_YMin(Box2D(old_1.geometry))-1e-12
    AND ST_Length(ST_Intersection(ST_Boundary(new_1),ST_Buffer(ST_Boundary(outline),1e-12)))>1e-5,
    'Migration 420 must preserve B-1 southern and western edges and its five-sided boundary shape');
  PERFORM assert_migration_prerequisite((SELECT count(*)=2 AND bool_and(COALESCE(ST_Contains(new_1,geometry),false))
    FROM headstones WHERE headstone_id IN ('TLC-HS-0138','TLC-HS-0139') AND deleted_at IS NULL),
    'Migration 420 must contain both TLC-HS-0138 and TLC-HS-0139 strictly inside B-1');
  PERFORM assert_migration_prerequisite(ST_Covers(outline,new_18) AND ST_Covers(outline,new_24)
    AND NOT EXISTS (SELECT 1 FROM lots existing
      CROSS JOIN (VALUES (new_1),(new_18),(new_24)) proposed(geometry)
      WHERE existing.cemetery_id=old_1.cemetery_id AND existing.deleted_at IS NULL
        AND existing.id NOT IN (old_1.id,old_18.id,old_24.id)
        AND ST_Area(ST_Intersection(existing.geometry,proposed.geometry))>1e-16),
    'Migration 420 shifted lots must remain inside the cemetery without overlapping existing lots');

  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason','Migration 420: shift B-24, B-18, B-1 two feet west to contain markers 0138 and 0139; retain cemetery boundary.',true);
  UPDATE lots SET geometry=proposed.geometry::geometry(MultiPolygon,4326),
    geometry_source='Migration 420: two-foot westward row shift with B-1 cemetery-boundary clipping.',
    geometry_notes=CASE WHEN lots.id=old_1.id THEN
      'Five-sided B-1 shifted west: southern and western edges retain their lengths; north and east meet the unchanged cemetery boundary. TLC-HS-0138 and TLC-HS-0139 are inside; southern span and nominal western depth remain unchanged.'
      ELSE 'Standard footprint translated two feet west with the B-24/B-18/B-1 row; latitude and dimensions unchanged.' END,
    updated_at=now()
  FROM (VALUES (old_1.id,new_1),(old_18.id,new_18),(old_24.id,new_24)) proposed(id,geometry)
  WHERE lots.id=proposed.id;
END
$shift$;

--rollback empty
