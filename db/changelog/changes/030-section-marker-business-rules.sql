--liquibase formatted sql

--changeset cemeterymapping:030-section-marker-business-rules splitStatements:false
CREATE OR REPLACE FUNCTION cemetery_section_label_for_gravesite(p_gravesite_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(sections.name, gravesites.section_id)
  FROM gravesites
  LEFT JOIN sections
    ON sections.section_id = gravesites.section_uuid
  WHERE gravesites.id = p_gravesite_uuid
$$;

CREATE OR REPLACE FUNCTION cemetery_marker_type_code(p_marker_type_id uuid, p_marker_type_code text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT marker_types.code FROM marker_types WHERE marker_types.id = p_marker_type_id),
    NULLIF(p_marker_type_code, '')
  )
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

  marker_code := cemetery_marker_type_code(NEW.marker_type_id, NEW.marker_type_code);

  IF NEW.gravesite_uuid IS NOT NULL
    AND upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '')) = 'G'
    AND marker_code <> 'flat_marker' THEN
    RAISE EXCEPTION 'Section G can contain only flat markers.';
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
      AND upper(COALESCE(sections.name, gravesites.section_id, '')) = 'G'
      AND marker_code <> 'flat_marker'
  ) THEN
    RAISE EXCEPTION 'Section G can contain only flat markers.';
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

  IF upper(COALESCE(cemetery_section_label_for_gravesite(NEW.gravesite_uuid), '')) = 'G'
    AND marker_code <> 'flat_marker' THEN
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

DROP TRIGGER IF EXISTS enforce_gravesite_section_rules ON gravesites;
CREATE TRIGGER enforce_gravesite_section_rules
  BEFORE INSERT OR UPDATE OF section_uuid, section_id, deleted_at ON gravesites
  FOR EACH ROW EXECUTE FUNCTION enforce_gravesite_section_rules();

DROP TRIGGER IF EXISTS enforce_headstone_marker_section_rules ON headstones;
CREATE TRIGGER enforce_headstone_marker_section_rules
  BEFORE INSERT OR UPDATE OF marker_type_id, marker_type_code, gravesite_uuid, deleted_at ON headstones
  FOR EACH ROW EXECUTE FUNCTION enforce_headstone_marker_section_rules();

DROP TRIGGER IF EXISTS enforce_headstone_gravesite_section_rules ON headstone_gravesites;
CREATE TRIGGER enforce_headstone_gravesite_section_rules
  BEFORE INSERT OR UPDATE OF headstone_uuid, gravesite_uuid, deleted_at ON headstone_gravesites
  FOR EACH ROW EXECUTE FUNCTION enforce_headstone_gravesite_section_rules();

DROP TRIGGER IF EXISTS enforce_section_record_business_rules ON sections;
CREATE TRIGGER enforce_section_record_business_rules
  BEFORE INSERT OR UPDATE OF name, deleted_at ON sections
  FOR EACH ROW EXECUTE FUNCTION enforce_section_record_business_rules();

--rollback DROP TRIGGER IF EXISTS enforce_section_record_business_rules ON sections;
--rollback DROP TRIGGER IF EXISTS enforce_headstone_gravesite_section_rules ON headstone_gravesites;
--rollback DROP TRIGGER IF EXISTS enforce_headstone_marker_section_rules ON headstones;
--rollback DROP TRIGGER IF EXISTS enforce_gravesite_section_rules ON gravesites;
--rollback DROP FUNCTION IF EXISTS enforce_section_record_business_rules();
--rollback DROP FUNCTION IF EXISTS enforce_headstone_gravesite_section_rules();
--rollback DROP FUNCTION IF EXISTS enforce_headstone_marker_section_rules();
--rollback DROP FUNCTION IF EXISTS enforce_gravesite_section_rules();
--rollback DROP FUNCTION IF EXISTS cemetery_marker_type_code(uuid, text);
--rollback DROP FUNCTION IF EXISTS cemetery_section_label_for_gravesite(uuid);
