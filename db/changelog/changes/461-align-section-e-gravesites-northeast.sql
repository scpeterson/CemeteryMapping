--liquibase formatted sql

--changeset cemeterymapping:461-align-section-e-gravesites-northeast splitStatements:false
DO $$
DECLARE
  cemetery uuid;
BEGIN
  SELECT id INTO cemetery FROM cemeteries WHERE facility_id='1' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM gravesites WHERE cemetery_id=cemetery AND section_id='E' AND deleted_at IS NULL) THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(NOT EXISTS(
    SELECT 1 FROM gravesites g WHERE g.cemetery_id=cemetery AND g.section_id='E' AND g.deleted_at IS NULL
      AND (g.geometry IS NULL OR NOT ST_IsValid(g.geometry) OR ST_NumGeometries(g.geometry)<>1
        OR ST_NPoints(ST_ExteriorRing(ST_GeometryN(g.geometry,1)))<>5
        OR (SELECT count(*) FROM headstones h WHERE h.gravesite_uuid=g.id AND h.deleted_at IS NULL)<>1
        OR NOT EXISTS(SELECT 1 FROM headstones h WHERE h.gravesite_uuid=g.id AND h.deleted_at IS NULL AND h.geometry IS NOT NULL))),
    'every active Trinity Section E grave must be a valid rectangle with exactly one mapped active direct monument');

  CREATE TEMP TABLE section_e_alignment_461 ON COMMIT DROP AS
  WITH source AS(
    SELECT g.id,g.gravesite_id,g.cemetery_id,g.geometry old_geometry,h.geometry point,
      ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),1)::geography,
        ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),2)::geography) edge1,
      ST_Distance(ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),2)::geography,
        ST_PointN(ST_ExteriorRing(ST_GeometryN(g.geometry,1)),3)::geography) edge2
    FROM gravesites g JOIN headstones h ON h.gravesite_uuid=g.id AND h.deleted_at IS NULL
    WHERE g.cemetery_id=cemetery AND g.section_id='E' AND g.deleted_at IS NULL
  ), dimensions AS(
    SELECT *,GREATEST(edge1,edge2) length_m,LEAST(edge1,edge2) width_m FROM source
  ), corners AS(
    SELECT *,ST_Project(point::geography,width_m/2,7*pi()/4)::geometry northwest,
      ST_Project(point::geography,width_m/2,3*pi()/4)::geometry southeast FROM dimensions
  )
  SELECT id,gravesite_id,cemetery_id,old_geometry,length_m,width_m,point,
    ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[northwest,southeast,
      ST_Project(southeast::geography,length_m,pi()/4)::geometry,
      ST_Project(northwest::geography,length_m,pi()/4)::geometry,northwest])))::geometry(MultiPolygon,4326) new_geometry
  FROM corners;
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM section_e_alignment_461
    WHERE length_m<=width_m OR width_m<=0 OR NOT ST_IsValid(new_geometry)
      OR abs(ST_Area(old_geometry::geography)-ST_Area(new_geometry::geography))>0.001),
    'aligned Section E polygons must remain valid rectangles preserving their mapped sizes');

  UPDATE gravesites g SET geometry=t.new_geometry,geometry_type='operational',geometry_confidence='estimated',
    geometry_source='Migration 461: owner-directed Section E northeast alignment at true bearing 45 degrees; fixed monument at southwestern short-edge midpoint.',
    geometry_notes=concat_ws(' ',NULLIF(g.geometry_notes,''),
      'Section E alignment correction 2026-10-16: long axis now extends northeast at bearing 45 degrees, with the unchanged associated monument centered on the southwestern short edge. Original mapped long/short edge lengths preserved; stored width_feet/length_feet metadata was not resized. Operational boundaries remain estimated.'),updated_at=now()
  FROM section_e_alignment_461 t WHERE g.id=t.id;

  WITH conflicts AS(
    SELECT a.id,string_agg(DISTINCT b.gravesite_id,', ' ORDER BY b.gravesite_id) neighbors
    FROM gravesites a JOIN section_e_alignment_461 t ON t.id=a.id
    JOIN gravesites b ON b.cemetery_id=a.cemetery_id AND b.id<>a.id AND b.deleted_at IS NULL
      AND b.geometry IS NOT NULL AND ST_Intersects(a.geometry,b.geometry)
    WHERE ST_Area(ST_Intersection(a.geometry,b.geometry)::geography)>0.001 GROUP BY a.id
  )
  UPDATE gravesites g SET geometry_notes=concat_ws(' ',g.geometry_notes,
    'Field review required: aligned operational boundary overlaps '||conflicts.neighbors||'. Monument points and neighboring records were not moved to resolve overlaps.')
    FROM conflicts WHERE g.id=conflicts.id;
END $$;

-- Recovery uses the pre-migration backup; preserve the owner-directed correction.
--rollback empty
