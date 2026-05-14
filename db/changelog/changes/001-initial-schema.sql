--liquibase formatted sql

--changeset scpeterson:001-initial-schema splitStatements:false
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE cemeteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  boundary geometry(Polygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cemetery_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  geometry geometry(Polygon, 4326) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cemetery_sections_code_unique UNIQUE (cemetery_id, code)
);

CREATE TABLE grave_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE,
  section_id uuid REFERENCES cemetery_sections(id) ON DELETE SET NULL,
  grave_code text NOT NULL,
  lot_code text NOT NULL,
  space_code text NOT NULL,
  status text NOT NULL DEFAULT 'unknown',
  geometry geometry(Polygon, 4326) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grave_spaces_status_check
    CHECK (status IN ('available', 'reserved', 'occupied', 'sold', 'unknown')),
  CONSTRAINT grave_spaces_code_unique UNIQUE (cemetery_id, grave_code),
  CONSTRAINT grave_spaces_lot_space_unique UNIQUE (cemetery_id, section_id, lot_code, space_code)
);

CREATE TABLE owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  contact_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  birth_date date,
  death_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE burials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grave_space_id uuid NOT NULL REFERENCES grave_spaces(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  burial_date date,
  interment_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT burials_person_unique UNIQUE (person_id)
);

CREATE TABLE source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  document_type text NOT NULL,
  reference_code text,
  storage_uri text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ownership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grave_space_id uuid NOT NULL REFERENCES grave_spaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  effective_date date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text NOT NULL,
  source_document_id uuid REFERENCES source_documents(id) ON DELETE SET NULL,
  document_reference text,
  notes text,
  CONSTRAINT ownership_events_type_check
    CHECK (event_type IN ('purchase', 'transfer', 'inheritance', 'correction', 'release'))
);

CREATE TABLE ownership_event_owners (
  ownership_event_id uuid NOT NULL REFERENCES ownership_events(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  ownership_role text NOT NULL DEFAULT 'owner',
  share_numerator integer,
  share_denominator integer,
  PRIMARY KEY (ownership_event_id, owner_id),
  CONSTRAINT ownership_event_owners_share_check
    CHECK (
      (share_numerator IS NULL AND share_denominator IS NULL)
      OR (share_numerator > 0 AND share_denominator > 0 AND share_numerator <= share_denominator)
    )
);

CREATE TABLE grave_space_documents (
  grave_space_id uuid NOT NULL REFERENCES grave_spaces(id) ON DELETE CASCADE,
  source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  notes text,
  PRIMARY KEY (grave_space_id, source_document_id, relationship_type)
);

CREATE INDEX cemeteries_boundary_gix ON cemeteries USING gist (boundary);
CREATE INDEX cemetery_sections_geometry_gix ON cemetery_sections USING gist (geometry);
CREATE INDEX grave_spaces_geometry_gix ON grave_spaces USING gist (geometry);
CREATE INDEX grave_spaces_status_idx ON grave_spaces (status);
CREATE INDEX grave_spaces_lookup_idx ON grave_spaces (cemetery_id, section_id, lot_code, space_code);
CREATE INDEX owners_display_name_trgm_idx ON owners USING gin (lower(display_name) gin_trgm_ops);
CREATE INDEX people_last_first_name_idx ON people (lower(last_name), lower(first_name));
CREATE INDEX people_last_name_trgm_idx ON people USING gin (lower(last_name) gin_trgm_ops);
CREATE INDEX people_birth_date_idx ON people (birth_date);
CREATE INDEX people_death_date_idx ON people (death_date);
CREATE INDEX burials_burial_date_idx ON burials (burial_date);
CREATE INDEX ownership_events_grave_effective_idx
  ON ownership_events (grave_space_id, effective_date DESC, recorded_at DESC, id DESC);
CREATE INDEX ownership_event_owners_owner_idx ON ownership_event_owners (owner_id);

CREATE VIEW current_ownership_events AS
SELECT DISTINCT ON (grave_space_id)
  id,
  grave_space_id,
  event_type,
  effective_date,
  recorded_at,
  recorded_by,
  source_document_id,
  document_reference,
  notes
FROM ownership_events
ORDER BY grave_space_id, effective_date DESC, recorded_at DESC, id DESC;

CREATE VIEW current_grave_owners AS
SELECT
  current_ownership_events.grave_space_id,
  current_ownership_events.id AS ownership_event_id,
  current_ownership_events.event_type,
  current_ownership_events.effective_date,
  owners.id AS owner_id,
  owners.display_name,
  ownership_event_owners.ownership_role,
  ownership_event_owners.share_numerator,
  ownership_event_owners.share_denominator
FROM current_ownership_events
JOIN ownership_event_owners
  ON ownership_event_owners.ownership_event_id = current_ownership_events.id
JOIN owners
  ON owners.id = ownership_event_owners.owner_id
WHERE current_ownership_events.event_type <> 'release';

--rollback DROP VIEW IF EXISTS current_grave_owners;
--rollback DROP VIEW IF EXISTS current_ownership_events;
--rollback DROP TABLE IF EXISTS grave_space_documents;
--rollback DROP TABLE IF EXISTS ownership_event_owners;
--rollback DROP TABLE IF EXISTS ownership_events;
--rollback DROP TABLE IF EXISTS source_documents;
--rollback DROP TABLE IF EXISTS burials;
--rollback DROP TABLE IF EXISTS people;
--rollback DROP TABLE IF EXISTS owners;
--rollback DROP TABLE IF EXISTS grave_spaces;
--rollback DROP TABLE IF EXISTS cemetery_sections;
--rollback DROP TABLE IF EXISTS cemeteries;
