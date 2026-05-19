--liquibase formatted sql

--changeset scpeterson:005-headstones splitStatements:false
CREATE TABLE headstones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gravesite_uuid uuid REFERENCES gravesites(id) ON DELETE SET NULL,
  headstone_id varchar(50) NOT NULL,
  marker_type varchar(50),
  condition varchar(50),
  condition_notes varchar(4000),
  inscription text,
  material varchar(100),
  photo_url varchar(300),
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  geometry geometry(Point, 4326),
  source_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_inspected_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT headstones_identifier_unique UNIQUE (headstone_id),
  CONSTRAINT headstones_condition_check CHECK (
    condition IS NULL OR condition IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'unknown')
  )
);

CREATE TABLE headstone_burials (
  headstone_uuid uuid NOT NULL REFERENCES headstones(id) ON DELETE CASCADE,
  burial_uuid uuid NOT NULL REFERENCES burials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (headstone_uuid, burial_uuid)
);

CREATE INDEX headstones_gravesite_uuid_idx ON headstones (gravesite_uuid);
CREATE INDEX headstones_geometry_gix ON headstones USING gist (geometry);
CREATE INDEX headstone_burials_burial_uuid_idx ON headstone_burials (burial_uuid);

--rollback DROP TABLE IF EXISTS headstone_burials;
--rollback DROP TABLE IF EXISTS headstones;
