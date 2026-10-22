--liquibase formatted sql

--changeset cemeterymapping:491-require-monument-faces splitStatements:false
CREATE FUNCTION default_monument_face(face_id uuid, reading text, status text, legibility text, history jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_array(jsonb_build_object('id',face_id::text,'label','Unspecified face',
  'inscription',COALESCE(reading,''),'inscriptionStatus',CASE WHEN COALESCE(reading,'') ~ '[^[:space:]]' THEN 'transcribed' ELSE COALESCE(status,'not_recorded') END,
  'currentLegibility',COALESCE(legibility,'unknown'),'historicalTranscriptions',COALESCE(history,'[]'::jsonb),
  'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb))
$$;

-- Structural backfill must not refresh independent field/NHG observations.
ALTER TABLE headstones DISABLE TRIGGER capture_monument_inspection;
UPDATE headstones SET faces=default_monument_face(gen_random_uuid(),inscription,inscription_status,current_legibility,
 COALESCE((SELECT jsonb_agg(h) FROM jsonb_array_elements(historical_transcriptions) h WHERE NOT jsonb_exists(h,'faceId')),'[]'::jsonb)),updated_at=now()
 WHERE jsonb_array_length(faces)=0;
ALTER TABLE headstones ENABLE TRIGGER capture_monument_inspection;

-- A historical reading belongs to its own visit, not today's face transcription.
-- Reuse an unspecified face's identity when available, without copying its text,
-- metadata or media references into another inspection.
UPDATE monument_inspections i SET faces=default_monument_face(
 COALESCE((SELECT (f->>'id')::uuid FROM headstones h CROSS JOIN LATERAL jsonb_array_elements(h.faces) f
  WHERE h.id=i.headstone_uuid AND f->>'label'='Unspecified face' LIMIT 1),gen_random_uuid()),
 i.inscription,NULL,NULL,'[]'::jsonb),updated_at=now()
 WHERE jsonb_array_length(i.faces)=0;

CREATE FUNCTION ensure_new_monument_face() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF jsonb_array_length(NEW.faces)=0 THEN
  NEW.faces:=default_monument_face(gen_random_uuid(),NEW.inscription,NEW.inscription_status,NEW.current_legibility,
   COALESCE((SELECT jsonb_agg(h) FROM jsonb_array_elements(NEW.historical_transcriptions) h WHERE NOT jsonb_exists(h,'faceId')),'[]'::jsonb));
 END IF;
 RETURN NEW;
END $$;
-- Alphabetical trigger order runs this before sync_headstone_faces and capture.
CREATE TRIGGER ensure_new_monument_face BEFORE INSERT ON headstones FOR EACH ROW EXECUTE FUNCTION ensure_new_monument_face();

CREATE FUNCTION ensure_inspection_face() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE face_id uuid;
BEGIN
 IF TG_OP='INSERT' AND jsonb_array_length(NEW.faces)=0 THEN
  SELECT (f->>'id')::uuid INTO face_id FROM headstones h CROSS JOIN LATERAL jsonb_array_elements(h.faces) f
   WHERE h.id=NEW.headstone_uuid AND f->>'label'='Unspecified face' LIMIT 1;
  NEW.faces:=default_monument_face(COALESCE(face_id,gen_random_uuid()),NEW.inscription,NULL,NULL,'[]'::jsonb);
 ELSIF TG_OP='UPDATE' AND NEW.faces IS NOT DISTINCT FROM OLD.faces
  AND NEW.inscription IS DISTINCT FROM OLD.inscription AND jsonb_array_length(NEW.faces)=1
  AND NEW.faces->0->>'label'='Unspecified face' THEN
  NEW.faces:=jsonb_set(NEW.faces,'{0,inscription}',to_jsonb(NEW.inscription));
  NEW.faces:=jsonb_set(NEW.faces,'{0,inscriptionStatus}',to_jsonb(CASE WHEN NEW.inscription ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ensure_inspection_face BEFORE INSERT OR UPDATE OF faces,inscription ON monument_inspections FOR EACH ROW EXECUTE FUNCTION ensure_inspection_face();
ALTER TABLE headstones ADD CONSTRAINT headstones_require_face CHECK(jsonb_array_length(faces)>=1);
ALTER TABLE monument_inspections ADD CONSTRAINT monument_inspections_require_face CHECK(jsonb_array_length(faces)>=1);

-- Reverting removes enforcement while retaining all face records and readings.
--rollback ALTER TABLE monument_inspections DROP CONSTRAINT IF EXISTS monument_inspections_require_face;
--rollback ALTER TABLE headstones DROP CONSTRAINT IF EXISTS headstones_require_face;
--rollback DROP TRIGGER IF EXISTS ensure_inspection_face ON monument_inspections;
--rollback DROP TRIGGER IF EXISTS ensure_new_monument_face ON headstones;
--rollback DROP FUNCTION IF EXISTS ensure_inspection_face();
--rollback DROP FUNCTION IF EXISTS ensure_new_monument_face();
--rollback DROP FUNCTION IF EXISTS default_monument_face(uuid,text,text,text,jsonb);
