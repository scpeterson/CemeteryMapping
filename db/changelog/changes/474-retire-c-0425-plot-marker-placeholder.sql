--liquibase formatted sql

--changeset cemeterymapping:474-retire-c-0425-plot-marker-placeholder splitStatements:false
DO $$
DECLARE
  grave gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  reason text := 'C-0425 is a plot-marker import placeholder, not a burial space; preserve standalone TLC-HS-0425 and its observed location.';
BEGIN
  SELECT * INTO grave FROM gravesites WHERE gravesite_id='TLC-GPS-0425' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0425' AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(
    grave.section_id='C' AND grave.name='Plot marker, W' AND marker.id IS NOT NULL
    AND marker.gravesite_uuid=grave.id AND marker.geometry IS NOT NULL
    AND (btrim(marker.inscription)='W' OR (NULLIF(btrim(marker.inscription),'') IS NULL
      AND marker.source_properties->>'Person1Last'='Plot marker, W'
      AND marker.source_properties#>>'{ShapefileGeometryUpdate,source}'='TrinityCemeteryFinal3.shp'
      AND marker.source_properties#>>'{ShapefileGeometryUpdate,shapefileName}'='Plot marker, W'
      AND marker.source_properties#>>'{ShapefileGeometryUpdate,matchConfidence}'='high'))
    AND EXISTS(SELECT 1 FROM headstone_gravesites WHERE headstone_uuid=marker.id
      AND gravesite_uuid=grave.id AND deleted_at IS NULL),
    'Migration 474 requires the C-0425 placeholder and its active W plot marker');
  PERFORM assert_migration_prerequisite(
    NOT EXISTS(SELECT 1 FROM burials b WHERE b.gravesite_uuid=grave.id AND b.deleted_at IS NULL
      AND NOT (b.full_name IS NOT DISTINCT FROM 'Plot marker, W'
        AND b.last_name IS NOT DISTINCT FROM 'Plot marker, W' AND NULLIF(btrim(b.first_name),'') IS NULL
        AND b.birth_date IS NULL AND b.death_date IS NULL AND b.burial_date IS NULL
        AND NULLIF(btrim(b.birth_date_text),'') IS NULL AND NULLIF(btrim(b.death_date_text),'') IS NULL))
    AND NOT EXISTS(SELECT 1 FROM headstones WHERE gravesite_uuid=grave.id AND id<>marker.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM headstone_gravesites WHERE gravesite_uuid=grave.id AND headstone_uuid<>marker.id AND deleted_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid
      WHERE hb.deleted_at IS NULL AND ((hb.headstone_uuid=marker.id AND b.deleted_at IS NULL
        AND b.gravesite_uuid IS DISTINCT FROM grave.id)
        OR (b.gravesite_uuid=grave.id AND hb.headstone_uuid<>marker.id))),
    'Migration 474 requires no real burial or conflicting marker relationships; reconcile later evidence first');

  UPDATE headstone_burials hb SET deleted_at=now(),deleted_by=NULL,delete_reason=reason
  FROM burials b WHERE hb.burial_uuid=b.id AND b.gravesite_uuid=grave.id AND hb.deleted_at IS NULL;
  UPDATE burials SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now()
  WHERE gravesite_uuid=grave.id AND deleted_at IS NULL;
  UPDATE headstone_gravesites SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now()
  WHERE gravesite_uuid=grave.id AND deleted_at IS NULL;
  UPDATE headstones SET gravesite_uuid=NULL,updated_at=now() WHERE id=marker.id;
  UPDATE gravesites SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now() WHERE id=grave.id;
END $$;

-- Preserve marker/evidence history; recovery uses a backup or reviewed forward correction.
--rollback empty
