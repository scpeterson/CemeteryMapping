--liquibase formatted sql

--changeset scpeterson:035-section-g-burial-capacity splitStatements:false
ALTER TABLE burials
  ADD COLUMN interment_type varchar(20),
  ADD CONSTRAINT burials_interment_type_check CHECK (
    interment_type IS NULL OR interment_type IN ('casket', 'urn')
  );

CREATE OR REPLACE FUNCTION cemetery_section_g_burial_capacity_violation(p_gravesite_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH active_burials AS (
    SELECT COALESCE(NULLIF(btrim(interment_type), ''), 'casket') AS interment_type
    FROM burials
    WHERE gravesite_uuid = p_gravesite_uuid
      AND deleted_at IS NULL
  ),
  burial_counts AS (
    SELECT
      count(*) FILTER (WHERE interment_type = 'urn') AS urn_count,
      count(*) FILTER (WHERE interment_type <> 'urn') AS casket_count
    FROM active_burials
  )
  SELECT EXISTS (
    SELECT 1
    FROM burial_counts
    WHERE casket_count > 1
       OR (casket_count = 1 AND urn_count > 0)
       OR urn_count > 2
  )
$$;

CREATE OR REPLACE FUNCTION enforce_burial_section_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '')) = 'G'
    AND cemetery_section_g_burial_capacity_violation(NEW.gravesite_uuid) THEN
    RAISE EXCEPTION 'Section G gravesites can contain either one casket burial or up to two funeral urn burials.';
  END IF;

  RETURN NEW;
END;
$$;

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

  IF upper(COALESCE(section_label, '')) = 'F' THEN
    RAISE EXCEPTION 'Section F cannot contain gravesites because of underground utility lines.';
  END IF;

  IF upper(COALESCE(section_label, '')) = 'G'
    AND cemetery_section_g_burial_capacity_violation(NEW.id) THEN
    RAISE EXCEPTION 'Section G gravesites can contain either one casket burial or up to two funeral urn burials.';
  END IF;

  IF upper(COALESCE(section_label, '')) = 'G'
    AND EXISTS (
      SELECT 1
      FROM headstones
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      WHERE headstones.deleted_at IS NULL
        AND headstones.gravesite_uuid = NEW.id
        AND marker_types.code <> 'flat_marker'
    ) THEN
    RAISE EXCEPTION 'Section G can contain only flat markers.';
  END IF;

  IF upper(COALESCE(section_label, '')) = 'G'
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
    RAISE EXCEPTION 'Section G can contain only flat markers.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_section_record_business_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF upper(NEW.name) = 'F'
    AND EXISTS (
      SELECT 1
      FROM gravesites
      WHERE gravesites.deleted_at IS NULL
        AND gravesites.section_uuid = NEW.section_id
    ) THEN
    RAISE EXCEPTION 'Section F cannot contain gravesites because of underground utility lines.';
  END IF;

  IF upper(NEW.name) = 'G'
    AND EXISTS (
      SELECT 1
      FROM gravesites
      WHERE gravesites.deleted_at IS NULL
        AND gravesites.section_uuid = NEW.section_id
        AND cemetery_section_g_burial_capacity_violation(gravesites.id)
    ) THEN
    RAISE EXCEPTION 'Section G gravesites can contain either one casket burial or up to two funeral urn burials.';
  END IF;

  IF upper(NEW.name) = 'G'
    AND EXISTS (
      SELECT 1
      FROM gravesites
      JOIN headstones
        ON headstones.gravesite_uuid = gravesites.id
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      WHERE gravesites.deleted_at IS NULL
        AND headstones.deleted_at IS NULL
        AND gravesites.section_uuid = NEW.section_id
        AND marker_types.code <> 'flat_marker'
    ) THEN
    RAISE EXCEPTION 'Section G can contain only flat markers.';
  END IF;

  IF upper(NEW.name) = 'G'
    AND EXISTS (
      SELECT 1
      FROM gravesites
      JOIN headstone_gravesites
        ON headstone_gravesites.gravesite_uuid = gravesites.id
      JOIN headstones
        ON headstones.id = headstone_gravesites.headstone_uuid
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      WHERE gravesites.deleted_at IS NULL
        AND headstone_gravesites.deleted_at IS NULL
        AND headstones.deleted_at IS NULL
        AND gravesites.section_uuid = NEW.section_id
        AND marker_types.code <> 'flat_marker'
    ) THEN
    RAISE EXCEPTION 'Section G can contain only flat markers.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_burial_section_rules ON burials;
CREATE TRIGGER enforce_burial_section_rules
  AFTER INSERT OR UPDATE OF gravesite_uuid, interment_type, deleted_at ON burials
  FOR EACH ROW EXECUTE FUNCTION enforce_burial_section_rules();

--rollback DROP TRIGGER IF EXISTS enforce_burial_section_rules ON burials;
--rollback DROP FUNCTION IF EXISTS enforce_burial_section_rules();
--rollback CREATE OR REPLACE FUNCTION enforce_gravesite_section_rules() RETURNS trigger LANGUAGE plpgsql AS 'DECLARE section_label text; BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; section_label := COALESCE((SELECT sections.name FROM sections WHERE sections.section_id = NEW.section_uuid), NEW.section_id); IF upper(COALESCE(section_label, '''')) = ''F'' THEN RAISE EXCEPTION ''Section F cannot contain gravesites because of underground utility lines.''; END IF; IF upper(COALESCE(section_label, '''')) = ''G'' AND EXISTS (SELECT 1 FROM headstones JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE headstones.deleted_at IS NULL AND headstones.gravesite_uuid = NEW.id AND marker_types.code <> ''flat_marker'') THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; IF upper(COALESCE(section_label, '''')) = ''G'' AND EXISTS (SELECT 1 FROM headstone_gravesites JOIN headstones ON headstones.id = headstone_gravesites.headstone_uuid JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE headstone_gravesites.deleted_at IS NULL AND headstones.deleted_at IS NULL AND headstone_gravesites.gravesite_uuid = NEW.id AND marker_types.code <> ''flat_marker'') THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; RETURN NEW; END;';
--rollback CREATE OR REPLACE FUNCTION enforce_section_record_business_rules() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF; IF upper(NEW.name) = ''F'' AND EXISTS (SELECT 1 FROM gravesites WHERE gravesites.deleted_at IS NULL AND gravesites.section_uuid = NEW.section_id) THEN RAISE EXCEPTION ''Section F cannot contain gravesites because of underground utility lines.''; END IF; IF upper(NEW.name) = ''G'' AND EXISTS (SELECT 1 FROM gravesites JOIN headstones ON headstones.gravesite_uuid = gravesites.id JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE gravesites.deleted_at IS NULL AND headstones.deleted_at IS NULL AND gravesites.section_uuid = NEW.section_id AND marker_types.code <> ''flat_marker'') THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; IF upper(NEW.name) = ''G'' AND EXISTS (SELECT 1 FROM gravesites JOIN headstone_gravesites ON headstone_gravesites.gravesite_uuid = gravesites.id JOIN headstones ON headstones.id = headstone_gravesites.headstone_uuid JOIN marker_types ON marker_types.id = headstones.marker_type_id WHERE gravesites.deleted_at IS NULL AND headstone_gravesites.deleted_at IS NULL AND headstones.deleted_at IS NULL AND gravesites.section_uuid = NEW.section_id AND marker_types.code <> ''flat_marker'') THEN RAISE EXCEPTION ''Section G can contain only flat markers.''; END IF; RETURN NEW; END;';
--rollback DROP FUNCTION IF EXISTS cemetery_section_g_burial_capacity_violation(uuid);
--rollback ALTER TABLE burials DROP CONSTRAINT IF EXISTS burials_interment_type_check;
--rollback ALTER TABLE burials DROP COLUMN IF EXISTS interment_type;
