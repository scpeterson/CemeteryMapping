--liquibase formatted sql

--changeset cemeterymapping:459-create-weitzel-estimated-gravesite-pair splitStatements:false
DO $$
DECLARE
  marker headstones%ROWTYPE;
  reference headstones%ROWTYPE;
  context gravesites%ROWTYPE;
  revised geometry(Point,4326);
  nw geometry;
  sw geometry;
  north_polygon geometry(MultiPolygon,4326);
  south_polygon geometry(MultiPolygon,4326);
  jerry uuid := gen_random_uuid();
  shirley uuid := gen_random_uuid();
  note text := 'User-approved provisional layout 2026-10-16: Jerry Lee Weitzel south, Shirley Jane Weitzel north. Each grave is estimated 4 feet north-south by 10 feet east-west, extending east from TLC-HS-0577. Monument revised to approximately 11 feet north and 8 feet west of fixed TLC-HS-0500 to avoid existing graves. Photos cannot confirm the westward offset; field measurement is required. Gravesite names are assignments, not confirmation of interment, ownership or reservation. See ADR 0099.';
BEGIN
  SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0577' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT h.* INTO reference FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    WHERE h.headstone_id='TLC-HS-0500' AND h.deleted_at IS NULL
      AND g.gravesite_id='TLC-GPS-0500' AND g.section_id='D' AND g.deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND AND reference.geometry IS NOT NULL,
    'fixed TLC-HS-0500 must belong to active D-0500 and have geometry');
  SELECT * INTO context FROM gravesites WHERE id=reference.gravesite_uuid;
  PERFORM assert_migration_prerequisite(marker.geometry IS NOT NULL
    AND marker.gravesite_uuid IS NULL AND marker.inscription ILIKE '%WEITZEL%'
    AND marker.source_properties->'EstimatedPosition'->>'surveyed'='false'
    AND NOT EXISTS(SELECT 1 FROM headstone_gravesites WHERE headstone_uuid=marker.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM headstone_burials WHERE headstone_uuid=marker.id AND deleted_at IS NULL),
    'Weitzel must remain an unassigned estimated monument with no active burial or gravesite links');
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM gravesites
    WHERE cemetery_id=context.cemetery_id AND (gravesite_id IN ('TLC-GPS-0577','TLC-GPS-0577-01')
      OR (section_id='D' AND grave_id IN ('0577','0577A')))),
    'new D-0577 and D-0577A identifiers must be unused');
  PERFORM assert_migration_prerequisite(EXISTS(SELECT 1 FROM gravesite_status_types WHERE code='needs_review'),
    'needs_review gravesite status must exist');

  revised := ST_Project(ST_Project(reference.geometry::geography,11*0.3048,0),8*0.3048,3*pi()/2)::geometry;
  nw := ST_Project(revised::geography,4*0.3048,0)::geometry;
  sw := ST_Project(revised::geography,4*0.3048,pi())::geometry;
  north_polygon := ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[revised,
    ST_Project(revised::geography,10*0.3048,pi()/2)::geometry,
    ST_Project(nw::geography,10*0.3048,pi()/2)::geometry,nw,revised])));
  south_polygon := ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[sw,
    ST_Project(sw::geography,10*0.3048,pi()/2)::geometry,
    ST_Project(revised::geography,10*0.3048,pi()/2)::geometry,revised,sw])));
  PERFORM assert_migration_prerequisite(ST_IsValid(north_polygon) AND ST_IsValid(south_polygon)
    AND NOT EXISTS(SELECT 1 FROM gravesites g WHERE g.deleted_at IS NULL
      AND g.cemetery_id=context.cemetery_id AND g.geometry IS NOT NULL
      AND (ST_Area(ST_Intersection(g.geometry,north_polygon)::geography)>0.001
        OR ST_Area(ST_Intersection(g.geometry,south_polygon)::geography)>0.001)),
    'both proposed Weitzel graves must be valid and avoid existing active graves');
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM headstones h
    WHERE h.deleted_at IS NULL AND h.id<>marker.id AND h.geometry IS NOT NULL
      AND ST_DWithin(h.geometry::geography,revised::geography,0.15)),
    'revised estimated Weitzel point must not coincide with another monument');

  INSERT INTO gravesites(id,cemetery_id,section_uuid,facility_id,section_id,grave_id,gravesite_id,
    name,width_feet,length_feet,status_type_id,geometry,geometry_type,geometry_source,geometry_confidence,geometry_notes)
  SELECT v.id,context.cemetery_id,context.section_uuid,context.facility_id,'D',v.grave_id,v.public_id,
    v.name,4,10,(SELECT id FROM gravesite_status_types WHERE code='needs_review'),v.polygon,
    'operational','Migration 459: user-approved revised estimated Weitzel layout.','estimated',note
  FROM (VALUES(jerry,'0577','TLC-GPS-0577','Jerry Lee Weitzel',south_polygon),
    (shirley,'0577A','TLC-GPS-0577-01','Shirley Jane Weitzel',north_polygon))v(id,grave_id,public_id,name,polygon);

  UPDATE headstones SET gravesite_uuid=jerry,geometry=revised,latitude=ST_Y(revised),longitude=ST_X(revised),
    data_confidence='low',review_status='needs_review',review_notes=note,
    source_properties=marker.source_properties || jsonb_build_object(
      'PreviousEstimatedPosition',jsonb_build_object('geometry',ST_AsGeoJSON(marker.geometry)::jsonb,
        'estimate',marker.source_properties->'EstimatedPosition','reviewNotes',marker.review_notes),
      'EstimatedPosition',jsonb_build_object('referenceMarker','TLC-HS-0500','northOffsetFeet',11,
        'westOffsetFeet',8,'surveyed',false,'confidence','low','approvedOn','2026-10-16',
        'method','User-approved geometry-compatible revision; westward offset is not established by photos.'),
      'GravesiteAssignments',jsonb_build_object('south','Jerry Lee Weitzel','north','Shirley Jane Weitzel',
        'intermentConfirmed',false)),updated_at=now()
    WHERE id=marker.id;
  INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type,notes)
    VALUES(marker.id,jerry,'primary',note),(marker.id,shirley,'spans',note);
END $$;

-- Recovery uses the pre-migration backup; preserve the approved field correction.
--rollback empty
