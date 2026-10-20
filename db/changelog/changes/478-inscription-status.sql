--liquibase formatted sql

--changeset cemeterymapping:478-inscription-status splitStatements:false
ALTER TABLE headstones ADD COLUMN inscription_status text;

-- Convert only whole-field tokens. Partial transcriptions and line breaks stay intact.
-- Disable synchronization while normalizing old rows, then install status-aware synchronization.
ALTER TABLE headstones DISABLE TRIGGER sync_headstone_faces;
UPDATE headstones SET
  inscription_status=CASE WHEN lower(regexp_replace(inscription,'^[[:space:]]+|[[:space:]]+$','','g'))='[blank]' THEN 'blank'
    WHEN lower(regexp_replace(inscription,'^[[:space:]]+|[[:space:]]+$','','g'))='[illegible]' THEN 'illegible'
    WHEN COALESCE(inscription,'') ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END,
  inscription=CASE WHEN lower(regexp_replace(inscription,'^[[:space:]]+|[[:space:]]+$','','g')) IN ('[blank]','[illegible]') THEN NULL ELSE inscription END,
  faces=COALESCE((SELECT jsonb_agg(face || jsonb_build_object(
    'inscriptionStatus', CASE WHEN lower(regexp_replace(face->>'inscription','^[[:space:]]+|[[:space:]]+$','','g'))='[blank]' THEN 'blank'
      WHEN lower(regexp_replace(face->>'inscription','^[[:space:]]+|[[:space:]]+$','','g'))='[illegible]' THEN 'illegible'
      WHEN COALESCE(face->>'inscription','') ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END,
    'inscription', CASE WHEN lower(regexp_replace(face->>'inscription','^[[:space:]]+|[[:space:]]+$','','g')) IN ('[blank]','[illegible]') THEN '' ELSE COALESCE(face->>'inscription','') END)
    ORDER BY ordinal) FROM jsonb_array_elements(faces) WITH ORDINALITY AS f(face,ordinal)), '[]'::jsonb),
  faces_revision=faces_revision+1;
ALTER TABLE headstones ENABLE TRIGGER sync_headstone_faces;

CREATE OR REPLACE FUNCTION sync_headstone_faces() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  face jsonb;
  normalized jsonb := '[]'::jsonb;
  status text;
  transcription text;
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.inscription_status='not_recorded' AND COALESCE(NEW.inscription,'') ~ '[^[:space:]]' THEN NEW.inscription_status:='transcribed'; END IF;
    IF NEW.inscription_status IN ('blank','illegible') AND COALESCE(NEW.inscription,'')<>'' THEN
      RAISE EXCEPTION 'Blank or Illegible inscriptions cannot contain text';
    END IF;
    IF NEW.faces='[]'::jsonb AND COALESCE(NEW.inscription,'')<>'' THEN
      NEW.faces:=jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'label','Unspecified face',
        'inscription',NEW.inscription,'inscriptionStatus',COALESCE(NEW.inscription_status,'transcribed'),
        'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb));
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
        'inscription',NEW.inscription,'inscriptionStatus',status,'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb));
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND NEW.faces='[]'::jsonb AND NEW.faces IS DISTINCT FROM OLD.faces THEN
    NEW.inscription:=NULL;
    NEW.inscription_status:='not_recorded';
  END IF;
  FOR face IN SELECT value FROM jsonb_array_elements(NEW.faces) LOOP
    transcription:=COALESCE(face->>'inscription','');
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
  IF NEW.inscription_status NOT IN ('not_recorded','transcribed','blank','illegible') THEN RAISE EXCEPTION 'Invalid inscription status'; END IF;
  IF NEW.inscription_status IN ('blank','illegible') AND COALESCE(NEW.inscription,'')<>'' THEN RAISE EXCEPTION 'Blank or Illegible inscriptions cannot contain text'; END IF;
  IF TG_OP='UPDATE' THEN NEW.faces_revision:=OLD.faces_revision+CASE WHEN NEW.faces IS DISTINCT FROM OLD.faces OR NEW.inscription_status IS DISTINCT FROM OLD.inscription_status THEN 1 ELSE 0 END; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER sync_headstone_faces ON headstones;
CREATE TRIGGER sync_headstone_faces BEFORE INSERT OR UPDATE OF faces, inscription, inscription_status ON headstones
FOR EACH ROW EXECUTE FUNCTION sync_headstone_faces();
-- Recompute combined inscriptions from converted faces, removing literal sentinel tokens.
UPDATE headstones SET faces=faces;
ALTER TABLE headstones ALTER COLUMN inscription_status SET NOT NULL;
ALTER TABLE headstones ALTER COLUMN inscription_status SET DEFAULT 'not_recorded';
ALTER TABLE headstones ADD CONSTRAINT headstones_inscription_status_check CHECK(inscription_status IN ('not_recorded','transcribed','blank','illegible'));
ALTER TABLE headstones ADD CONSTRAINT headstones_inscription_status_text_check CHECK(inscription_status NOT IN ('blank','illegible') OR COALESCE(inscription,'')='');

-- Conversion preserves historical values in audit history; recovery uses a backup or forward correction.
--rollback empty
