--liquibase formatted sql

--changeset scpeterson:002-esri-cemetery-template-schema splitStatements:false
DROP VIEW IF EXISTS current_grave_owners;
DROP VIEW IF EXISTS current_ownership_events;
DROP TABLE IF EXISTS grave_space_documents;
DROP TABLE IF EXISTS ownership_event_owners;
DROP TABLE IF EXISTS ownership_events;
DROP TABLE IF EXISTS source_documents;
DROP TABLE IF EXISTS burials;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS owners;
DROP TABLE IF EXISTS grave_spaces;
DROP TABLE IF EXISTS cemetery_sections;
DROP TABLE IF EXISTS cemeteries;

CREATE TABLE cemeteries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id varchar(50),
  name varchar(255) NOT NULL,
  full_address varchar(250),
  municipality varchar(150),
  agency varchar(50),
  agency_url varchar(300),
  owned_by smallint,
  maintained_by smallint,
  operational_hours varchar(150),
  contact_name varchar(150),
  contact_phone varchar(15),
  contact_email varchar(100),
  earliest_burial_year smallint,
  image_url varchar(300),
  notes varchar(4000),
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cemeteries_facility_id_unique UNIQUE (facility_id),
  CONSTRAINT cemeteries_owned_by_check CHECK (owned_by IS NULL OR owned_by IN (0, 1, 2)),
  CONSTRAINT cemeteries_maintained_by_check CHECK (maintained_by IS NULL OR maintained_by IN (0, 1, 2))
);

CREATE TABLE sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE CASCADE,
  name varchar(255),
  facility_id varchar(50),
  section_id varchar(5) NOT NULL,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sections_identifier_unique UNIQUE (facility_id, section_id)
);

CREATE TABLE blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE CASCADE,
  section_uuid uuid REFERENCES sections(id) ON DELETE SET NULL,
  name varchar(255),
  facility_id varchar(50),
  section_id varchar(5),
  block_id varchar(5) NOT NULL,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_identifier_unique UNIQUE (facility_id, section_id, block_id)
);

CREATE TABLE lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE CASCADE,
  section_uuid uuid REFERENCES sections(id) ON DELETE SET NULL,
  block_uuid uuid REFERENCES blocks(id) ON DELETE SET NULL,
  name varchar(255),
  facility_id varchar(50),
  section_id varchar(5),
  block_id varchar(5),
  lot_id varchar(5) NOT NULL,
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lots_identifier_unique UNIQUE (facility_id, section_id, block_id, lot_id)
);

CREATE TABLE gravesites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid REFERENCES cemeteries(id) ON DELETE CASCADE,
  section_uuid uuid REFERENCES sections(id) ON DELETE SET NULL,
  block_uuid uuid REFERENCES blocks(id) ON DELETE SET NULL,
  lot_uuid uuid REFERENCES lots(id) ON DELETE SET NULL,
  name varchar(255),
  facility_id varchar(50),
  section_id varchar(5),
  block_id varchar(5),
  lot_id varchar(5),
  grave_id varchar(5) NOT NULL,
  gravesite_id varchar(30) NOT NULL,
  status varchar(30),
  cost numeric(12, 2),
  geometry geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gravesites_identifier_unique UNIQUE (gravesite_id),
  CONSTRAINT gravesites_hierarchy_unique UNIQUE (facility_id, section_id, block_id, lot_id, grave_id)
);

CREATE TABLE burials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gravesite_uuid uuid REFERENCES gravesites(id) ON DELETE CASCADE,
  first_name varchar(100),
  last_name varchar(150),
  full_name varchar(250),
  sex varchar(10),
  birth_date date,
  death_date date,
  age smallint,
  burial_date date,
  funeral_home varchar(250),
  monument_type varchar(50),
  veteran varchar(5),
  notes varchar(4000),
  gravesite_id varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gravesite_uuid uuid REFERENCES gravesites(id) ON DELETE CASCADE,
  owner varchar(250),
  co_owner varchar(250),
  full_address varchar(250),
  municipality varchar(150),
  state varchar(2),
  zip varchar(5),
  phone varchar(15),
  email varchar(100),
  sale_date date,
  notes varchar(4000),
  gravesite_id varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  burial_uuid uuid REFERENCES burials(id) ON DELETE CASCADE,
  burial_name varchar(255),
  submitted_at timestamptz,
  relationship varchar(50),
  memory_text varchar(4000),
  contact_first_name varchar(150),
  contact_last_name varchar(150),
  contact_phone varchar(15),
  contact_email varchar(150),
  status varchar(150),
  geometry geometry(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cemeteries_geometry_gix ON cemeteries USING gist (geometry);
CREATE INDEX sections_geometry_gix ON sections USING gist (geometry);
CREATE INDEX blocks_geometry_gix ON blocks USING gist (geometry);
CREATE INDEX lots_geometry_gix ON lots USING gist (geometry);
CREATE INDEX gravesites_geometry_gix ON gravesites USING gist (geometry);
CREATE INDEX memorials_geometry_gix ON memorials USING gist (geometry);

CREATE INDEX sections_facility_idx ON sections (facility_id, section_id);
CREATE INDEX blocks_facility_idx ON blocks (facility_id, section_id, block_id);
CREATE INDEX lots_facility_idx ON lots (facility_id, section_id, block_id, lot_id);
CREATE INDEX gravesites_facility_idx ON gravesites (facility_id, section_id, block_id, lot_id, grave_id);
CREATE INDEX gravesites_status_idx ON gravesites (status);
CREATE INDEX burials_gravesite_id_idx ON burials (gravesite_id);
CREATE INDEX burials_name_idx ON burials (lower(last_name), lower(first_name));
CREATE INDEX burials_full_name_trgm_idx ON burials USING gin (lower(full_name) gin_trgm_ops);
CREATE INDEX burials_birth_date_idx ON burials (birth_date);
CREATE INDEX burials_death_date_idx ON burials (death_date);
CREATE INDEX burials_burial_date_idx ON burials (burial_date);
CREATE INDEX owners_gravesite_id_idx ON owners (gravesite_id);
CREATE INDEX owners_owner_trgm_idx ON owners USING gin (lower(owner) gin_trgm_ops);
CREATE INDEX owners_co_owner_trgm_idx ON owners USING gin (lower(co_owner) gin_trgm_ops);

--rollback DROP TABLE IF EXISTS memorials;
--rollback DROP TABLE IF EXISTS owners;
--rollback DROP TABLE IF EXISTS burials;
--rollback DROP TABLE IF EXISTS gravesites;
--rollback DROP TABLE IF EXISTS lots;
--rollback DROP TABLE IF EXISTS blocks;
--rollback DROP TABLE IF EXISTS sections;
--rollback DROP TABLE IF EXISTS cemeteries;
--rollback CREATE TABLE cemeteries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, boundary geometry(Polygon, 4326) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--rollback CREATE TABLE cemetery_sections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cemetery_id uuid NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE, code text NOT NULL, name text NOT NULL, geometry geometry(Polygon, 4326) NOT NULL, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT cemetery_sections_code_unique UNIQUE (cemetery_id, code));
--rollback CREATE TABLE grave_spaces (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cemetery_id uuid NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE, section_id uuid REFERENCES cemetery_sections(id) ON DELETE SET NULL, grave_code text NOT NULL, lot_code text NOT NULL, space_code text NOT NULL, status text NOT NULL DEFAULT 'unknown', geometry geometry(Polygon, 4326) NOT NULL, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT grave_spaces_status_check CHECK (status IN ('available', 'reserved', 'occupied', 'sold', 'unknown')), CONSTRAINT grave_spaces_code_unique UNIQUE (cemetery_id, grave_code), CONSTRAINT grave_spaces_lot_space_unique UNIQUE (cemetery_id, section_id, lot_code, space_code));
--rollback CREATE TABLE owners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL, contact_note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--rollback CREATE TABLE people (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), first_name text NOT NULL, middle_name text, last_name text NOT NULL, birth_date date, death_date date, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--rollback CREATE TABLE burials (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grave_space_id uuid NOT NULL REFERENCES grave_spaces(id) ON DELETE RESTRICT, person_id uuid NOT NULL REFERENCES people(id) ON DELETE RESTRICT, burial_date date, interment_type text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT burials_person_unique UNIQUE (person_id));
--rollback CREATE TABLE source_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, document_type text NOT NULL, reference_code text, storage_uri text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
--rollback CREATE TABLE ownership_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grave_space_id uuid NOT NULL REFERENCES grave_spaces(id) ON DELETE CASCADE, event_type text NOT NULL, effective_date date NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), recorded_by text NOT NULL, source_document_id uuid REFERENCES source_documents(id) ON DELETE SET NULL, document_reference text, notes text, CONSTRAINT ownership_events_type_check CHECK (event_type IN ('purchase', 'transfer', 'inheritance', 'correction', 'release')));
--rollback CREATE TABLE ownership_event_owners (ownership_event_id uuid NOT NULL REFERENCES ownership_events(id) ON DELETE CASCADE, owner_id uuid NOT NULL REFERENCES owners(id) ON DELETE RESTRICT, ownership_role text NOT NULL DEFAULT 'owner', share_numerator integer, share_denominator integer, PRIMARY KEY (ownership_event_id, owner_id), CONSTRAINT ownership_event_owners_share_check CHECK ((share_numerator IS NULL AND share_denominator IS NULL) OR (share_numerator > 0 AND share_denominator > 0 AND share_numerator <= share_denominator)));
--rollback CREATE TABLE grave_space_documents (grave_space_id uuid NOT NULL REFERENCES grave_spaces(id) ON DELETE CASCADE, source_document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE, relationship_type text NOT NULL, notes text, PRIMARY KEY (grave_space_id, source_document_id, relationship_type));
--rollback CREATE INDEX cemeteries_boundary_gix ON cemeteries USING gist (boundary);
--rollback CREATE INDEX cemetery_sections_geometry_gix ON cemetery_sections USING gist (geometry);
--rollback CREATE INDEX grave_spaces_geometry_gix ON grave_spaces USING gist (geometry);
--rollback CREATE INDEX grave_spaces_status_idx ON grave_spaces (status);
--rollback CREATE INDEX grave_spaces_lookup_idx ON grave_spaces (cemetery_id, section_id, lot_code, space_code);
--rollback CREATE INDEX owners_display_name_trgm_idx ON owners USING gin (lower(display_name) gin_trgm_ops);
--rollback CREATE INDEX people_last_first_name_idx ON people (lower(last_name), lower(first_name));
--rollback CREATE INDEX people_last_name_trgm_idx ON people USING gin (lower(last_name) gin_trgm_ops);
--rollback CREATE INDEX people_birth_date_idx ON people (birth_date);
--rollback CREATE INDEX people_death_date_idx ON people (death_date);
--rollback CREATE INDEX burials_burial_date_idx ON burials (burial_date);
--rollback CREATE INDEX ownership_events_grave_effective_idx ON ownership_events (grave_space_id, effective_date DESC, recorded_at DESC, id DESC);
--rollback CREATE INDEX ownership_event_owners_owner_idx ON ownership_event_owners (owner_id);
--rollback CREATE VIEW current_ownership_events AS SELECT DISTINCT ON (grave_space_id) id, grave_space_id, event_type, effective_date, recorded_at, recorded_by, source_document_id, document_reference, notes FROM ownership_events ORDER BY grave_space_id, effective_date DESC, recorded_at DESC, id DESC;
--rollback CREATE VIEW current_grave_owners AS SELECT current_ownership_events.grave_space_id, current_ownership_events.id AS ownership_event_id, current_ownership_events.event_type, current_ownership_events.effective_date, owners.id AS owner_id, owners.display_name, ownership_event_owners.ownership_role, ownership_event_owners.share_numerator, ownership_event_owners.share_denominator FROM current_ownership_events JOIN ownership_event_owners ON ownership_event_owners.ownership_event_id = current_ownership_events.id JOIN owners ON owners.id = ownership_event_owners.owner_id WHERE current_ownership_events.event_type <> 'release';
