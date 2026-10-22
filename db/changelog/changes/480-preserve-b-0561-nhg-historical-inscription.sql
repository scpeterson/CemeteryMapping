--liquibase formatted sql

--changeset cemeterymapping:480-preserve-b-0561-nhg-historical-inscription splitStatements:false
-- NHG attribution/year and current illegibility confirmed by the cemetery administrator.
-- Do not use the rejected OCR link to a different person's marker as evidence.
DO $$
DECLARE marker headstones%ROWTYPE; history jsonb; entry jsonb;
BEGIN
  SELECT * INTO marker FROM headstones WHERE headstone_id='TLC-HS-0561' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(
    marker.source_properties->>'Person1First'='Amanda L'
    AND marker.source_properties->>'Person1Last'='Will/Bruermann/Pfeiffer'
    AND jsonb_array_length(marker.faces)<=1,
    'B-0561 requires the identified Amanda L Will marker with at most one face; reconcile later changes first');
  history:=marker.historical_transcriptions;
  IF COALESCE(marker.inscription,'') ~ '[^[:space:]]' THEN
    entry:=jsonb_build_object('id',gen_random_uuid()::text,'text',marker.inscription,
      'source','North Hills Genealogists (NHG); attribution confirmed by cemetery administrator','sourceDate','2005');
    history:=merge_inscription_history(history,jsonb_build_array(entry));
  END IF;
  UPDATE headstones SET inscription=NULL,inscription_status='illegible',current_legibility='illegible',
    historical_transcriptions=history,
    faces=CASE WHEN jsonb_array_length(marker.faces)=1 THEN jsonb_build_array(marker.faces->0||jsonb_build_object(
      'inscription','','inscriptionStatus','illegible','currentLegibility','illegible',
      'historicalTranscriptions',merge_inscription_history(COALESCE(marker.faces->0->'historicalTranscriptions','[]'::jsonb),history))) ELSE marker.faces END,
    source_properties=source_properties||jsonb_build_object('B0561HistoricalInscriptionReview',jsonb_build_object(
      'reportedAt','2026-10-20','currentLegibility','illegible','historicalSource','NHG','historicalReadingYear','2005',
      'attributionBasis','Cemetery administrator confirmation; rejected OCR link was not used')),
    updated_at=now() WHERE id=marker.id;
END $$;

-- Historical readings and audit evidence must be preserved; use a reviewed forward correction for recovery.
--rollback empty
