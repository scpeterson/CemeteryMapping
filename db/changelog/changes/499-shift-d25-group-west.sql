--liquibase formatted sql

--changeset cemeterymapping:499-shift-d25-group-west splitStatements:false
DO $shift$
DECLARE
  anchor lots%ROWTYPE;
  target_ids uuid[];
  marker geometry;
  boundary geometry;
  dx double precision;
  shifted geometry;
  member record;
  reason text := 'User requested 2026-10-29: shift D-25/26/31/32/34/35/50/51/54/55 west together to contain fixed TLC-HS-0447 in D-25; retain all other records and restrictions.';
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
    AND lot_id='25' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE facility_id='1'
      AND section_id='D' AND block_id IS NULL AND deleted_at IS NULL),
      'Migration 499 requires the active D-25 anchor');
    RETURN;
  END IF;
  PERFORM 1 FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
    AND lot_id IN('25','26','31','32','34','35','50','51','54','55')
    AND deleted_at IS NULL ORDER BY id FOR UPDATE;
  SELECT array_agg(id) INTO target_ids FROM lots WHERE facility_id='1' AND section_id='D'
    AND block_id IS NULL AND deleted_at IS NULL
    AND lot_id IN('25','26','31','32','34','35','50','51','54','55');
  PERFORM assert_migration_prerequisite(cardinality(target_ids)=10
    AND (SELECT count(DISTINCT lot_id)=10 FROM lots WHERE id=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(target_ids) AND cemetery_id IS DISTINCT FROM anchor.cemetery_id),
    'Migration 499 requires all ten active lots in one cemetery');
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(target_ids)
    AND (geometry IS NULL OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry))),
    'Migration 499 requires valid nonempty target footprints');
  PERFORM assert_migration_prerequisite(
    NOT EXISTS(SELECT 1 FROM gravesites WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lot_ownership_events WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM ownership_event_rights WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lot_restricted_areas WHERE lot_uuid=ANY(target_ids)),
    'Migration 499 targets must have no gravesite, ownership, evidence or restricted-area dependencies');
  SELECT h.geometry INTO marker FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    AND g.cemetery_id=anchor.cemetery_id AND g.deleted_at IS NULL
    WHERE h.headstone_id='TLC-HS-0447' AND h.deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(marker IS NOT NULL AND ST_IsValid(marker) AND NOT ST_IsEmpty(marker),
    'Migration 499 requires active TLC-HS-0447 linked to this cemetery');
  SELECT geometry INTO boundary FROM cemeteries WHERE id=anchor.cemetery_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(boundary IS NOT NULL AND ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary),
    'Migration 499 requires a valid cemetery boundary');
  -- Move only far enough to leave one inch of mapped clearance at the western edge.
  dx:=ST_X(ST_Project(marker::geography,0.0254,3*pi()/2)::geometry)-ST_XMin(Box2D(anchor.geometry));
  PERFORM assert_migration_prerequisite(dx<0 AND ST_ContainsProperly(ST_Translate(anchor.geometry,dx,0),marker),
    'Migration 499 requires a westward-only shift placing the fixed marker strictly inside D-25');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason',reason,true);
  FOR member IN SELECT * FROM lots WHERE id=ANY(target_ids) LOOP
    shifted:=ST_Translate(member.geometry,dx,0);
    PERFORM assert_migration_prerequisite(ST_IsValid(shifted) AND NOT ST_IsEmpty(shifted)
      AND ST_CoveredBy(shifted,ST_Buffer(boundary,1e-12)),
      'Migration 499 shifted lots must remain inside the cemetery');
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots other
      WHERE other.cemetery_id=anchor.cemetery_id AND other.deleted_at IS NULL
      AND NOT(other.id=ANY(target_ids)) AND ST_Intersects(shifted,other.geometry)
      AND ST_Area(ST_Intersection(shifted,other.geometry)::geography)>0.001),
      'Migration 499 shifted group must not overlap other active lots');
    UPDATE lots SET geometry=shifted::geometry(MultiPolygon,4326),
      geometry_source='Migration 499: ten-lot westward translation to contain fixed TLC-HS-0447 in D-25.',
      geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
        '2026-10-29 correction: ten lots moved west together without resizing or changing latitude; TLC-HS-0447 remains fixed with one inch of mapped boundary clearance.'),
      updated_at=now() WHERE id=member.id;
  END LOOP;
END
$shift$;

-- Recovery uses the pre-migration backup or a reviewed forward correction.
--rollback empty
