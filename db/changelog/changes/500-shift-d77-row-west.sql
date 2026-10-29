--liquibase formatted sql

--changeset cemeterymapping:500-shift-d77-row-west splitStatements:false
DO $shift$
DECLARE
  anchor lots%ROWTYPE;
  target_ids uuid[];
  marker geometry;
  second_marker geometry;
  second_lot geometry;
  boundary geometry;
  dx double precision;
  shifted geometry;
  member record;
  reason text := 'User requested 2026-10-29: shift D-77/67/68/58/47/38 west together to contain fixed TLC-HS-0500 in D-77 and TLC-HS-0463 in D-38; retain all other records and restrictions.';
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
    AND lot_id='77' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE facility_id='1'
      AND section_id='D' AND block_id IS NULL AND deleted_at IS NULL),
      'Migration 500 requires the active D-77 anchor');
    RETURN;
  END IF;
  PERFORM 1 FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
    AND lot_id IN('77','67','68','58','47','38')
    AND deleted_at IS NULL ORDER BY id FOR UPDATE;
  SELECT array_agg(id) INTO target_ids FROM lots WHERE facility_id='1' AND section_id='D'
    AND block_id IS NULL AND deleted_at IS NULL
    AND lot_id IN('77','67','68','58','47','38');
  PERFORM assert_migration_prerequisite(cardinality(target_ids)=6
    AND (SELECT count(DISTINCT lot_id)=6 FROM lots WHERE id=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(target_ids) AND cemetery_id IS DISTINCT FROM anchor.cemetery_id),
    'Migration 500 requires all six active lots in one cemetery');
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(target_ids)
    AND (geometry IS NULL OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry))),
    'Migration 500 requires valid nonempty target footprints');
  PERFORM assert_migration_prerequisite(
    NOT EXISTS(SELECT 1 FROM gravesites WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lot_ownership_events WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM ownership_event_rights WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lot_restricted_areas WHERE lot_uuid=ANY(target_ids)),
    'Migration 500 targets must have no gravesite, ownership, evidence or restricted-area dependencies');
  SELECT h.geometry INTO marker FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    AND g.cemetery_id=anchor.cemetery_id AND g.deleted_at IS NULL
    WHERE h.headstone_id='TLC-HS-0500' AND h.deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(marker IS NOT NULL AND ST_IsValid(marker) AND NOT ST_IsEmpty(marker),
    'Migration 500 requires active TLC-HS-0500 linked to this cemetery');
  SELECT h.geometry INTO second_marker FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    AND g.cemetery_id=anchor.cemetery_id AND g.deleted_at IS NULL
    WHERE h.headstone_id='TLC-HS-0463' AND h.deleted_at IS NULL;
  SELECT geometry INTO second_lot FROM lots WHERE id=ANY(target_ids) AND lot_id='38';
  PERFORM assert_migration_prerequisite(second_marker IS NOT NULL AND ST_IsValid(second_marker) AND NOT ST_IsEmpty(second_marker),
    'Migration 500 requires active TLC-HS-0463 linked to this cemetery');
  SELECT geometry INTO boundary FROM cemeteries WHERE id=anchor.cemetery_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(boundary IS NOT NULL AND ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary),
    'Migration 500 requires a valid cemetery boundary');
  -- Move only far enough to leave one inch of mapped clearance at the western edge.
  dx:=ST_X(ST_Project(marker::geography,0.0254,3*pi()/2)::geometry)-ST_XMin(Box2D(anchor.geometry));
  PERFORM assert_migration_prerequisite(dx<0 AND ST_ContainsProperly(ST_Translate(anchor.geometry,dx,0),marker),
    'Migration 500 requires a westward-only shift placing the fixed marker strictly inside D-77');
  PERFORM assert_migration_prerequisite(ST_ContainsProperly(ST_Translate(second_lot,dx,0),second_marker),
    'Migration 500 shared westward shift must also contain TLC-HS-0463 strictly inside D-38');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason',reason,true);
  FOR member IN SELECT * FROM lots WHERE id=ANY(target_ids) LOOP
    shifted:=ST_Translate(member.geometry,dx,0);
    PERFORM assert_migration_prerequisite(ST_IsValid(shifted) AND NOT ST_IsEmpty(shifted)
      AND ST_CoveredBy(shifted,ST_Buffer(boundary,1e-12)),
      'Migration 500 shifted lots must remain inside the cemetery');
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots other
      WHERE other.cemetery_id=anchor.cemetery_id AND other.deleted_at IS NULL
      AND NOT(other.id=ANY(target_ids)) AND ST_Intersects(shifted,other.geometry)
      AND ST_Area(ST_Intersection(shifted,other.geometry)::geography)>0.001),
      'Migration 500 shifted group must not overlap other active lots');
    UPDATE lots SET geometry=shifted::geometry(MultiPolygon,4326),
      geometry_source='Migration 500: six-lot westward translation to contain fixed TLC-HS-0500 in D-77 and fixed TLC-HS-0463 in D-38.',
      geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
        '2026-10-29 correction: six lots moved west together without resizing or changing latitude; Both markers remain fixed; TLC-HS-0500 has one inch of mapped boundary clearance in D-77 and TLC-HS-0463 is strictly inside D-38.'),
      updated_at=now() WHERE id=member.id;
  END LOOP;
END
$shift$;

-- Recovery uses the pre-migration backup or a reviewed forward correction.
--rollback empty
