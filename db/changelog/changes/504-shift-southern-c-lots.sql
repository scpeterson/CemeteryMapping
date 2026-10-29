--liquibase formatted sql

--changeset cemeterymapping:504-shift-southern-c-lots splitStatements:false
DO $shift$
DECLARE
 cemetery uuid;
 targets uuid[];
 corridor lots%ROWTYPE;
 section_outline geometry;
 cemetery_outline geometry;
 dy double precision;
 anchors integer;
 north_edge double precision;
 extension geometry;
 proposed geometry;
 other_areas geometry;
 member record;
BEGIN
 SELECT id INTO cemetery FROM cemeteries WHERE facility_id='1' AND deleted_at IS NULL;
 IF cemetery IS NULL OR NOT EXISTS(SELECT 1 FROM lots WHERE cemetery_id=cemetery AND section_id='C' AND deleted_at IS NULL) THEN RETURN; END IF;
 PERFORM 1 FROM lots WHERE cemetery_id=cemetery AND section_id='C' AND deleted_at IS NULL ORDER BY id FOR UPDATE;
 SELECT array_agg(id) INTO targets FROM lots WHERE cemetery_id=cemetery AND section_id='C' AND block_id IS NULL AND deleted_at IS NULL AND area_type='lot'
   AND (lot_id=ANY(ARRAY(SELECT generate_series(41,51)::text)) OR lot_id=ANY(ARRAY(SELECT generate_series(70,90)::text)));
 PERFORM assert_migration_prerequisite(cardinality(targets)=32 AND (SELECT count(DISTINCT lot_id)=32 FROM lots WHERE id=ANY(targets)),
   'Migration 504 requires all 32 southern C lots');
 SELECT * INTO corridor FROM lots WHERE cemetery_id=cemetery AND section_id='C' AND lot_id='P03' AND area_type='passageway' AND deleted_at IS NULL;
 PERFORM assert_migration_prerequisite(corridor.id IS NOT NULL,'Migration 504 requires C-P03');
 SELECT geometry INTO section_outline FROM sections WHERE cemetery_id=cemetery AND name='C' AND deleted_at IS NULL;
 SELECT geometry INTO cemetery_outline FROM cemeteries WHERE id=cemetery;
 PERFORM assert_migration_prerequisite(section_outline IS NOT NULL AND ST_IsValid(section_outline)
   AND ST_IsValid(corridor.geometry) AND NOT ST_IsEmpty(corridor.geometry)
   AND NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(targets) AND (geometry IS NULL OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry)))
   AND NOT EXISTS(SELECT 1 FROM lot_restricted_areas WHERE lot_uuid=ANY(targets) AND deleted_at IS NULL),
   'Migration 504 requires valid outlines and no attached restricted-area polygons');
 SELECT count(*),min(ST_Y(ST_Project(h.geometry::geography,.0254,pi())::geometry)-ST_YMin(Box2D(l.geometry))) INTO anchors,dy
 FROM lots l JOIN headstones h ON h.headstone_id=CASE l.lot_id WHEN '80' THEN 'TLC-HS-0330' ELSE 'TLC-HS-0361' END
 JOIN gravesites g ON g.id=h.gravesite_uuid AND g.cemetery_id=cemetery AND g.deleted_at IS NULL
 WHERE l.id=ANY(targets) AND l.lot_id IN('80','82') AND h.deleted_at IS NULL AND h.geometry IS NOT NULL;
 PERFORM assert_migration_prerequisite(anchors=2 AND dy<0 AND abs(dy)<0.00001,
   'Migration 504 requires both fixed monuments and a south-only shift under four feet');
 PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots l JOIN headstones h ON h.headstone_id=CASE l.lot_id WHEN '80' THEN 'TLC-HS-0330' ELSE 'TLC-HS-0361' END
   WHERE l.id=ANY(targets) AND l.lot_id IN('80','82') AND h.deleted_at IS NULL AND NOT ST_ContainsProperly(ST_Translate(l.geometry,0,dy),h.geometry)),
   'Migration 504 must contain both fixed monument points');
 SELECT max(ST_YMax(Box2D(geometry))) INTO north_edge FROM lots WHERE id=ANY(targets);
 PERFORM assert_migration_prerequisite(abs(north_edge-ST_YMin(Box2D(corridor.geometry)))<1e-8,
   'Migration 504 requires C-P03 directly above the southern rows');
 PERFORM set_config('app.audit.source','migration',true);
 PERFORM set_config('app.audit.reason','User requested 2026-10-29: move the 32 southern C lots south together to contain fixed TLC-HS-0330 in C-80 and TLC-HS-0361 in C-82; expand C-P03 to the moved northern edge; clip non-burial C-85/C-90 to the cemetery boundary as approved; preserve gravesites and ownership.',true);
 FOR member IN SELECT * FROM lots WHERE id=ANY(targets) LOOP
  proposed:=ST_Translate(member.geometry,0,dy);
  IF member.lot_id IN('85','90') THEN
   PERFORM assert_migration_prerequisite(member.burial_use_status='non_burial'
     AND NOT EXISTS(SELECT 1 FROM gravesites WHERE lot_uuid=member.id)
     AND NOT EXISTS(SELECT 1 FROM ownership_event_rights WHERE lot_uuid=member.id)
     AND NOT EXISTS(SELECT 1 FROM lot_ownership_events WHERE lot_uuid=member.id),
     'Migration 504 boundary-clipped C-85/C-90 must remain non-burial and free of grave or ownership dependencies');
   proposed:=ST_Multi(ST_CollectionExtract(ST_Intersection(proposed,cemetery_outline),3));
  END IF;
  PERFORM assert_migration_prerequisite(ST_IsValid(proposed) AND NOT ST_IsEmpty(proposed) AND ST_CoveredBy(proposed,ST_Buffer(section_outline,1e-12)) AND ST_CoveredBy(proposed,ST_Buffer(cemetery_outline,1e-12)),
    'Migration 504 shifted lots must remain inside Section C and the cemetery');
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots other WHERE other.cemetery_id=cemetery AND other.deleted_at IS NULL AND other.id<>corridor.id AND NOT(other.id=ANY(targets))
    AND ST_Area(ST_Intersection(proposed,other.geometry)::geography)>.001),
    'Migration 504 shifted lots must not overlap other areas');
  UPDATE lots SET geometry=proposed,geometry_source='Migration 504: shared southern Section C lot translation.',
   geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),'2026-10-29: moved south with the 32-lot group; fixed monuments and gravesites retained. Non-burial C-85/C-90 clipped to the cemetery boundary as approved.'),updated_at=now() WHERE id=member.id;
 END LOOP;
 -- Add only the strip vacated below C-P03. Retain its northern edge and existing footprint.
 extension:=ST_MakeEnvelope(ST_XMin(Box2D(corridor.geometry)),ST_YMin(Box2D(corridor.geometry))+dy,
   ST_XMax(Box2D(corridor.geometry)),north_edge,4326);
 SELECT ST_UnaryUnion(ST_Collect(geometry)) INTO other_areas FROM lots WHERE cemetery_id=cemetery AND deleted_at IS NULL AND id<>corridor.id;
 proposed:=ST_Multi(ST_CollectionExtract(ST_Difference(ST_Union(corridor.geometry,ST_Intersection(extension,section_outline)),other_areas),3));
 PERFORM assert_migration_prerequisite(ST_IsValid(proposed) AND NOT ST_IsEmpty(proposed)
   AND ST_Area(ST_Difference(corridor.geometry,proposed)::geography)<.000001
   AND abs(ST_YMax(Box2D(proposed))-ST_YMax(Box2D(corridor.geometry)))<1e-12,
   'Migration 504 passageway must expand south while preserving its existing footprint and northern edge');
 UPDATE lots SET geometry=proposed,geometry_source='Migration 504: C-P03 expanded south to meet the moved southern lots.',
  geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),'2026-10-29: southern edge extended to the shifted lot row; existing references and assignments retained.'),updated_at=now() WHERE id=corridor.id;
END
$shift$;

-- Recovery uses the pre-migration backup or a reviewed forward correction.
--rollback empty
