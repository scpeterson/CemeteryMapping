--liquibase formatted sql

--changeset cemeterymapping:460-shift-weitzel-pair-east-south splitStatements:false
DO $$
DECLARE
  marker headstones%ROWTYPE;
  moved geometry(Point,4326);
  dx double precision;
  dy double precision;
  conflict_note text;
BEGIN
  SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0577' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(marker.geometry IS NOT NULL AND marker.data_confidence='low'
    AND (SELECT count(*) FROM gravesites WHERE gravesite_id IN ('TLC-GPS-0577','TLC-GPS-0577-01') AND deleted_at IS NULL)=2
    AND (SELECT count(*) FROM headstone_gravesites hg JOIN gravesites g ON g.id=hg.gravesite_uuid
      WHERE hg.headstone_uuid=marker.id AND hg.deleted_at IS NULL AND g.deleted_at IS NULL
        AND g.gravesite_id IN ('TLC-GPS-0577','TLC-GPS-0577-01'))=2,
    'estimated Weitzel monument and both linked active graves must exist');
  moved := ST_Project(ST_Project(marker.geometry::geography,8*0.3048,pi()/2),1*0.3048,pi())::geometry;
  dx := ST_X(moved)-ST_X(marker.geometry);
  dy := ST_Y(moved)-ST_Y(marker.geometry);
  UPDATE gravesites SET geometry=ST_Translate(geometry,dx,dy),geometry_confidence='estimated',
    status_type_id=(SELECT id FROM gravesite_status_types WHERE code='needs_review'),
    geometry_source='Migration 460: user-directed shift of Weitzel pair 8 feet east and 1 foot south.',
    geometry_notes=concat_ws(' ',NULLIF(geometry_notes,''),
      'Correction 2026-10-16: previous 8-foot westward offset withdrawn by owner. Monument and both polygons translated 8 feet east and 1 foot south. This correction supersedes the earlier 11-feet-north/8-feet-west layout. Estimated boundaries require field review.'),updated_at=now()
    WHERE gravesite_id IN ('TLC-GPS-0577','TLC-GPS-0577-01') AND deleted_at IS NULL;
  FOR conflict_note IN SELECT concat(w.gravesite_id,' overlaps ',g.gravesite_id,' (',g.name,').')
    FROM gravesites w JOIN gravesites g ON g.cemetery_id=w.cemetery_id AND g.deleted_at IS NULL
      AND g.gravesite_id NOT IN ('TLC-GPS-0577','TLC-GPS-0577-01') AND g.geometry IS NOT NULL
    WHERE w.gravesite_id IN ('TLC-GPS-0577','TLC-GPS-0577-01') AND w.deleted_at IS NULL
      AND ST_Intersects(w.geometry,g.geometry)
      AND ST_Area(ST_Intersection(w.geometry,g.geometry)::geography)>0.001
  LOOP
    UPDATE gravesites SET geometry_notes=concat_ws(' ',geometry_notes,'Field review required: '||conflict_note)
      WHERE gravesite_id IN ('TLC-GPS-0577','TLC-GPS-0577-01') AND deleted_at IS NULL;
  END LOOP;
  UPDATE headstones SET geometry=moved,latitude=ST_Y(moved),longitude=ST_X(moved),
    data_confidence='low',review_status='needs_review',
    review_notes='ESTIMATED LOCATION: user correction 2026-10-16 moves the monument and both Weitzel graves 8 feet east and 1 foot south from migration 459. The previous westward offset is withdrawn. Approximate revised position is 10 feet north of TLC-HS-0500. Estimated grave polygons overlap Bonnie Louise Brant and Martha E Traut; neighbors were not moved. Field verification is required. No interments are inferred.',
    source_properties=marker.source_properties || jsonb_build_object(
      'LocationCorrectionHistory',COALESCE(marker.source_properties->'LocationCorrectionHistory','[]'::jsonb)||jsonb_build_array(
        jsonb_build_object('previousGeometry',ST_AsGeoJSON(marker.geometry)::jsonb,'previousEstimate',marker.source_properties->'EstimatedPosition',
          'previousReviewNotes',marker.review_notes,'eastShiftFeet',8,'southShiftFeet',1,'correctedOn','2026-10-16')),
      'EstimatedPosition',jsonb_build_object('referenceMarker','TLC-HS-0500','northOffsetFeet',10,'westOffsetFeet',0,
        'surveyed',false,'confidence','low','approvedOn','2026-10-16',
        'method','Owner-directed translation of migration 459 layout: 8 feet east and 1 foot south; overlaps flagged for field review.')),
    updated_at=now() WHERE id=marker.id;
END $$;

-- Recovery uses the pre-migration backup.
--rollback empty
