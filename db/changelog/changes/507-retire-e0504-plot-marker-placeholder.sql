--liquibase formatted sql

--changeset cemeterymapping:507-retire-e0504-plot-marker-placeholder splitStatements:false
DO $$
DECLARE marker_id uuid; target_grave_uuid uuid; burial_id uuid; dependency text; dependency_count integer;
BEGIN
 SELECT id INTO marker_id FROM headstones WHERE headstone_id='TLC-HS-0504' AND deleted_at IS NULL;
 SELECT id INTO target_grave_uuid FROM gravesites WHERE gravesite_id='TLC-GPS-0504' AND deleted_at IS NULL;
 IF target_grave_uuid IS NULL THEN RETURN; END IF;
 PERFORM assert_migration_prerequisite(EXISTS(SELECT 1 FROM headstones h
 JOIN marker_types t ON t.id=h.marker_type_id JOIN marker_scope_types s ON s.id=h.marker_scope_type_id
 WHERE h.id=marker_id AND t.code='plot_marker' AND s.code='plot_marker'), '0504 must remain a plot marker');
 SELECT id INTO burial_id FROM burials WHERE gravesite_uuid=target_grave_uuid AND full_name='Plot Marker, PB' AND deleted_at IS NULL;
 PERFORM assert_migration_prerequisite(burial_id IS NOT NULL AND
 (SELECT count(*) FROM burials WHERE gravesite_uuid=target_grave_uuid AND deleted_at IS NULL)=1,
 'E-0504 must contain only its imported plot-marker placeholder burial');
 FOREACH dependency IN ARRAY ARRAY['owners','ownership_event_rights','maintenance_records','grave_features',
 'gravesite_media_assets','north_hills_ocr_entry_gravesite_links','historic_lot_map_gravesite_evidence','source_person_record_links'] LOOP
 EXECUTE format('SELECT count(*) FROM %I WHERE gravesite_uuid=$1',dependency) INTO dependency_count USING target_grave_uuid;
 PERFORM assert_migration_prerequisite(dependency_count=0,'E-0504 has dependencies in '||dependency);
 END LOOP;
 PERFORM assert_migration_prerequisite(NOT EXISTS(SELECT 1 FROM headstones WHERE gravesite_uuid=target_grave_uuid AND id<>marker_id AND deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM headstone_gravesites WHERE gravesite_uuid=target_grave_uuid AND headstone_uuid<>marker_id AND deleted_at IS NULL)
 AND NOT EXISTS(SELECT 1 FROM headstone_burials WHERE burial_uuid=burial_id AND headstone_uuid<>marker_id AND deleted_at IS NULL),
 'E-0504 must not be associated with another monument');
 UPDATE headstone_burials SET deleted_at=now(),delete_reason='Imported plot-marker placeholder is not a person.'
 WHERE headstone_uuid=marker_id AND burial_uuid=burial_id AND deleted_at IS NULL;
 UPDATE headstone_gravesites SET deleted_at=now(),updated_at=now(),delete_reason='Plot marker TLC-HS-0504 has no gravesite.'
 WHERE headstone_uuid=marker_id AND gravesite_uuid=target_grave_uuid AND deleted_at IS NULL;
 UPDATE headstones SET gravesite_uuid=NULL,updated_at=now() WHERE id=marker_id AND gravesite_uuid=target_grave_uuid;
 UPDATE burials SET deleted_at=now(),updated_at=now(),delete_reason='Imported Plot Marker, PB placeholder is not a person.' WHERE id=burial_id;
 UPDATE gravesites SET deleted_at=now(),updated_at=now(),delete_reason='E-0504 was generated for plot marker TLC-HS-0504, not a burial space.' WHERE id=target_grave_uuid;
END $$;

--rollback empty
