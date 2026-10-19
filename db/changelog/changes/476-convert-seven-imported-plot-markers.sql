--liquibase formatted sql

--changeset cemeterymapping:476-convert-seven-imported-plot-markers splitStatements:false
-- Dates are inferred from the nearest photographed marker's capture date (America/New_York).
-- Preserve standalone marker geometry, evidence and history; remove only false burial spaces.
DO $$
DECLARE
  target record;
  marker headstones%ROWTYPE;
  grave gravesites%ROWTYPE;
  reason text := 'Imported plot-marker label is not a person or burial space; preserve standalone plot marker.';
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('TLC-HS-0563','TLC-GPS-0563','H',DATE '2026-09-17','TLC-HS-0134'),
    ('TLC-HS-0154','TLC-GPS-0154','W',DATE '2026-08-10','TLC-HS-0424'),
    ('TLC-HS-0158','TLC-GPS-0158','S',DATE '2026-07-24','TLC-HS-0303'),
    ('TLC-HS-0425','TLC-GPS-0425','W',DATE '2026-08-10','TLC-HS-0365'),
    ('TLC-HS-0431','TLC-GPS-0431','B',DATE '2026-08-08','TLC-HS-0346'),
    ('TLC-HS-0433','TLC-GPS-0433','B',DATE '2026-08-08','TLC-HS-0321'),
    ('TLC-HS-0435','TLC-GPS-0435','K',DATE '2026-06-15','TLC-HS-0289')
  ) AS targets(marker_id,grave_id,letter,inspection_date,nearest_marker)
  LOOP
    SELECT * INTO marker FROM headstones WHERE headstone_id=target.marker_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
      PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM gravesites WHERE gravesite_id=target.grave_id AND deleted_at IS NULL), 'Plot-marker gravesite requires its active marker: '||target.marker_id);
      CONTINUE;
    END IF;
    PERFORM assert_migration_prerequisite(marker.geometry IS NOT NULL, 'Plot marker must retain observed geometry: '||target.marker_id);
    SELECT * INTO grave FROM gravesites WHERE gravesite_id=target.grave_id;
    PERFORM assert_migration_prerequisite(grave.id IS NOT NULL AND lower(grave.name)='plot marker, '||lower(target.letter), 'Expected imported plot-marker label: '||target.marker_id);
    PERFORM assert_migration_prerequisite(marker.gravesite_uuid IS NULL OR marker.gravesite_uuid=grave.id,'Unexpected primary gravesite: '||target.marker_id);
    PERFORM assert_migration_prerequisite(
      NOT EXISTS(SELECT 1 FROM burials b WHERE b.gravesite_uuid=grave.id AND b.deleted_at IS NULL AND NOT (
        lower(b.full_name) IS NOT DISTINCT FROM lower(grave.name) AND lower(b.last_name) IS NOT DISTINCT FROM lower(grave.name)
        AND NULLIF(btrim(b.first_name),'') IS NULL AND b.birth_date IS NULL AND b.death_date IS NULL AND b.burial_date IS NULL
        AND NULLIF(btrim(b.birth_date_text),'') IS NULL AND NULLIF(btrim(b.death_date_text),'') IS NULL))
      AND NOT EXISTS(SELECT 1 FROM headstones WHERE gravesite_uuid=grave.id AND id<>marker.id AND deleted_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM headstone_gravesites WHERE deleted_at IS NULL AND
        ((gravesite_uuid=grave.id AND headstone_uuid<>marker.id) OR (headstone_uuid=marker.id AND gravesite_uuid<>grave.id)))
      AND NOT EXISTS(SELECT 1 FROM headstone_burials hb JOIN burials b ON b.id=hb.burial_uuid WHERE hb.deleted_at IS NULL AND
        ((hb.headstone_uuid=marker.id AND b.deleted_at IS NULL AND b.gravesite_uuid IS DISTINCT FROM grave.id) OR (b.gravesite_uuid=grave.id AND hb.headstone_uuid<>marker.id))),
      'Plot marker has real burial or conflicting relationships: '||target.marker_id);
    PERFORM assert_migration_prerequisite(
      EXISTS(SELECT 1 FROM marker_types WHERE code='plot_marker') AND EXISTS(SELECT 1 FROM marker_scope_types WHERE code='plot_marker')
      AND EXISTS(SELECT 1 FROM marker_material_types WHERE code='white_marble'), 'Required plot-marker lookup values');
    UPDATE headstone_burials hb SET deleted_at=now(),delete_reason=reason FROM burials b
      WHERE hb.burial_uuid=b.id AND b.gravesite_uuid=grave.id AND hb.deleted_at IS NULL;
    UPDATE burials SET deleted_at=now(),delete_reason=reason,updated_at=now() WHERE gravesite_uuid=grave.id AND deleted_at IS NULL;
    UPDATE headstone_gravesites SET deleted_at=now(),delete_reason=reason,updated_at=now() WHERE gravesite_uuid=grave.id AND deleted_at IS NULL;
    UPDATE headstones SET gravesite_uuid=NULL,
      marker_type_id=(SELECT id FROM marker_types WHERE code='plot_marker'),
      marker_scope_type_id=(SELECT id FROM marker_scope_types WHERE code='plot_marker'),
      material_type_id=(SELECT id FROM marker_material_types WHERE code='white_marble'),
      inscription=target.letter,
      faces=CASE WHEN jsonb_array_length(COALESCE(faces,'[]'::jsonb))=0 THEN jsonb_build_array(jsonb_build_object(
        'id',gen_random_uuid()::text,'label','Unspecified face','notes','','burialIds','[]'::jsonb,'inscription',target.letter,'mediaAssetIds','[]'::jsonb))
        ELSE (SELECT jsonb_agg(face||jsonb_build_object('inscription',target.letter,'burialIds','[]'::jsonb)) FROM jsonb_array_elements(faces) face) END,
      faces_revision=faces_revision+1,last_inspected_at=target.inspection_date,
      source_properties=source_properties||jsonb_build_object('PlotMarkerInspectionDateBasis',jsonb_build_object(
        'basis','Inferred from nearest photographed marker capture date in America/New_York','nearestMarker',target.nearest_marker,'date',target.inspection_date)),updated_at=now()
      WHERE id=marker.id;
    UPDATE gravesites SET deleted_at=now(),delete_reason=reason,updated_at=now() WHERE id=grave.id AND deleted_at IS NULL;
  END LOOP;
END $$;

-- Recovery requires a backup or reviewed forward correction; preserve historical rows.
--rollback empty
