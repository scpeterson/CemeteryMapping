--liquibase formatted sql

--changeset cemeterymapping:521-scoped-location-policies splitStatements:false
-- Typed handler catalog, with explicit false overrides and nearest-scope inheritance.
-- No executable expressions, cemetery names, or section letters are stored as rules.
CREATE TABLE location_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE CASCADE,
  section_uuid uuid REFERENCES sections(section_id) ON DELETE CASCADE,
  block_uuid uuid REFERENCES blocks(id) ON DELETE CASCADE,
  rule_key text NOT NULL CHECK (rule_key IN ('no_gravesites','no_interactive_creation',
    'flat_markers_only','single_primary_marker','casket_or_two_urns')),
  enabled boolean NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  CHECK (section_uuid IS NULL OR cemetery_id IS NOT NULL),
  CHECK (block_uuid IS NULL OR section_uuid IS NOT NULL),
  UNIQUE NULLS NOT DISTINCT (cemetery_id, section_uuid, block_uuid, rule_key)
);

-- A revision row makes old repeatable-read data writers fail rather than enforce
-- a policy snapshot older than an owner policy change. Runtime DML is excluded.
CREATE TABLE location_policy_revision (singleton boolean PRIMARY KEY CHECK(singleton), revision bigint NOT NULL);
INSERT INTO location_policy_revision VALUES(true,0);
CREATE FUNCTION lock_location_policy_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM location_policy_revision WHERE singleton FOR SHARE;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION lock_location_policy_revision() FROM PUBLIC;
CREATE TRIGGER lock_location_policy_revision BEFORE INSERT OR UPDATE OR DELETE ON gravesites
 FOR EACH ROW EXECUTE FUNCTION lock_location_policy_revision();
CREATE TRIGGER lock_location_policy_revision BEFORE INSERT OR UPDATE OR DELETE ON headstones
 FOR EACH ROW EXECUTE FUNCTION lock_location_policy_revision();
CREATE TRIGGER lock_location_policy_revision BEFORE INSERT OR UPDATE OR DELETE ON headstone_gravesites
 FOR EACH ROW EXECUTE FUNCTION lock_location_policy_revision();
CREATE TRIGGER lock_location_policy_revision BEFORE INSERT OR UPDATE OR DELETE ON burials
 FOR EACH ROW EXECUTE FUNCTION lock_location_policy_revision();
CREATE TRIGGER lock_location_policy_revision BEFORE UPDATE OR DELETE ON sections
 FOR EACH ROW EXECUTE FUNCTION lock_location_policy_revision();
CREATE TRIGGER lock_location_policy_revision BEFORE UPDATE OR DELETE ON blocks
 FOR EACH ROW EXECUTE FUNCTION lock_location_policy_revision();

CREATE FUNCTION validate_location_policy_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.section_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sections
    WHERE section_id=NEW.section_uuid AND cemetery_id=NEW.cemetery_id) THEN
    RAISE EXCEPTION 'Policy section must belong to its cemetery' USING ERRCODE='23514';
  END IF;
  IF NEW.block_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM blocks
    WHERE id=NEW.block_uuid AND section_uuid=NEW.section_uuid AND cemetery_id=NEW.cemetery_id) THEN
    RAISE EXCEPTION 'Policy block must belong to its section and cemetery' USING ERRCODE='23514';
  END IF;
  IF NEW.block_uuid IS NOT NULL AND EXISTS (SELECT 1 FROM gravesites g JOIN blocks b ON b.id=NEW.block_uuid
    WHERE g.cemetery_id=NEW.cemetery_id AND g.block_uuid IS NULL AND g.block_id=b.block_id
      AND (g.section_uuid=NEW.section_uuid OR (g.section_uuid IS NULL AND g.section_id=(SELECT name FROM sections WHERE section_id=NEW.section_uuid)))
      AND g.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Assign canonical block UUIDs to legacy graves before configuring a block policy' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_location_policy_scope BEFORE INSERT OR UPDATE ON location_policies
  FOR EACH ROW EXECUTE FUNCTION validate_location_policy_scope();

CREATE FUNCTION resolve_location_policy(p_cemetery uuid, p_section uuid, p_block uuid, p_rule text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT enabled FROM location_policies
    WHERE rule_key=p_rule AND (cemetery_id IS NULL OR cemetery_id=p_cemetery)
      AND (section_uuid IS NULL OR section_uuid=p_section)
      AND (block_uuid IS NULL OR block_uuid=p_block)
    ORDER BY (block_uuid IS NOT NULL) DESC, (section_uuid IS NOT NULL) DESC,
      (cemetery_id IS NOT NULL) DESC LIMIT 1), false)
$$;

-- Legacy labels resolve only inside the grave's own cemetery. An explicit UUID wins.
CREATE FUNCTION gravesite_location_policy(p_grave uuid, p_rule text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT resolve_location_policy(g.cemetery_id,
    coalesce(g.section_uuid, (SELECT s.section_id FROM sections s
      WHERE s.cemetery_id=g.cemetery_id AND s.name=g.section_id AND s.deleted_at IS NULL)),
    g.block_uuid,p_rule) FROM gravesites g WHERE g.id=p_grave AND g.deleted_at IS NULL),false)
$$;
CREATE FUNCTION gravesite_location_policies(p_grave uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_object_agg(rule,gravesite_location_policy(p_grave,rule)) FROM unnest(ARRAY[
   'no_gravesites','no_interactive_creation','flat_markers_only','single_primary_marker','casket_or_two_urns']) rule
$$;

CREATE FUNCTION headstone_requires_flat_marker(p_marker uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 WITH associated AS MATERIALIZED (
   SELECT gravesite_uuid AS id FROM headstones WHERE id=p_marker AND deleted_at IS NULL
   UNION
   SELECT l.gravesite_uuid FROM headstone_gravesites l JOIN headstones h ON h.id=l.headstone_uuid
     WHERE h.id=p_marker AND h.deleted_at IS NULL AND l.deleted_at IS NULL
 )
 SELECT EXISTS (SELECT 1 FROM associated a JOIN gravesites g ON g.id=a.id WHERE g.deleted_at IS NULL
   AND (gravesite_location_policy(g.id,'flat_markers_only') OR gravesite_location_policy(g.id,'single_primary_marker')))
$$;

-- One-time adoption of the restrictions that previously applied to these existing
-- section identities. Future sections, including another F/G, inherit base behavior.
INSERT INTO location_policies(cemetery_id,section_uuid,rule_key,enabled,reason)
SELECT s.cemetery_id,s.section_id,r.rule,true,'Adopt existing section restriction at migration 521'
FROM sections s CROSS JOIN (VALUES
 ('F','no_gravesites'),('G','flat_markers_only'),('G','single_primary_marker'),
 ('G','casket_or_two_urns'),('E','no_interactive_creation'),('F','no_interactive_creation'),
 ('G','no_interactive_creation')) r(label,rule)
WHERE upper(s.name)=r.label;

CREATE FUNCTION validate_gravesite_location_policy(grave uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE g gravesites; marker uuid;
BEGIN
 SELECT * INTO g FROM gravesites WHERE id=grave AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN; END IF;
 IF (g.section_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sections
    WHERE section_id=g.section_uuid AND cemetery_id=g.cemetery_id)) OR
    (g.block_uuid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM blocks b
    WHERE b.id=g.block_uuid AND b.cemetery_id=g.cemetery_id
      AND b.section_uuid IS NOT DISTINCT FROM coalesce(g.section_uuid,(SELECT section_id FROM sections
        WHERE cemetery_id=g.cemetery_id AND name=g.section_id AND deleted_at IS NULL)))) THEN
   RAISE EXCEPTION 'Gravesite policy ancestry must stay within its cemetery and section' USING ERRCODE='23514';
 END IF;
 IF g.block_uuid IS NULL AND EXISTS (SELECT 1 FROM blocks b JOIN location_policies p ON p.block_uuid=b.id
   WHERE b.cemetery_id=g.cemetery_id AND b.block_id=g.block_id
     AND b.section_uuid=coalesce(g.section_uuid,(SELECT section_id FROM sections
       WHERE cemetery_id=g.cemetery_id AND name=g.section_id AND deleted_at IS NULL))) THEN
   RAISE EXCEPTION 'Assign a canonical block UUID before using a policy-controlled block'
     USING ERRCODE='23514', CONSTRAINT='location_policy_legacy_block';
 END IF;
 IF gravesite_location_policy(grave,'no_gravesites') THEN
   RAISE EXCEPTION 'Location policy prohibits gravesites (underground utility restriction).' USING ERRCODE='23514', CONSTRAINT='location_policy_gravesites';
 END IF;
 IF gravesite_location_policy(grave,'casket_or_two_urns') AND cemetery_section_g_burial_capacity_violation(grave) THEN
   RAISE EXCEPTION 'Location policy permits either one casket burial or up to two funeral urn burials.' USING ERRCODE='23514', CONSTRAINT='location_policy_capacity';
 END IF;
 IF gravesite_location_policy(grave,'flat_markers_only') AND EXISTS (
   SELECT 1 FROM headstones h JOIN marker_types t ON t.id=h.marker_type_id
   WHERE h.deleted_at IS NULL AND t.code<>'flat_marker' AND (h.gravesite_uuid=grave OR EXISTS (
     SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=grave AND l.deleted_at IS NULL))) THEN
   RAISE EXCEPTION 'Location policy permits only flat markers.' USING ERRCODE='23514', CONSTRAINT='location_policy_markers';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION enforce_gravesite_section_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  section_label text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  section_label := COALESCE(
    (SELECT sections.name FROM sections WHERE sections.section_id = NEW.section_uuid),
    NEW.section_id
  );

  IF resolve_location_policy(NEW.cemetery_id,coalesce(NEW.section_uuid,(SELECT section_id FROM sections WHERE cemetery_id=NEW.cemetery_id AND name=NEW.section_id AND deleted_at IS NULL)),NEW.block_uuid,'no_gravesites') THEN
    RAISE EXCEPTION 'Location policy prohibits gravesites (underground utility restriction).' USING ERRCODE='23514', CONSTRAINT='location_policy_gravesites';
  END IF;

  IF resolve_location_policy(NEW.cemetery_id,coalesce(NEW.section_uuid,(SELECT section_id FROM sections WHERE cemetery_id=NEW.cemetery_id AND name=NEW.section_id AND deleted_at IS NULL)),NEW.block_uuid,'casket_or_two_urns')
    AND cemetery_section_g_burial_capacity_violation(NEW.id) THEN
    RAISE EXCEPTION 'Location policy permits either one casket burial or up to two funeral urn burials.' USING ERRCODE='23514', CONSTRAINT='location_policy_capacity';
  END IF;

  IF resolve_location_policy(NEW.cemetery_id,coalesce(NEW.section_uuid,(SELECT section_id FROM sections WHERE cemetery_id=NEW.cemetery_id AND name=NEW.section_id AND deleted_at IS NULL)),NEW.block_uuid,'flat_markers_only')
    AND EXISTS (
      SELECT 1
      FROM headstones
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      WHERE headstones.deleted_at IS NULL
        AND headstones.gravesite_uuid = NEW.id
        AND marker_types.code <> 'flat_marker'
    ) THEN
    RAISE EXCEPTION 'Location policy permits only flat markers.' USING ERRCODE='23514', CONSTRAINT='location_policy_markers';
  END IF;

  IF resolve_location_policy(NEW.cemetery_id,coalesce(NEW.section_uuid,(SELECT section_id FROM sections WHERE cemetery_id=NEW.cemetery_id AND name=NEW.section_id AND deleted_at IS NULL)),NEW.block_uuid,'flat_markers_only')
    AND EXISTS (
      SELECT 1
      FROM headstone_gravesites
      JOIN headstones
        ON headstones.id = headstone_gravesites.headstone_uuid
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      WHERE headstone_gravesites.deleted_at IS NULL
        AND headstones.deleted_at IS NULL
        AND headstone_gravesites.gravesite_uuid = NEW.id
        AND marker_types.code <> 'flat_marker'
    ) THEN
    RAISE EXCEPTION 'Location policy permits only flat markers.' USING ERRCODE='23514', CONSTRAINT='location_policy_markers';
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION enforce_section_record_business_rules() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.name IS DISTINCT FROM OLD.name
   AND EXISTS (SELECT 1 FROM location_policies WHERE section_uuid=OLD.section_id)
   AND EXISTS (SELECT 1 FROM gravesites WHERE cemetery_id=OLD.cemetery_id
     AND section_uuid IS NULL AND section_id=OLD.name AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'Assign canonical section UUIDs to legacy graves before renaming this policy section'
     USING ERRCODE='23514', CONSTRAINT='location_policy_legacy_section';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION enforce_burial_section_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF gravesite_location_policy(NEW.gravesite_uuid,'casket_or_two_urns')
    AND cemetery_section_g_burial_capacity_violation(NEW.gravesite_uuid) THEN
    RAISE EXCEPTION 'Location policy permits either one casket burial or up to two funeral urn burials.' USING ERRCODE='23514', CONSTRAINT='location_policy_capacity';
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION enforce_headstone_marker_section_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  marker_code text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  marker_code := cemetery_marker_type_code(NEW.marker_type_id);

  IF NEW.gravesite_uuid IS NOT NULL
    AND gravesite_location_policy(NEW.gravesite_uuid,'flat_markers_only')
    AND marker_code <> 'flat_marker' THEN
    RAISE EXCEPTION 'Location policy permits only flat markers.' USING ERRCODE='23514', CONSTRAINT='location_policy_markers';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM headstone_gravesites
    JOIN gravesites
      ON gravesites.id = headstone_gravesites.gravesite_uuid
    LEFT JOIN sections
      ON sections.section_id = gravesites.section_uuid
    WHERE headstone_gravesites.deleted_at IS NULL
      AND gravesites.deleted_at IS NULL
      AND headstone_gravesites.headstone_uuid = NEW.id
      AND gravesite_location_policy(gravesites.id,'flat_markers_only')
      AND marker_code <> 'flat_marker'
  ) THEN
    RAISE EXCEPTION 'Location policy permits only flat markers.' USING ERRCODE='23514', CONSTRAINT='location_policy_markers';
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION enforce_headstone_gravesite_section_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  marker_code text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT marker_types.code
  INTO marker_code
  FROM headstones
  JOIN marker_types
    ON marker_types.id = headstones.marker_type_id
  WHERE headstones.id = NEW.headstone_uuid
    AND headstones.deleted_at IS NULL;

  IF gravesite_location_policy(NEW.gravesite_uuid,'flat_markers_only')
    AND marker_code <> 'flat_marker' THEN
    RAISE EXCEPTION 'Location policy permits only flat markers.' USING ERRCODE='23514', CONSTRAINT='location_policy_markers';
  END IF;

  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION sync_section_g_primary_marker(grave uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE marker uuid; markers uuid[];
BEGIN
  PERFORM 1 FROM gravesites WHERE id=grave FOR UPDATE;
  PERFORM validate_gravesite_location_policy(grave);
  SELECT array_agg(DISTINCT h.id ORDER BY h.id) INTO markers
  FROM gravesites g JOIN headstones h ON h.deleted_at IS NULL AND (
    EXISTS (SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=g.id
            AND l.deleted_at IS NULL)
    OR (h.gravesite_uuid=g.id AND NOT EXISTS (
      SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=g.id AND l.deleted_at IS NULL)))
  WHERE g.id=grave AND g.deleted_at IS NULL
    AND gravesite_location_policy(g.id,'single_primary_marker');
  IF cardinality(markers)>1 OR EXISTS (
    SELECT 1 FROM headstones h LEFT JOIN marker_types t ON t.id=h.marker_type_id
    WHERE h.id=ANY(markers) AND (t.code IS DISTINCT FROM 'flat_marker' OR EXISTS (
      SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id
        AND l.gravesite_uuid=grave AND l.deleted_at IS NULL AND l.relationship_type NOT IN ('primary','spans')))
  ) THEN
    RAISE EXCEPTION 'Location policy permits only one flat marker per gravesite (primary or spanning) (%)', grave
      USING ERRCODE='23514', CONSTRAINT='section_g_single_primary';
  END IF;
  marker:=markers[1];
  IF marker IS NULL THEN DELETE FROM section_g_primary_marker_claims WHERE gravesite_uuid=grave;
  ELSE
    INSERT INTO section_g_primary_marker_claims VALUES(grave,marker)
    ON CONFLICT(gravesite_uuid) DO UPDATE SET headstone_uuid=EXCLUDED.headstone_uuid;
  END IF;
END $$;
-- A capacity claim serializes competing burial writers without changing grave
-- timestamps, audit history, geometry or reservations. The final deferred check
-- sees committed peers; an obsolete repeatable-read writer gets a serialization error.
CREATE TABLE location_burial_capacity_claims (
 gravesite_uuid uuid PRIMARY KEY REFERENCES gravesites(id) ON DELETE CASCADE,
 revision bigint NOT NULL
);
CREATE FUNCTION lock_burial_location_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE grave uuid; old_grave uuid; new_grave uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN old_grave:=OLD.gravesite_uuid; END IF;
 IF TG_OP<>'DELETE' THEN new_grave:=NEW.gravesite_uuid; END IF;
 FOR grave IN SELECT DISTINCT id FROM unnest(ARRAY[old_grave,new_grave]) id WHERE id IS NOT NULL ORDER BY id LOOP
   IF gravesite_location_policy(grave,'casket_or_two_urns') THEN
     INSERT INTO location_burial_capacity_claims VALUES(grave,1)
     ON CONFLICT(gravesite_uuid) DO UPDATE SET revision=location_burial_capacity_claims.revision+1;
   END IF;
 END LOOP;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
REVOKE ALL ON FUNCTION lock_burial_location_capacity() FROM PUBLIC;
CREATE TRIGGER lock_burial_location_capacity BEFORE INSERT OR UPDATE OR DELETE ON burials
 FOR EACH ROW EXECUTE FUNCTION lock_burial_location_capacity();
CREATE FUNCTION check_burial_location_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP<>'DELETE' THEN PERFORM sync_section_g_primary_marker(NEW.gravesite_uuid); END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION check_burial_location_capacity() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER check_burial_location_capacity AFTER INSERT OR UPDATE ON burials
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_burial_location_capacity();

-- Revalidate all affected records, including legacy links, on policy or ancestry edits.
-- Policy writes are deployment/owner operations only in this first step. Serialize
-- against data writers before changing policy, then validate the final transaction.
CREATE FUNCTION lock_location_policy_data() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('transaction_isolation') <> 'read committed' THEN
   RAISE EXCEPTION 'Policy changes require read committed isolation' USING ERRCODE='25000';
 END IF;
 LOCK TABLE gravesites, headstones, headstone_gravesites, burials, sections, blocks IN SHARE ROW EXCLUSIVE MODE;
 UPDATE location_policy_revision SET revision=revision+1 WHERE singleton;
 RETURN NULL;
END $$;
CREATE TRIGGER lock_location_policy_data BEFORE INSERT OR UPDATE OR DELETE ON location_policies
 FOR EACH STATEMENT EXECUTE FUNCTION lock_location_policy_data();
CREATE FUNCTION recheck_location_policies() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE grave uuid; old_scope jsonb; new_scope jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN old_scope:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN new_scope:=to_jsonb(NEW); END IF;
 FOR grave IN SELECT id FROM gravesites WHERE deleted_at IS NULL AND (
   cemetery_id IN ((old_scope->>'cemetery_id')::uuid,(new_scope->>'cemetery_id')::uuid)
   OR (TG_TABLE_NAME='location_policies' AND (
     (old_scope IS NOT NULL AND old_scope->>'cemetery_id' IS NULL)
     OR (new_scope IS NOT NULL AND new_scope->>'cemetery_id' IS NULL)))) ORDER BY id LOOP
   PERFORM sync_section_g_primary_marker(grave);
 END LOOP;
 IF EXISTS (SELECT 1 FROM location_policies p JOIN sections s ON s.section_id=p.section_uuid
   WHERE p.cemetery_id<>s.cemetery_id) OR EXISTS (
   SELECT 1 FROM location_policies p JOIN blocks b ON b.id=p.block_uuid
   WHERE p.cemetery_id<>b.cemetery_id OR p.section_uuid IS DISTINCT FROM b.section_uuid) THEN
   RAISE EXCEPTION 'Policy ancestry cannot cross cemetery or section boundaries' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION recheck_location_policies() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER recheck_location_policies AFTER INSERT OR UPDATE OR DELETE ON location_policies
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION recheck_location_policies();
CREATE CONSTRAINT TRIGGER recheck_block_policies AFTER UPDATE ON blocks
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION recheck_location_policies();
CREATE CONSTRAINT TRIGGER recheck_section_policies AFTER UPDATE ON sections
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION recheck_location_policies();
DO $$ DECLARE grave uuid; BEGIN
 FOR grave IN SELECT id FROM gravesites WHERE deleted_at IS NULL ORDER BY id LOOP
  PERFORM sync_section_g_primary_marker(grave);
 END LOOP;
END $$;

--rollback DROP TRIGGER check_burial_location_capacity ON burials;
--rollback DROP TRIGGER lock_burial_location_capacity ON burials;
--rollback DROP FUNCTION check_burial_location_capacity();
--rollback DROP FUNCTION lock_burial_location_capacity();
--rollback DROP TABLE location_burial_capacity_claims;
--rollback DROP TRIGGER lock_location_policy_revision ON gravesites;
--rollback DROP TRIGGER lock_location_policy_revision ON headstones;
--rollback DROP TRIGGER lock_location_policy_revision ON headstone_gravesites;
--rollback DROP TRIGGER lock_location_policy_revision ON burials;
--rollback DROP TRIGGER lock_location_policy_revision ON sections;
--rollback DROP TRIGGER lock_location_policy_revision ON blocks;
--rollback DROP TRIGGER recheck_section_policies ON sections;
--rollback DROP TRIGGER recheck_block_policies ON blocks;
--rollback DROP TRIGGER recheck_location_policies ON location_policies;
--rollback DROP TRIGGER lock_location_policy_data ON location_policies;
--rollback CREATE OR REPLACE FUNCTION enforce_gravesite_section_rules() RETURNS trigger LANGUAGE plpgsql AS ' DECLARE section_label text; BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; section_label := COALESCE( (SELECT sections.name FROM sections WHERE sections.section_id = NEW.section_uuid), NEW.section_id ); IF upper(COALESCE(section_label, '''')) = ''F'' THEN RAISE EXCEPTION ''Section F cannot contain gravesites because of underground utility lines.''; END IF; IF upper(COALESCE(section_label, '''')) = ''G'' AND cemetery_section_g_burial_capacity_violation(NEW.id) THEN RAISE EXCEPTION ''Section G gravesites can contain either one casket burial or up to two funeral urn burials.''; END IF; IF upper(COALESCE(section_label, '''')) = ''G'' AND EXISTS ( SELECT 1 FROM headstones JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE headstones.deleted_at IS NULL AND headstones.gravesite_uuid = NEW.id AND marker_types.code <> ''flat_marker'' ) THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; IF upper(COALESCE(section_label, '''')) = ''G'' AND EXISTS ( SELECT 1 FROM headstone_gravesites JOIN headstones ON headstones.id = headstone_gravesites.headstone_uuid JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE headstone_gravesites.deleted_at IS NULL AND headstones.deleted_at IS NULL AND headstone_gravesites.gravesite_uuid = NEW.id AND marker_types.code <> ''flat_marker'' ) THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; RETURN NEW; END; ';
--rollback CREATE OR REPLACE FUNCTION enforce_section_record_business_rules() RETURNS trigger LANGUAGE plpgsql AS ' BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; IF upper(NEW.name) = ''F'' AND EXISTS ( SELECT 1 FROM gravesites WHERE gravesites.deleted_at IS NULL AND gravesites.section_uuid = NEW.section_id ) THEN RAISE EXCEPTION ''Section F cannot contain gravesites because of underground utility lines.''; END IF; IF upper(NEW.name) = ''G'' AND EXISTS ( SELECT 1 FROM gravesites WHERE gravesites.deleted_at IS NULL AND gravesites.section_uuid = NEW.section_id AND cemetery_section_g_burial_capacity_violation(gravesites.id) ) THEN RAISE EXCEPTION ''Section G gravesites can contain either one casket burial or up to two funeral urn burials.''; END IF; IF upper(NEW.name) = ''G'' AND EXISTS ( SELECT 1 FROM gravesites JOIN headstones ON headstones.gravesite_uuid = gravesites.id JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE gravesites.deleted_at IS NULL AND headstones.deleted_at IS NULL AND gravesites.section_uuid = NEW.section_id AND marker_types.code <> ''flat_marker'' ) THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; IF upper(NEW.name) = ''G'' AND EXISTS ( SELECT 1 FROM gravesites JOIN headstone_gravesites ON headstone_gravesites.gravesite_uuid = gravesites.id JOIN headstones ON headstones.id = headstone_gravesites.headstone_uuid JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE gravesites.deleted_at IS NULL AND headstone_gravesites.deleted_at IS NULL AND headstones.deleted_at IS NULL AND gravesites.section_uuid = NEW.section_id AND marker_types.code <> ''flat_marker'' ) THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; RETURN NEW; END; ';
--rollback CREATE OR REPLACE FUNCTION enforce_burial_section_rules() RETURNS trigger LANGUAGE plpgsql AS ' BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; IF upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '''')) = ''G'' AND cemetery_section_g_burial_capacity_violation(NEW.gravesite_uuid) THEN RAISE EXCEPTION ''Section G gravesites can contain either one casket burial or up to two funeral urn burials.''; END IF; RETURN NEW; END; ';
--rollback CREATE OR REPLACE FUNCTION enforce_headstone_marker_section_rules() RETURNS trigger LANGUAGE plpgsql AS ' DECLARE marker_code text; BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; marker_code := cemetery_marker_type_code(NEW.marker_type_id); IF NEW.gravesite_uuid IS NOT NULL AND upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '''')) = ''G'' AND marker_code <> ''flat_marker'' THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; IF EXISTS ( SELECT 1 FROM headstone_gravesites JOIN gravesites ON gravesites.id = headstone_gravesites.gravesite_uuid LEFT JOIN sections ON sections.section_id = gravesites.section_uuid WHERE headstone_gravesites.deleted_at IS NULL AND gravesites.deleted_at IS NULL AND headstone_gravesites.headstone_uuid = NEW.id AND upper(COALESCE(sections.name, gravesites.section_id, '''')) = ''G'' AND marker_code <> ''flat_marker'' ) THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; RETURN NEW; END; ';
--rollback CREATE OR REPLACE FUNCTION enforce_headstone_gravesite_section_rules() RETURNS trigger LANGUAGE plpgsql AS ' DECLARE marker_code text; BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; SELECT marker_types.code INTO marker_code FROM headstones JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE headstones.id = NEW.headstone_uuid AND headstones.deleted_at IS NULL; IF upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '''')) = ''G'' AND marker_code <> ''flat_marker'' THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; RETURN NEW; END; ';
--rollback CREATE OR REPLACE FUNCTION sync_section_g_primary_marker(grave uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS ' DECLARE marker uuid; markers uuid[]; BEGIN PERFORM 1 FROM gravesites WHERE id=grave FOR UPDATE; SELECT array_agg(DISTINCT h.id ORDER BY h.id) INTO markers FROM gravesites g JOIN headstones h ON h.deleted_at IS NULL AND ( EXISTS (SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=g.id AND l.deleted_at IS NULL) OR (h.gravesite_uuid=g.id AND NOT EXISTS ( SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=g.id AND l.deleted_at IS NULL))) WHERE g.id=grave AND g.deleted_at IS NULL AND upper(coalesce((SELECT name FROM sections WHERE section_id=g.section_uuid),g.section_id,''''))=''G''; IF cardinality(markers)>1 OR EXISTS ( SELECT 1 FROM headstones h LEFT JOIN marker_types t ON t.id=h.marker_type_id WHERE h.id=ANY(markers) AND (t.code IS DISTINCT FROM ''flat_marker'' OR EXISTS ( SELECT 1 FROM headstone_gravesites l WHERE l.headstone_uuid=h.id AND l.gravesite_uuid=grave AND l.deleted_at IS NULL AND l.relationship_type NOT IN (''primary'',''spans''))) ) THEN RAISE EXCEPTION ''Section G permits only one flat marker per gravesite (primary or spanning) (%)'', grave USING ERRCODE=''23514'', CONSTRAINT=''section_g_single_primary''; END IF; marker:=markers[1]; IF marker IS NULL THEN DELETE FROM section_g_primary_marker_claims WHERE gravesite_uuid=grave; ELSE INSERT INTO section_g_primary_marker_claims VALUES(grave,marker) ON CONFLICT(gravesite_uuid) DO UPDATE SET headstone_uuid=EXCLUDED.headstone_uuid; END IF; END ';
--rollback DO 'DECLARE grave uuid; label text; BEGIN FOR grave IN SELECT id FROM gravesites WHERE deleted_at IS NULL ORDER BY id LOOP label:=upper(coalesce(cemetery_section_label_for_gravesite(grave),'''')); IF label=''F'' OR (label=''G'' AND cemetery_section_g_burial_capacity_violation(grave)) THEN RAISE EXCEPTION ''Existing records cannot satisfy the former section-letter rules; resolve the conflict before rollback''; END IF; PERFORM sync_section_g_primary_marker(grave); END LOOP; END';
--rollback DROP FUNCTION recheck_location_policies();
--rollback DROP FUNCTION lock_location_policy_data();
--rollback DROP FUNCTION validate_gravesite_location_policy(uuid);
--rollback DROP FUNCTION headstone_requires_flat_marker(uuid);
--rollback DROP FUNCTION gravesite_location_policies(uuid);
--rollback DROP FUNCTION gravesite_location_policy(uuid,text);
--rollback DROP FUNCTION resolve_location_policy(uuid,uuid,uuid,text);
--rollback DROP TABLE location_policies;
--rollback DROP FUNCTION validate_location_policy_scope();
--rollback DROP FUNCTION lock_location_policy_revision();
--rollback DROP TABLE location_policy_revision;
