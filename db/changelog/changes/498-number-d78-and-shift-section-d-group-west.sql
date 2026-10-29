--liquibase formatted sql

--changeset cemeterymapping:498-number-d78-and-shift-section-d-group-west splitStatements:false
DO $shift$
DECLARE
  anchor lots%ROWTYPE;
  target_ids uuid[];
  marker geometry;
  boundary geometry;
  dx double precision;
  shifted geometry;
  member record;
  reason text := 'User confirmed 2026-10-29: rename D-TMP01 to D-78 and enable standard burial use; shift D-27/28/29/30/36/37/48/49/56/57, former TMP01 and TMP02 west together to contain TLC-HS-0496. Keep retired TMP03 unchanged.';
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
    AND lot_id='TMP01' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE facility_id='1'
      AND section_id='D' AND block_id IS NULL AND deleted_at IS NULL),
      'Migration 498 requires the active D-TMP01 anchor');
    RETURN;
  END IF;
  PERFORM 1 FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
    AND lot_id IN('27','28','29','30','36','37','48','49','56','57','TMP01','TMP02')
    AND deleted_at IS NULL ORDER BY id FOR UPDATE;
  SELECT array_agg(id) INTO target_ids FROM lots WHERE facility_id='1' AND section_id='D'
    AND block_id IS NULL AND deleted_at IS NULL
    AND lot_id IN('27','28','29','30','36','37','48','49','56','57','TMP01','TMP02');
  PERFORM assert_migration_prerequisite(cardinality(target_ids)=12
    AND (SELECT count(DISTINCT lot_id)=12 FROM lots WHERE id=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(target_ids) AND cemetery_id IS DISTINCT FROM anchor.cemetery_id),
    'Migration 498 requires all twelve active lots in one cemetery');
  PERFORM assert_migration_prerequisite(
    (SELECT max(lot_id::integer)=77 FROM lots WHERE cemetery_id=anchor.cemetery_id
      AND section_id='D' AND block_id IS NULL AND lot_id ~ '^[0-9]+$')
    AND NOT EXISTS(SELECT 1 FROM lots WHERE cemetery_id=anchor.cemetery_id AND section_id='D'
      AND block_id IS NULL AND (lot_id='78' OR name='D-78')),
    'Migration 498 requires D-78 to be the next unused Section D number, including retired history');
  PERFORM assert_migration_prerequisite(anchor.burial_use_status='non_burial'
    AND EXISTS(SELECT 1 FROM lots WHERE cemetery_id=anchor.cemetery_id AND facility_id='1'
      AND section_id='D' AND block_id IS NULL AND lot_id='TMP03' AND deleted_at IS NOT NULL),
    'Migration 498 requires non-burial D-TMP01 and retained retired D-TMP03');
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(target_ids)
    AND (geometry IS NULL OR NOT ST_IsValid(geometry) OR ST_IsEmpty(geometry))),
    'Migration 498 requires valid nonempty target footprints');
  PERFORM assert_migration_prerequisite(
    NOT EXISTS(SELECT 1 FROM gravesites WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lot_ownership_events WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM ownership_event_rights WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS(SELECT 1 FROM lot_restricted_areas WHERE lot_uuid=ANY(target_ids)),
    'Migration 498 targets must have no gravesite, ownership, evidence or restricted-area dependencies');
  SELECT h.geometry INTO marker FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid
    AND g.cemetery_id=anchor.cemetery_id AND g.deleted_at IS NULL
    WHERE h.headstone_id='TLC-HS-0496' AND h.deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(marker IS NOT NULL AND ST_IsValid(marker) AND NOT ST_IsEmpty(marker),
    'Migration 498 requires active TLC-HS-0496 linked to this cemetery');
  SELECT geometry INTO boundary FROM cemeteries WHERE id=anchor.cemetery_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(boundary IS NOT NULL AND ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary),
    'Migration 498 requires a valid cemetery boundary');
  -- Move only far enough to leave one inch of mapped clearance at the western edge.
  dx:=ST_X(ST_Project(marker::geography,0.0254,3*pi()/2)::geometry)-ST_XMin(Box2D(anchor.geometry));
  PERFORM assert_migration_prerequisite(dx<0 AND ST_ContainsProperly(ST_Translate(anchor.geometry,dx,0),marker),
    'Migration 498 requires a westward-only shift placing the fixed marker strictly inside D-78');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason',reason,true);
  FOR member IN SELECT * FROM lots WHERE id=ANY(target_ids) LOOP
    shifted:=ST_Translate(member.geometry,dx,0);
    PERFORM assert_migration_prerequisite(ST_IsValid(shifted) AND NOT ST_IsEmpty(shifted)
      AND ST_CoveredBy(shifted,ST_Buffer(boundary,1e-12)),
      'Migration 498 shifted lots must remain inside the cemetery');
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots other
      WHERE other.cemetery_id=anchor.cemetery_id AND other.deleted_at IS NULL
      AND NOT(other.id=ANY(target_ids)) AND ST_Intersects(shifted,other.geometry)
      AND ST_Area(ST_Intersection(shifted,other.geometry)::geography)>0.001),
      'Migration 498 shifted group must not overlap other active lots');
    UPDATE lots SET geometry=shifted::geometry(MultiPolygon,4326),
      lot_id=CASE WHEN id=anchor.id THEN '78' ELSE lot_id END,
      name=CASE WHEN id=anchor.id THEN 'D-78' ELSE name END,
      burial_use_status=CASE WHEN id=anchor.id THEN 'standard' ELSE burial_use_status END,
      burial_use_notes=CASE WHEN id=anchor.id THEN
        'User confirmed 2026-10-29: D-78, formerly D-TMP01 / D-TEMP-01, is a standard lot; previous non-burial restriction removed.' ELSE burial_use_notes END,
      geometry_source='Migration 498: twelve-lot westward translation to contain fixed TLC-HS-0496 in D-78.',
      geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
        '2026-10-29 correction: twelve lots moved west together without resizing or changing latitude; TLC-HS-0496 remains fixed with one inch of mapped boundary clearance.',
        CASE WHEN id=anchor.id THEN 'Former D-TMP01 / D-TEMP-01 renumbered D-78 with standard burial use; earlier temporary non-burial notes are historical.' END),
      updated_at=now() WHERE id=member.id;
  END LOOP;
END
$shift$;

-- Recovery uses the pre-migration backup or a reviewed forward correction.
--rollback empty
