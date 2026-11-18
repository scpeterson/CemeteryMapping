--liquibase formatted sql

--changeset cemeterymapping:520-marker-identifiers-and-section-g-primary splitStatements:false
-- Allocate on INSERT, not in a browser preview. Historical/deleted identifiers stay reserved.
CREATE FUNCTION assign_marker_identifier() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cemetery uuid; prefix text; number numeric; digits integer;
BEGIN
  PERFORM pg_advisory_xact_lock(520, 1);
  IF NULLIF(btrim(NEW.headstone_id), '') IS NOT NULL THEN RETURN NEW; END IF;
  SELECT cemetery_id INTO cemetery FROM gravesites WHERE id=NEW.gravesite_uuid;
  IF cemetery IS NULL THEN
    RAISE EXCEPTION 'Automatic marker numbering requires a gravesite.' USING ERRCODE='23514';
  END IF;
  SELECT (regexp_match(h.headstone_id, '^(.+[^0-9])([0-9]+)$'))[1],
         max(length((regexp_match(h.headstone_id, '^(.+[^0-9])([0-9]+)$'))[2])) INTO prefix,digits
  FROM headstones h
  WHERE h.headstone_id ~ '^(.+[^0-9])([0-9]+)$' AND (
    EXISTS (SELECT 1 FROM gravesites g WHERE g.id=h.gravesite_uuid AND g.cemetery_id=cemetery)
    OR EXISTS (SELECT 1 FROM headstone_gravesites l JOIN gravesites g ON g.id=l.gravesite_uuid
               WHERE l.headstone_uuid=h.id AND g.cemetery_id=cemetery))
  GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1;
  IF prefix IS NULL THEN
    digits:=4;
    SELECT string_agg(upper(left(word,1)), '' ORDER BY ordinal) || '-HS-' INTO prefix
    FROM cemeteries c, LATERAL regexp_split_to_table(regexp_replace(c.name,'[^[:alnum:] ]','','g'), ' +') WITH ORDINALITY AS words(word,ordinal)
    WHERE c.id=cemetery AND word<>'';
  END IF;
  IF prefix IS NULL OR length(prefix)>=50 THEN
    RAISE EXCEPTION 'Enter a marker ID for this cemetery.' USING ERRCODE='23514', CONSTRAINT='marker_identifier_format';
  END IF;
  SELECT coalesce(max(substring(headstone_id FROM length(prefix)+1)::numeric),0)+1 INTO number
  FROM headstones WHERE left(headstone_id,length(prefix))=prefix
    AND substring(headstone_id FROM length(prefix)+1) ~ '^[0-9]+$';
  IF length(prefix)+greatest(digits,length(number::text))>50 THEN
    RAISE EXCEPTION 'The marker number exceeds the ID length limit. Enter an explicit marker ID.'
      USING ERRCODE='23514', CONSTRAINT='marker_identifier_format';
  END IF;
  NEW.headstone_id := prefix || lpad(number::text,greatest(digits,length(number::text)),'0');
  RETURN NEW;
END $$;
CREATE TRIGGER assign_marker_identifier BEFORE INSERT ON headstones FOR EACH ROW EXECUTE FUNCTION assign_marker_identifier();

-- A unique claim protects concurrent writers even under repeatable-read isolation.
-- Deferred checks see the final state of legacy direct references and explicit links.
CREATE TABLE section_g_primary_marker_claims (
  gravesite_uuid uuid PRIMARY KEY REFERENCES gravesites(id) ON DELETE CASCADE,
  headstone_uuid uuid NOT NULL REFERENCES headstones(id) ON DELETE CASCADE
);
CREATE FUNCTION sync_section_g_primary_marker(grave uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE marker uuid; markers uuid[];
BEGIN
  PERFORM 1 FROM gravesites WHERE id=grave FOR UPDATE;
  SELECT array_agg(DISTINCT h.id ORDER BY h.id) INTO markers
  FROM gravesites g JOIN headstones h ON h.deleted_at IS NULL AND (
    EXISTS (SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=g.id
            AND l.deleted_at IS NULL)
    OR (h.gravesite_uuid=g.id AND NOT EXISTS (
      SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=g.id AND l.deleted_at IS NULL)))
  WHERE g.id=grave AND g.deleted_at IS NULL
    AND upper(coalesce((SELECT name FROM sections WHERE section_id=g.section_uuid),g.section_id,''))='G';
  IF cardinality(markers)>1 OR EXISTS (
    SELECT 1 FROM headstones h LEFT JOIN marker_types t ON t.id=h.marker_type_id
    WHERE h.id=ANY(markers) AND (t.code IS DISTINCT FROM 'flat_marker' OR EXISTS (
      SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id
        AND l.gravesite_uuid=grave AND l.deleted_at IS NULL AND l.relationship_type IS DISTINCT FROM 'primary'))
  ) THEN
    RAISE EXCEPTION 'Section G permits only one primary flat marker per gravesite (%)', grave
      USING ERRCODE='23514', CONSTRAINT='section_g_single_primary';
  END IF;
  marker:=markers[1];
  IF marker IS NULL THEN DELETE FROM section_g_primary_marker_claims WHERE gravesite_uuid=grave;
  ELSE
    INSERT INTO section_g_primary_marker_claims VALUES(grave,marker)
    ON CONFLICT(gravesite_uuid) DO UPDATE SET headstone_uuid=EXCLUDED.headstone_uuid;
  END IF;
END $$;
-- Do not overwrite a concurrent claim invisible to this transaction's snapshot.
-- Row locking plus deferred validation serializes updates; repeatable-read writers
-- receive a serialization error rather than silently introducing a second primary.
REVOKE ALL ON FUNCTION sync_section_g_primary_marker(uuid) FROM PUBLIC;
CREATE FUNCTION check_section_g_primary_markers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE grave uuid; old_grave uuid; new_grave uuid; marker uuid; old_section uuid; new_section uuid;
BEGIN
  IF TG_TABLE_NAME='headstone_gravesites' THEN
    IF TG_OP<>'INSERT' THEN old_grave:=OLD.gravesite_uuid; END IF;
    IF TG_OP<>'DELETE' THEN new_grave:=NEW.gravesite_uuid; END IF;
    FOR grave IN SELECT DISTINCT id FROM unnest(ARRAY[old_grave,new_grave]) id WHERE id IS NOT NULL ORDER BY id LOOP
      PERFORM sync_section_g_primary_marker(grave);
    END LOOP;
  ELSIF TG_TABLE_NAME='headstones' THEN
    IF TG_OP<>'INSERT' THEN old_grave:=OLD.gravesite_uuid; marker:=OLD.id; END IF;
    IF TG_OP<>'DELETE' THEN new_grave:=NEW.gravesite_uuid; marker:=NEW.id; END IF;
    FOR grave IN SELECT id FROM (
      SELECT old_grave AS id UNION SELECT new_grave UNION
      SELECT gravesite_uuid FROM headstone_gravesites WHERE headstone_uuid=marker) affected
      WHERE id IS NOT NULL ORDER BY id LOOP PERFORM sync_section_g_primary_marker(grave); END LOOP;
  ELSIF TG_TABLE_NAME='gravesites' THEN
    IF TG_OP<>'DELETE' THEN PERFORM sync_section_g_primary_marker(NEW.id); END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN old_section:=OLD.section_id; END IF;
    IF TG_OP<>'DELETE' THEN new_section:=NEW.section_id; END IF;
    FOR grave IN SELECT id FROM gravesites WHERE section_uuid IN (old_section,new_section) ORDER BY id LOOP
      PERFORM sync_section_g_primary_marker(grave);
    END LOOP;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION check_section_g_primary_markers() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER section_g_primary_link AFTER INSERT OR UPDATE OR DELETE ON headstone_gravesites
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_section_g_primary_markers();
CREATE CONSTRAINT TRIGGER section_g_primary_headstone AFTER INSERT OR UPDATE OR DELETE ON headstones
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_section_g_primary_markers();
CREATE CONSTRAINT TRIGGER section_g_primary_grave AFTER INSERT OR UPDATE ON gravesites
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_section_g_primary_markers();
CREATE CONSTRAINT TRIGGER section_g_primary_section AFTER UPDATE ON sections
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_section_g_primary_markers();
DO $$ DECLARE grave uuid; BEGIN
  FOR grave IN SELECT id FROM gravesites WHERE deleted_at IS NULL ORDER BY id LOOP
    PERFORM sync_section_g_primary_marker(grave);
  END LOOP;
END $$;
--rollback DROP TRIGGER section_g_primary_section ON sections;
--rollback DROP TRIGGER section_g_primary_grave ON gravesites;
--rollback DROP TRIGGER section_g_primary_headstone ON headstones;
--rollback DROP TRIGGER section_g_primary_link ON headstone_gravesites;
--rollback DROP FUNCTION check_section_g_primary_markers();
--rollback DROP FUNCTION sync_section_g_primary_marker(uuid);
--rollback DROP TABLE section_g_primary_marker_claims;
--rollback DROP TRIGGER assign_marker_identifier ON headstones;
--rollback DROP FUNCTION assign_marker_identifier();
