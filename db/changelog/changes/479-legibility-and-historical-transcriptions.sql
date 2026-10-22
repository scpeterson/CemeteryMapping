--liquibase formatted sql

--changeset cemeterymapping:479-legibility-and-historical-transcriptions splitStatements:false
ALTER TABLE headstones ADD COLUMN current_legibility text NOT NULL DEFAULT 'unknown',
  ADD COLUMN historical_transcriptions jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(historical_transcriptions)='array');

-- Historical readings are append-only. Older clients cannot silently discard them.
CREATE FUNCTION merge_inscription_history(previous jsonb, incoming jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb:=COALESCE(previous,'[]'::jsonb); item jsonb; existing jsonb;
BEGIN
  IF jsonb_typeof(result)<>'array' OR jsonb_typeof(incoming)<>'array' THEN RAISE EXCEPTION 'Historical transcriptions must be arrays'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(incoming,'[]'::jsonb)) LOOP
    IF NULLIF(btrim(item->>'text'),'') IS NULL OR NULLIF(btrim(item->>'source'),'') IS NULL OR item->>'id' IS NULL
      OR length(item->>'text')>20000 OR length(item->>'source')>500 THEN RAISE EXCEPTION 'Historical transcriptions require an id, text and source'; END IF;
    PERFORM (item->>'id')::uuid;
    IF COALESCE(item->>'sourceDate','')<>'' AND NOT (item->>'sourceDate' ~ '^([0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})$') THEN RAISE EXCEPTION 'Historical source date must be a year or YYYY-MM-DD'; END IF;
    IF length(COALESCE(item->>'sourceDate',''))=10 THEN PERFORM (item->>'sourceDate')::date; END IF;
    SELECT value INTO existing FROM jsonb_array_elements(result) WHERE value->>'id'=item->>'id' LIMIT 1;
    IF existing IS NULL THEN result:=result||jsonb_build_array(item);
    ELSIF (existing->>'text',existing->>'source',COALESCE(existing->>'sourceDate','')) IS DISTINCT FROM
      (item->>'text',item->>'source',COALESCE(item->>'sourceDate','')) THEN RAISE EXCEPTION 'Historical transcriptions are immutable; add a corrected reading instead'; END IF;
  END LOOP;
  IF jsonb_array_length(result)>100 OR octet_length(result::text)>200000 THEN RAISE EXCEPTION 'Historical transcriptions exceed size limit'; END IF;
  RETURN result;
END $$;
CREATE FUNCTION archive_inscription_text(history jsonb, transcription text, face_id text, face_label text) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (COALESCE(transcription,'') ~ '[^[:space:]]') OR EXISTS(SELECT 1 FROM jsonb_array_elements(history) f WHERE f->>'text'=transcription) THEN RETURN history; END IF;
  RETURN merge_inscription_history(history,jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'id',gen_random_uuid()::text,'text',transcription,'source','Previous current transcription (source not recorded)','sourceDate','',
    'faceId',face_id,'faceLabel',face_label))));
END $$;

ALTER TABLE headstones DISABLE TRIGGER sync_headstone_faces;
UPDATE headstones SET current_legibility=CASE WHEN inscription_status IN ('blank','illegible') THEN inscription_status ELSE 'unknown' END,
 faces=COALESCE((SELECT jsonb_agg(face||jsonb_build_object('currentLegibility',CASE WHEN face->>'inscriptionStatus' IN ('blank','illegible') THEN face->>'inscriptionStatus' ELSE 'unknown' END,'historicalTranscriptions','[]'::jsonb) ORDER BY ordinal)
 FROM jsonb_array_elements(faces) WITH ORDINALITY f(face,ordinal)),'[]'::jsonb),faces_revision=faces_revision+1;
ALTER TABLE headstones ENABLE TRIGGER sync_headstone_faces;
CREATE OR REPLACE FUNCTION sync_headstone_faces() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  face jsonb;
  normalized jsonb := '[]'::jsonb;
  status text;
  transcription text;
  old_face jsonb;
  history jsonb;
  legibility text;
BEGIN
  NEW.historical_transcriptions:=merge_inscription_history(CASE WHEN TG_OP='UPDATE' THEN OLD.historical_transcriptions ELSE '[]'::jsonb END, NEW.historical_transcriptions);
  IF TG_OP='UPDATE' THEN
    IF NEW.current_legibility IS DISTINCT FROM OLD.current_legibility AND NEW.faces IS NOT DISTINCT FROM OLD.faces AND jsonb_array_length(NEW.faces)=1 THEN
      NEW.faces:=jsonb_set(NEW.faces,'{0,currentLegibility}',to_jsonb(NEW.current_legibility));
      NEW.faces:=jsonb_set(NEW.faces,'{0,inscription}',to_jsonb(COALESCE(NEW.inscription,'')));
    END IF;
    IF jsonb_array_length(OLD.faces)=0 AND COALESCE(OLD.inscription,'') ~ '[^[:space:]]' AND NOT (COALESCE(NEW.inscription,'') ~ '[^[:space:]]') THEN
      NEW.historical_transcriptions:=archive_inscription_text(NEW.historical_transcriptions,OLD.inscription,NULL,NULL);
    END IF;
    FOR old_face IN SELECT value FROM jsonb_array_elements(OLD.faces) LOOP
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.faces) f WHERE f->>'id'=old_face->>'id') THEN
        NEW.historical_transcriptions:=merge_inscription_history(NEW.historical_transcriptions,COALESCE(old_face->'historicalTranscriptions','[]'::jsonb));
        NEW.historical_transcriptions:=archive_inscription_text(NEW.historical_transcriptions,old_face->>'inscription',old_face->>'id',old_face->>'label');
      END IF;
    END LOOP;
  END IF;
  IF NEW.current_legibility IN ('blank','illegible') THEN
    IF COALESCE(NEW.inscription,'')<>'' AND (TG_OP='INSERT' OR NEW.faces IS NOT DISTINCT FROM OLD.faces) THEN RAISE EXCEPTION 'Blank or Illegible current inscriptions cannot contain text'; END IF;
    IF jsonb_array_length(NEW.faces)=0 THEN NEW.inscription_status:=NEW.current_legibility; END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.inscription_status='not_recorded' AND COALESCE(NEW.inscription,'') ~ '[^[:space:]]' THEN NEW.inscription_status:='transcribed'; END IF;
    IF NEW.inscription_status IN ('blank','illegible') AND COALESCE(NEW.inscription,'')<>'' THEN
      RAISE EXCEPTION 'Blank or Illegible inscriptions cannot contain text';
    END IF;
    IF NEW.faces='[]'::jsonb AND COALESCE(NEW.inscription,'')<>'' THEN
      NEW.faces:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'label','Unspecified face',
        'inscription',NEW.inscription,'inscriptionStatus',COALESCE(NEW.inscription_status,'transcribed'),
        'currentLegibility',NEW.current_legibility,'historicalTranscriptions',NEW.historical_transcriptions,'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb));
    END IF;
  ELSIF NEW.faces IS NOT DISTINCT FROM OLD.faces AND
      (NEW.inscription IS DISTINCT FROM OLD.inscription OR NEW.inscription_status IS DISTINCT FROM OLD.inscription_status) THEN
    IF jsonb_array_length(OLD.faces)>1 THEN
      RAISE EXCEPTION 'Edit individual marker faces instead of the combined inscription';
    END IF;
    status:=COALESCE(NEW.inscription_status,CASE WHEN COALESCE(NEW.inscription,'') ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END);
    IF status='not_recorded' AND COALESCE(NEW.inscription,'') ~ '[^[:space:]]' AND NEW.inscription_status IS NOT DISTINCT FROM OLD.inscription_status THEN status:='transcribed'; END IF;
    IF status IN ('blank','illegible') AND COALESCE(NEW.inscription,'')<>'' THEN RAISE EXCEPTION 'Blank or Illegible inscriptions cannot contain text'; END IF;
    IF jsonb_array_length(OLD.faces)=1 THEN
      NEW.faces:=jsonb_set(jsonb_set(OLD.faces,'{0,inscription}',to_jsonb(COALESCE(NEW.inscription,''))),'{0,inscriptionStatus}',to_jsonb(status));
    ELSIF COALESCE(NEW.inscription,'')<>'' THEN
      NEW.faces:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'label','Unspecified face',
        'inscription',NEW.inscription,'inscriptionStatus',status,'currentLegibility',NEW.current_legibility,'historicalTranscriptions',NEW.historical_transcriptions,'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb));
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.faces='[]'::jsonb AND NEW.faces IS DISTINCT FROM OLD.faces THEN
    NEW.inscription:=NULL;
    NEW.inscription_status:='not_recorded';
  END IF;
  FOR face IN SELECT value FROM jsonb_array_elements(NEW.faces) LOOP
    old_face:=NULL;
    IF TG_OP='UPDATE' THEN SELECT value INTO old_face FROM jsonb_array_elements(OLD.faces) WHERE value->>'id'=face->>'id' LIMIT 1; END IF;
    history:=merge_inscription_history(COALESCE(old_face->'historicalTranscriptions','[]'::jsonb),COALESCE(face->'historicalTranscriptions','[]'::jsonb));
    transcription:=COALESCE(face->>'inscription','');
    IF old_face IS NOT NULL AND NOT (transcription ~ '[^[:space:]]') THEN
      history:=archive_inscription_text(history,old_face->>'inscription',face->>'id',face->>'label');
    END IF;
    legibility:=COALESCE(face->>'currentLegibility', CASE WHEN face->>'inscriptionStatus' IN ('blank','illegible') THEN face->>'inscriptionStatus' ELSE 'unknown' END);
    IF legibility NOT IN ('unknown','legible','partially_legible','blank','illegible') THEN RAISE EXCEPTION 'Invalid current legibility'; END IF;
    IF legibility IN ('blank','illegible') THEN
      IF transcription<>'' THEN RAISE EXCEPTION 'Blank or Illegible current inscriptions cannot contain text'; END IF;
      face:=face||jsonb_build_object('inscriptionStatus',legibility);
    END IF;
    face:=face||jsonb_build_object('currentLegibility',legibility,'historicalTranscriptions',history);
    NEW.historical_transcriptions:=merge_inscription_history(NEW.historical_transcriptions,history);

    status:=COALESCE(face->>'inscriptionStatus',CASE WHEN transcription ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END);
    IF status NOT IN ('not_recorded','transcribed','blank','illegible') THEN RAISE EXCEPTION 'Invalid face inscription status'; END IF;
    IF status IN ('blank','illegible') AND transcription<>'' THEN RAISE EXCEPTION 'Blank or Illegible face inscriptions cannot contain text'; END IF;
    IF status='not_recorded' AND transcription ~ '[^[:space:]]' THEN RAISE EXCEPTION 'Not recorded face inscriptions cannot contain text'; END IF;
    normalized:=normalized||jsonb_build_array(face||jsonb_build_object('inscriptionStatus',status));
  END LOOP;
  NEW.faces:=normalized;
  IF jsonb_array_length(NEW.faces)>0 THEN
    SELECT CASE WHEN jsonb_array_length(NEW.faces)=1 THEN NEW.faces->0->>'inscription'
      ELSE string_agg((f->>'label')||E'\n'||(f->>'inscription'), E'\n\n' ORDER BY ordinal)
        FILTER(WHERE COALESCE(f->>'inscription','') ~ '[^[:space:]]') END INTO NEW.inscription
      FROM jsonb_array_elements(NEW.faces) WITH ORDINALITY AS item(f,ordinal);
    SELECT CASE WHEN jsonb_array_length(NEW.faces)=1 THEN NEW.faces->0->>'inscriptionStatus'
      WHEN bool_and(f->>'inscriptionStatus'='blank') THEN 'blank'
      WHEN bool_and(f->>'inscriptionStatus'='illegible') THEN 'illegible'
      WHEN bool_or(f->>'inscriptionStatus'='not_recorded') THEN 'not_recorded'
      ELSE 'transcribed' END INTO NEW.inscription_status FROM jsonb_array_elements(NEW.faces) f;
  ELSE
    NEW.inscription_status:=COALESCE(NEW.inscription_status,CASE WHEN COALESCE(NEW.inscription,'') ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END);
  END IF;
  IF jsonb_array_length(NEW.faces)>0 THEN
    SELECT CASE WHEN count(DISTINCT f->>'currentLegibility')=1 THEN min(f->>'currentLegibility') ELSE 'unknown' END
      INTO NEW.current_legibility FROM jsonb_array_elements(NEW.faces) f;
  ELSIF NEW.inscription_status IN ('blank','illegible') THEN NEW.current_legibility:=NEW.inscription_status;
  END IF;
  IF NEW.current_legibility NOT IN ('unknown','legible','partially_legible','blank','illegible') THEN RAISE EXCEPTION 'Invalid current legibility'; END IF;
  IF NEW.inscription_status NOT IN ('not_recorded','transcribed','blank','illegible') THEN RAISE EXCEPTION 'Invalid inscription status'; END IF;
  IF NEW.inscription_status IN ('blank','illegible') AND COALESCE(NEW.inscription,'')<>'' THEN RAISE EXCEPTION 'Blank or Illegible inscriptions cannot contain text'; END IF;
  IF TG_OP='UPDATE' THEN NEW.faces_revision:=OLD.faces_revision+CASE WHEN NEW.faces IS DISTINCT FROM OLD.faces OR NEW.inscription_status IS DISTINCT FROM OLD.inscription_status OR NEW.current_legibility IS DISTINCT FROM OLD.current_legibility OR NEW.historical_transcriptions IS DISTINCT FROM OLD.historical_transcriptions THEN 1 ELSE 0 END; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER sync_headstone_faces ON headstones;
CREATE TRIGGER sync_headstone_faces BEFORE INSERT OR UPDATE OF faces,inscription,inscription_status,current_legibility,historical_transcriptions ON headstones
FOR EACH ROW EXECUTE FUNCTION sync_headstone_faces();
ALTER TABLE headstones ADD CONSTRAINT headstones_current_legibility_check CHECK(current_legibility IN ('unknown','legible','partially_legible','blank','illegible'));
ALTER TABLE headstones ADD CONSTRAINT headstones_current_legibility_text_check CHECK(current_legibility NOT IN ('blank','illegible') OR COALESCE(inscription,'')='');

-- Historical records remain in audit history; recovery requires a backup or forward correction.
--rollback empty
