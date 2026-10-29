--liquibase formatted sql

--changeset cemeterymapping:497-align-section-d-northern-row splitStatements:false
DO $align$
DECLARE
  a lots%ROWTYPE;
  boundary geometry;
  targets uuid[];
  w double precision;
  south_y double precision;
  north_y double precision;
  dx double precision;
  proposed geometry;
  member record;
  reason text := 'User requested 2026-10-29: align D-53, D-5, D-33, D-TMP14 and D-TMP13 east with the row below; clip D-33 and both temporary lots to the cemetery boundary; prohibit gravesites and monuments only in the temporary lots.';
BEGIN
  SELECT * INTO a FROM lots WHERE facility_id='1' AND section_id='D'
    AND block_id IS NULL AND lot_id='53' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE facility_id='1'
      AND section_id='D' AND block_id IS NULL AND deleted_at IS NULL
      AND lot_id IN('5','33','TMP14','TMP13')), 'Migration 497 requires the D-53 anchor');
    RETURN;
  END IF;
  PERFORM 1 FROM lots WHERE cemetery_id=a.cemetery_id AND facility_id='1' AND section_id='D'
    AND block_id IS NULL AND deleted_at IS NULL
    AND lot_id IN('53','5','33','TMP14','TMP13','54','51','34','32','25') ORDER BY id FOR UPDATE;
  PERFORM assert_migration_prerequisite((SELECT count(*)=10 AND count(DISTINCT lot_id)=10 FROM lots
    WHERE cemetery_id=a.cemetery_id AND facility_id='1' AND section_id='D' AND block_id IS NULL
    AND deleted_at IS NULL AND lot_id IN('53','5','33','TMP14','TMP13','54','51','34','32','25')),
    'Migration 497 requires both complete five-lot rows in one cemetery');
  SELECT array_agg(id) INTO targets FROM lots WHERE cemetery_id=a.cemetery_id AND facility_id='1'
    AND section_id='D' AND block_id IS NULL AND deleted_at IS NULL AND lot_id IN('53','5','33','TMP14','TMP13');
  PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots WHERE id=ANY(targets)
    AND (geometry IS NULL OR ST_IsEmpty(geometry) OR NOT ST_IsValid(geometry))),
    'Migration 497 requires valid nonempty target footprints');
  SELECT geometry INTO boundary FROM cemeteries WHERE id=a.cemetery_id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(boundary IS NOT NULL AND ST_IsValid(boundary) AND NOT ST_IsEmpty(boundary),
    'Migration 497 requires a valid cemetery boundary');
  PERFORM assert_migration_prerequisite(ST_Equals(a.geometry,ST_Envelope(a.geometry)),
    'Migration 497 requires the full rectangular D-53 footprint');
  w:=ST_XMax(Box2D(a.geometry))-ST_XMin(Box2D(a.geometry));
  south_y:=ST_YMin(Box2D(a.geometry)); north_y:=ST_YMax(Box2D(a.geometry));
  SELECT ST_XMin(Box2D(geometry))-ST_XMin(Box2D(a.geometry)) INTO dx FROM lots
    WHERE cemetery_id=a.cemetery_id AND facility_id='1' AND section_id='D' AND block_id IS NULL AND lot_id='54' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(dx>0,'Migration 497 must move the northern row east');
  PERFORM assert_migration_prerequisite(
    NOT EXISTS(SELECT 1 FROM gravesites WHERE lot_uuid=ANY(targets))
    AND NOT EXISTS(SELECT 1 FROM lot_ownership_events WHERE lot_uuid=ANY(targets))
    AND NOT EXISTS(SELECT 1 FROM ownership_event_rights WHERE lot_uuid=ANY(targets))
    AND NOT EXISTS(SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE lot_uuid=ANY(targets))
    AND NOT EXISTS(SELECT 1 FROM lot_restricted_areas WHERE lot_uuid=ANY(targets)),
    'Migration 497 targets must have no gravesite, ownership, evidence or restricted-area dependencies');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason',reason,true);
  FOR member IN
    SELECT t.*,pairs.col,s.geometry reference_geometry FROM
      (VALUES('53','54',0),('5','51',1),('33','34',2),('TMP14','32',3),('TMP13','25',4)) pairs(top_id,bottom_id,col)
      JOIN lots t ON t.id=ANY(targets) AND t.lot_id=pairs.top_id
      JOIN lots s ON s.cemetery_id=a.cemetery_id AND s.facility_id='1' AND s.section_id='D'
        AND s.block_id IS NULL AND s.deleted_at IS NULL AND s.lot_id=pairs.bottom_id
  LOOP
    proposed:=ST_MakeEnvelope(ST_XMin(Box2D(a.geometry))+member.col*w,south_y,
      ST_XMin(Box2D(a.geometry))+(member.col+1)*w,north_y,4326);
    PERFORM assert_migration_prerequisite(
      ST_CoveredBy(member.geometry,ST_Buffer(proposed,1e-11))
      AND abs(ST_XMin(Box2D(member.geometry))-ST_XMin(Box2D(proposed)))<1e-11
      AND abs(ST_YMin(Box2D(member.geometry))-south_y)<1e-11
      AND (member.col>=3 OR ST_HausdorffDistance(member.geometry,proposed)<1e-11),
      'Migration 497 requires the original adjoining northern row');
    proposed:=ST_Translate(proposed,dx,0);
    PERFORM assert_migration_prerequisite(ST_IsValid(member.reference_geometry)
      AND NOT ST_IsEmpty(member.reference_geometry)
      AND abs(ST_XMin(Box2D(proposed))-ST_XMin(Box2D(member.reference_geometry)))<1e-11
      AND abs(ST_XMax(Box2D(proposed))-ST_XMax(Box2D(member.reference_geometry)))<1e-11
      AND ST_YMax(Box2D(member.reference_geometry))<south_y,
      'Migration 497 requires both nominal side edges to align with the southern row');
    IF member.col>=2 THEN
      -- Rebuild the nominal rectangle first; translating an old clipped polygon would retain the old cut.
      PERFORM assert_migration_prerequisite(member.col=2 OR NOT ST_CoveredBy(proposed,boundary),
        'Migration 497 expects both temporary lots to require clipping');
      proposed:=ST_CollectionExtract(ST_Intersection(proposed,boundary),3);
    END IF;
    proposed:=ST_Multi(proposed);
    PERFORM assert_migration_prerequisite(ST_IsValid(proposed) AND NOT ST_IsEmpty(proposed)
      AND ST_Area(proposed::geography)>0 AND ST_CoveredBy(proposed,ST_Buffer(boundary,1e-12)),
      'Migration 497 shifted lots must remain valid and inside the cemetery');
    PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM lots l
      WHERE l.cemetery_id=a.cemetery_id AND l.deleted_at IS NULL AND NOT(l.id=ANY(targets))
      AND ST_Intersects(l.geometry,proposed) AND ST_Area(ST_Intersection(l.geometry,proposed)::geography)>0.001),
      'Migration 497 shifted row must not overlap other active lots');
    UPDATE lots SET geometry=proposed::geometry(MultiPolygon,4326),
      burial_use_status=CASE WHEN member.col>=3 THEN 'non_burial' ELSE burial_use_status END,
      burial_use_notes=CASE WHEN member.col>=3 THEN concat_ws(' ',NULLIF(burial_use_notes,''),
        'User confirmed 2026-10-29: cannot contain gravesites or monuments.') ELSE burial_use_notes END,
      geometry_source='Migration 497: northern D row aligned east; D-33 and temporary lots clipped to boundary.',
      geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
        '2026-10-29 correction: shifted east to align nominal side edges with the row to the south; north/south row placement unchanged.',
        CASE WHEN member.col>=2 THEN 'Clipped from the full nominal rectangle to the cemetery boundary; dimensions remain nominal.' END,
        CASE WHEN member.col>=3 THEN 'Gravesites and monuments prohibited.' END),
      updated_at=now() WHERE id=member.id;
  END LOOP;
END
$align$;

-- Recovery uses the pre-migration backup or a reviewed forward correction.
--rollback empty
