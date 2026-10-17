--liquibase formatted sql

--changeset cemeterymapping:409-marker-faces splitStatements:false
ALTER TABLE headstones
  ADD COLUMN faces jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(faces) = 'array'),
  ADD COLUMN faces_revision integer NOT NULL DEFAULT 0;

UPDATE headstones SET faces = jsonb_build_array(jsonb_build_object(
  'id', gen_random_uuid()::text, 'label', 'Unspecified face',
  'inscription', inscription, 'notes', '', 'burialIds', '[]'::jsonb, 'mediaAssetIds', '[]'::jsonb
)) WHERE inscription IS NOT NULL AND inscription <> '';

-- Keep the legacy inscription searchable and available to reports/imports.
-- Legacy writes can edit the sole face, but cannot flatten a multi-face record.
CREATE FUNCTION sync_headstone_faces() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.faces = '[]'::jsonb AND COALESCE(NEW.inscription, '') <> '' THEN
      NEW.faces := jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,
        'label', 'Unspecified face', 'inscription', NEW.inscription, 'notes', '',
        'burialIds', '[]'::jsonb, 'mediaAssetIds', '[]'::jsonb));
    END IF;
  ELSIF NEW.faces IS NOT DISTINCT FROM OLD.faces AND NEW.inscription IS DISTINCT FROM OLD.inscription THEN
    IF jsonb_array_length(OLD.faces) > 1 THEN
      RAISE EXCEPTION 'Edit individual marker faces instead of the combined inscription';
    ELSIF jsonb_array_length(OLD.faces) = 1 THEN
      NEW.faces := jsonb_set(OLD.faces, '{0,inscription}', to_jsonb(COALESCE(NEW.inscription, '')));
    ELSIF COALESCE(NEW.inscription, '') <> '' THEN
      NEW.faces := jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,
        'label', 'Unspecified face', 'inscription', NEW.inscription, 'notes', '',
        'burialIds', '[]'::jsonb, 'mediaAssetIds', '[]'::jsonb));
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.faces_revision := OLD.faces_revision + CASE WHEN NEW.faces IS DISTINCT FROM OLD.faces THEN 1 ELSE 0 END;
  END IF;
  SELECT CASE WHEN jsonb_array_length(NEW.faces) = 1 THEN NEW.faces->0->>'inscription'
    ELSE string_agg((face->>'label') || E'\n' || COALESCE(face->>'inscription', ''), E'\n\n' ORDER BY ordinal) END
    INTO NEW.inscription FROM jsonb_array_elements(NEW.faces) WITH ORDINALITY AS f(face, ordinal);
  RETURN NEW;
END $$;
CREATE TRIGGER sync_headstone_faces BEFORE INSERT OR UPDATE OF faces, inscription ON headstones
  FOR EACH ROW EXECUTE FUNCTION sync_headstone_faces();

--rollback DROP TRIGGER sync_headstone_faces ON headstones;
--rollback DROP FUNCTION sync_headstone_faces();
--rollback ALTER TABLE headstones DROP COLUMN faces_revision, DROP COLUMN faces;
