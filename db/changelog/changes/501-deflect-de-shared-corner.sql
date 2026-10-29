--liquibase formatted sql

--changeset cemeterymapping:501-deflect-de-shared-corner splitStatements:false
DO $adjust$
DECLARE
  cemetery uuid;
  d sections%ROWTYPE;
  e sections%ROWTYPE;
  d_ring geometry;
  e_ring geometry;
  old_corner geometry;
  fixed_end geometry;
  midpoint geometry;
  marker_d geometry;
  marker_e geometry;
  new_corner geometry;
  new_d geometry;
  new_e geometry;
BEGIN
  SELECT id INTO cemetery FROM cemeteries WHERE facility_id='1' AND deleted_at IS NULL;
  IF cemetery IS NULL THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM sections WHERE cemetery_id=cemetery AND name IN('D','E') AND deleted_at IS NULL) THEN RETURN; END IF;
  PERFORM 1 FROM sections WHERE cemetery_id=cemetery AND name IN('D','E') AND deleted_at IS NULL ORDER BY section_id FOR UPDATE;
  PERFORM assert_migration_prerequisite((SELECT count(*)=2 AND count(DISTINCT name)=2 FROM sections WHERE cemetery_id=cemetery AND name IN('D','E') AND deleted_at IS NULL),
    'Migration 501 requires both active sections D and E');
  SELECT * INTO d FROM sections WHERE cemetery_id=cemetery AND name='D' AND deleted_at IS NULL;
  SELECT * INTO e FROM sections WHERE cemetery_id=cemetery AND name='E' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(d.geometry IS NOT NULL AND e.geometry IS NOT NULL
    AND ST_IsValid(d.geometry) AND ST_IsValid(e.geometry)
    AND ST_NumGeometries(d.geometry)=1 AND ST_NumGeometries(e.geometry)=1
    AND ST_NumInteriorRings(ST_GeometryN(d.geometry,1))=0 AND ST_NumInteriorRings(ST_GeometryN(e.geometry,1))=0,
    'Migration 501 requires valid single-polygon section outlines without holes');
  d_ring:=ST_ExteriorRing(ST_GeometryN(d.geometry,1));
  e_ring:=ST_ExteriorRing(ST_GeometryN(e.geometry,1));
  old_corner:=ST_PointN(e_ring,7);
  fixed_end:=ST_PointN(e_ring,6);
  PERFORM assert_migration_prerequisite(ST_NPoints(d_ring)=17 AND ST_NPoints(e_ring)=9
    AND ST_Equals(old_corner,ST_PointN(d_ring,5))
    AND ST_Equals(fixed_end,ST_PointN(d_ring,6))
    AND ST_Equals(ST_PointN(e_ring,8),ST_PointN(d_ring,4))
    AND ST_DWithin(old_corner,ST_SetSRID(ST_MakePoint(-80.080469586,40.601603927),4326),1e-11),
    'Migration 501 requires the reviewed shared D/E corner and adjoining vertices');
  SELECT h.geometry INTO marker_d FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    WHERE h.headstone_id='TLC-HS-0577' AND h.deleted_at IS NULL AND g.deleted_at IS NULL AND g.cemetery_id=cemetery;
  SELECT h.geometry INTO marker_e FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    WHERE h.headstone_id='TLC-HS-0554' AND h.deleted_at IS NULL AND g.deleted_at IS NULL AND g.cemetery_id=cemetery;
  PERFORM assert_migration_prerequisite(marker_d IS NOT NULL AND marker_e IS NOT NULL
    AND NOT ST_IsEmpty(marker_d) AND NOT ST_IsEmpty(marker_e),
    'Migration 501 requires both active fixed markers linked to this cemetery');
  midpoint:=ST_LineInterpolatePoint(ST_MakeLine(marker_d,marker_e),0.5);
  PERFORM assert_migration_prerequisite(abs(ST_X(midpoint)-ST_X(fixed_end))>1e-10,
    'Migration 501 cannot project a vertical midpoint line');
  new_corner:=ST_SetSRID(ST_MakePoint(ST_X(old_corner),ST_Y(fixed_end)
    +(ST_Y(midpoint)-ST_Y(fixed_end))*(ST_X(old_corner)-ST_X(fixed_end))/(ST_X(midpoint)-ST_X(fixed_end))),4326);
  PERFORM assert_migration_prerequisite(ST_Y(new_corner)>ST_Y(old_corner)
    AND ST_Distance(new_corner::geography,old_corner::geography)<3.048,
    'Migration 501 requires a north-only corner deflection under ten feet');
  new_d:=ST_Multi(ST_MakePolygon(ST_SetPoint(d_ring,4,new_corner)));
  new_e:=ST_Multi(ST_MakePolygon(ST_SetPoint(e_ring,6,new_corner)));
  PERFORM assert_migration_prerequisite(ST_IsValid(new_d) AND ST_IsValid(new_e)
    AND ST_ContainsProperly(new_d,marker_d) AND ST_ContainsProperly(new_e,marker_e)
    AND NOT ST_Intersects(new_d,marker_e) AND NOT ST_Intersects(new_e,marker_d),
    'Migration 501 must put each fixed marker strictly inside its requested section');
  PERFORM assert_migration_prerequisite(ST_Equals(ST_Union(d.geometry,e.geometry),ST_Union(new_d,new_e))
    AND ST_Area(ST_Intersection(new_d,new_e)::geography)<0.000001,
    'Migration 501 must preserve the combined footprint without gaps or overlaps');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason','User requested 2026-10-29: deflect only the shared D/E southern corner north between fixed TLC-HS-0577 in D and TLC-HS-0554 in E; preserve every other vertex and all markers.',true);
  UPDATE sections SET geometry=new_d,updated_at=now() WHERE section_id=d.section_id;
  UPDATE sections SET geometry=new_e,updated_at=now() WHERE section_id=e.section_id;
END
$adjust$;

-- Recovery uses the pre-migration backup or a reviewed forward correction.
--rollback empty
