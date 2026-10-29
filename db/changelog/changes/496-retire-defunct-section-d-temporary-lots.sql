--liquibase formatted sql

--changeset cemeterymapping:496-retire-defunct-section-d-temporary-lots splitStatements:false
DO $retire$
DECLARE
  target_ids uuid[];
  target_count integer;
  cemetery uuid;
  reason text := 'User confirmed 2026-10-29: older maps show D-TMP03 through D-TMP12 and D-TMP15 through D-TMP17 as defunct. Retire these thirteen temporary lot outlines; retain gravesites, monuments and other temporary lots.';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lots WHERE facility_id='1' AND section_id='D'
    AND block_id IS NULL AND deleted_at IS NULL) THEN RETURN; END IF;
  -- Lock the lots before checking references; FK insertions must wait until retirement completes.
  PERFORM 1 FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
    AND deleted_at IS NULL AND lot_id IN
      ('TMP03','TMP04','TMP05','TMP06','TMP07','TMP08','TMP09','TMP10','TMP11','TMP12','TMP15','TMP16','TMP17')
    ORDER BY id FOR UPDATE;
  SELECT array_agg(id),count(DISTINCT lot_id) INTO target_ids,target_count
    FROM lots WHERE facility_id='1' AND section_id='D' AND block_id IS NULL
      AND deleted_at IS NULL AND lot_id IN
      ('TMP03','TMP04','TMP05','TMP06','TMP07','TMP08','TMP09','TMP10','TMP11','TMP12','TMP15','TMP16','TMP17');
  PERFORM assert_migration_prerequisite(cardinality(target_ids)=13 AND target_count=13,
    'Migration 496 requires all thirteen active defunct Section D temporary lots');
  SELECT cemetery_id INTO cemetery FROM lots WHERE id=target_ids[1];
  PERFORM assert_migration_prerequisite(cemetery IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM lots WHERE id=ANY(target_ids)
      AND (cemetery_id IS DISTINCT FROM cemetery OR burial_use_status IS DISTINCT FROM 'non_burial')),
    'Migration 496 requires non-burial temporary lots in one cemetery');
  PERFORM assert_migration_prerequisite(
    NOT EXISTS (SELECT 1 FROM gravesites WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS (SELECT 1 FROM lot_ownership_events WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS (SELECT 1 FROM ownership_event_rights WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS (SELECT 1 FROM historic_lot_map_gravesite_evidence WHERE lot_uuid=ANY(target_ids))
    AND NOT EXISTS (SELECT 1 FROM lot_restricted_areas WHERE lot_uuid=ANY(target_ids)),
    'Migration 496 defunct lots must have no gravesite, ownership, evidence or restricted-area dependencies');
  PERFORM set_config('app.audit.source','migration',true);
  PERFORM set_config('app.audit.reason',reason,true);
  UPDATE lots SET deleted_at=now(),deleted_by=NULL,delete_reason=reason,updated_at=now()
    WHERE id=ANY(target_ids);
END
$retire$;

-- Preserve retired outlines and their history. Recovery uses a reviewed forward correction or backup.
--rollback empty
