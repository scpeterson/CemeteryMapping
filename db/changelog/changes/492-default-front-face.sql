--liquibase formatted sql

--changeset cemeterymapping:492-default-front-face splitStatements:false rollbackSplitStatements:false
-- Name changes retain face identities, readings, history and photo associations.
ALTER TABLE headstones DISABLE TRIGGER capture_monument_inspection;
UPDATE headstones SET faces=jsonb_set(faces,'{0,label}','"Front"'::jsonb),updated_at=now()
 WHERE jsonb_array_length(faces)=1 AND faces->0->>'label'<>'Front';
ALTER TABLE headstones ENABLE TRIGGER capture_monument_inspection;
UPDATE monument_inspections i SET faces=jsonb_set(i.faces,'{0,label}','"Front"'::jsonb),updated_at=now()
 FROM headstones h WHERE h.id=i.headstone_uuid AND jsonb_array_length(h.faces)=1
 AND jsonb_array_length(i.faces)=1 AND i.faces->0->>'label'<>'Front';

CREATE OR REPLACE FUNCTION default_monument_face(face_id uuid, reading text, status text, legibility text, history jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_array(jsonb_build_object('id',face_id::text,'label','Front',
  'inscription',COALESCE(reading,''),'inscriptionStatus',CASE WHEN COALESCE(reading,'') ~ '[^[:space:]]' THEN 'transcribed' ELSE COALESCE(status,'not_recorded') END,
  'currentLegibility',COALESCE(legibility,'unknown'),'historicalTranscriptions',COALESCE(history,'[]'::jsonb),
  'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb))
$$;

CREATE OR REPLACE FUNCTION ensure_new_monument_face() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF jsonb_array_length(NEW.faces)=0 THEN
  NEW.faces:=default_monument_face(gen_random_uuid(),NEW.inscription,NEW.inscription_status,NEW.current_legibility,
   COALESCE((SELECT jsonb_agg(h) FROM jsonb_array_elements(NEW.historical_transcriptions) h WHERE NOT jsonb_exists(h,'faceId')),'[]'::jsonb));
 ELSIF jsonb_array_length(NEW.faces)=1 AND NEW.faces->0->>'label'='Unspecified face' THEN
  NEW.faces:=jsonb_set(NEW.faces,'{0,label}','"Front"'::jsonb);
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION ensure_inspection_face() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE face_id uuid;
BEGIN
 IF TG_OP='INSERT' AND jsonb_array_length(NEW.faces)=0 THEN
  SELECT (f->>'id')::uuid INTO face_id FROM headstones h CROSS JOIN LATERAL jsonb_array_elements(h.faces) f
   WHERE h.id=NEW.headstone_uuid AND (jsonb_array_length(h.faces)=1 OR f->>'label'='Unspecified face') LIMIT 1;
  NEW.faces:=default_monument_face(COALESCE(face_id,gen_random_uuid()),NEW.inscription,NULL,NULL,'[]'::jsonb);
  IF EXISTS(SELECT 1 FROM headstones WHERE id=NEW.headstone_uuid AND jsonb_array_length(faces)>1) THEN
   NEW.faces:=jsonb_set(NEW.faces,'{0,label}','"Unspecified face"'::jsonb);
  END IF;
 ELSIF TG_OP='UPDATE' AND NEW.faces IS NOT DISTINCT FROM OLD.faces
  AND NEW.inscription IS DISTINCT FROM OLD.inscription AND jsonb_array_length(NEW.faces)=1
  AND NEW.faces->0->>'label' IN ('Front','Unspecified face') THEN
  NEW.faces:=jsonb_set(NEW.faces,'{0,inscription}',to_jsonb(NEW.inscription));
  NEW.faces:=jsonb_set(NEW.faces,'{0,inscriptionStatus}',to_jsonb(CASE WHEN NEW.inscription ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END));
 END IF;
 RETURN NEW;
END $$;

-- Reverting restores previous defaults while retaining recorded face labels.
--rollback CREATE OR REPLACE FUNCTION default_monument_face(face_id uuid, reading text, status text, legibility text, history jsonb)
--rollback RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
--rollback  SELECT jsonb_build_array(jsonb_build_object('id',face_id::text,'label','Unspecified face',
--rollback   'inscription',COALESCE(reading,''),'inscriptionStatus',CASE WHEN COALESCE(reading,'') ~ '[^[:space:]]' THEN 'transcribed' ELSE COALESCE(status,'not_recorded') END,
--rollback   'currentLegibility',COALESCE(legibility,'unknown'),'historicalTranscriptions',COALESCE(history,'[]'::jsonb),
--rollback   'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb))
--rollback $$;
--rollback CREATE OR REPLACE FUNCTION ensure_new_monument_face() RETURNS trigger LANGUAGE plpgsql AS $$
--rollback BEGIN
--rollback  IF jsonb_array_length(NEW.faces)=0 THEN
--rollback   NEW.faces:=default_monument_face(gen_random_uuid(),NEW.inscription,NEW.inscription_status,NEW.current_legibility,
--rollback    COALESCE((SELECT jsonb_agg(h) FROM jsonb_array_elements(NEW.historical_transcriptions) h WHERE NOT jsonb_exists(h,'faceId')),'[]'::jsonb));
--rollback  END IF;
--rollback  RETURN NEW;
--rollback END $$;
--rollback CREATE OR REPLACE FUNCTION ensure_inspection_face() RETURNS trigger LANGUAGE plpgsql AS $$
--rollback DECLARE face_id uuid;
--rollback BEGIN
--rollback  IF TG_OP='INSERT' AND jsonb_array_length(NEW.faces)=0 THEN
--rollback   SELECT (f->>'id')::uuid INTO face_id FROM headstones h CROSS JOIN LATERAL jsonb_array_elements(h.faces) f
--rollback    WHERE h.id=NEW.headstone_uuid AND f->>'label'='Unspecified face' LIMIT 1;
--rollback   NEW.faces:=default_monument_face(COALESCE(face_id,gen_random_uuid()),NEW.inscription,NULL,NULL,'[]'::jsonb);
--rollback  ELSIF TG_OP='UPDATE' AND NEW.faces IS NOT DISTINCT FROM OLD.faces
--rollback   AND NEW.inscription IS DISTINCT FROM OLD.inscription AND jsonb_array_length(NEW.faces)=1
--rollback   AND NEW.faces->0->>'label'='Unspecified face' THEN
--rollback   NEW.faces:=jsonb_set(NEW.faces,'{0,inscription}',to_jsonb(NEW.inscription));
--rollback   NEW.faces:=jsonb_set(NEW.faces,'{0,inscriptionStatus}',to_jsonb(CASE WHEN NEW.inscription ~ '[^[:space:]]' THEN 'transcribed' ELSE 'not_recorded' END));
--rollback  END IF;
--rollback  RETURN NEW;
--rollback END $$;
