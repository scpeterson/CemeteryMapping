--liquibase formatted sql

--changeset cemeterymapping:010-lot-support splitStatements:false
ALTER TABLE lots
  ADD COLUMN width_feet numeric(6, 2) NOT NULL DEFAULT 10.00,
  ADD COLUMN length_feet numeric(6, 2) NOT NULL DEFAULT 20.00,
  ADD CONSTRAINT lots_dimensions_check CHECK (width_feet > 0 AND length_feet > 0);

ALTER TABLE gravesites
  ADD COLUMN width_feet numeric(6, 2) NOT NULL DEFAULT 4.00,
  ADD COLUMN length_feet numeric(6, 2) NOT NULL DEFAULT 10.00,
  ADD CONSTRAINT gravesites_dimensions_check CHECK (width_feet > 0 AND length_feet > 0);

CREATE UNIQUE INDEX lots_section_scoped_identifier_unique
  ON lots (facility_id, section_id, lot_id)
  WHERE block_id IS NULL;

CREATE TABLE lot_owner_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(250) NOT NULL,
  contact_name varchar(250),
  full_address varchar(250),
  municipality varchar(150),
  state varchar(2),
  zip varchar(10),
  phone varchar(30),
  email varchar(150),
  notes varchar(4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(4000)
);

CREATE TABLE lot_ownership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_uuid uuid NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  effective_date date,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by varchar(150) NOT NULL DEFAULT 'Cemetery database',
  document_reference varchar(250),
  notes varchar(4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(4000),
  CONSTRAINT lot_ownership_events_type_check CHECK (
    event_type IN ('deed', 'sale', 'gift', 'church_council_action', 'correction', 'release')
  )
);

CREATE TABLE lot_ownership_event_parties (
  lot_ownership_event_uuid uuid NOT NULL REFERENCES lot_ownership_events(id) ON DELETE CASCADE,
  lot_owner_party_uuid uuid NOT NULL REFERENCES lot_owner_parties(id) ON DELETE RESTRICT,
  ownership_role varchar(50) NOT NULL DEFAULT 'owner',
  share_numerator integer,
  share_denominator integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lot_ownership_event_uuid, lot_owner_party_uuid),
  CONSTRAINT lot_ownership_event_parties_share_check CHECK (
    (share_numerator IS NULL AND share_denominator IS NULL)
    OR (share_numerator > 0 AND share_denominator > 0 AND share_numerator <= share_denominator)
  )
);

CREATE INDEX lot_owner_parties_display_name_trgm_idx
  ON lot_owner_parties USING gin (lower(display_name) gin_trgm_ops);

CREATE INDEX lot_ownership_events_lot_effective_idx
  ON lot_ownership_events (lot_uuid, effective_date DESC NULLS LAST, recorded_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX lot_ownership_event_parties_party_idx
  ON lot_ownership_event_parties (lot_owner_party_uuid);

CREATE VIEW current_lot_ownership_events AS
SELECT DISTINCT ON (lot_uuid)
  id,
  lot_uuid,
  event_type,
  effective_date,
  recorded_at,
  recorded_by,
  document_reference,
  notes
FROM lot_ownership_events
WHERE deleted_at IS NULL
ORDER BY lot_uuid, effective_date DESC NULLS LAST, recorded_at DESC, id DESC;

CREATE VIEW current_lot_owners AS
SELECT
  current_lot_ownership_events.lot_uuid,
  current_lot_ownership_events.id AS lot_ownership_event_uuid,
  current_lot_ownership_events.event_type,
  current_lot_ownership_events.effective_date,
  lot_owner_parties.id AS lot_owner_party_uuid,
  lot_owner_parties.display_name,
  lot_ownership_event_parties.ownership_role,
  lot_ownership_event_parties.share_numerator,
  lot_ownership_event_parties.share_denominator
FROM current_lot_ownership_events
JOIN lot_ownership_event_parties
  ON lot_ownership_event_parties.lot_ownership_event_uuid = current_lot_ownership_events.id
JOIN lot_owner_parties
  ON lot_owner_parties.id = lot_ownership_event_parties.lot_owner_party_uuid
WHERE current_lot_ownership_events.event_type <> 'release'
  AND lot_owner_parties.deleted_at IS NULL;

CREATE OR REPLACE FUNCTION enforce_lot_gravesite_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lot_uuid IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF (
    SELECT count(*)
    FROM gravesites existing
    WHERE existing.lot_uuid = NEW.lot_uuid
      AND existing.deleted_at IS NULL
      AND existing.id IS DISTINCT FROM NEW.id
  ) >= 5 THEN
    RAISE EXCEPTION 'Lot % cannot contain more than five active gravesites.', NEW.lot_uuid
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER gravesites_lot_capacity_check
  BEFORE INSERT OR UPDATE OF lot_uuid, deleted_at ON gravesites
  FOR EACH ROW
  EXECUTE FUNCTION enforce_lot_gravesite_limit();

WITH grouped_gravesites AS (
  SELECT
    grave.cemetery_id,
    grave.section_uuid,
    grave.facility_id,
    grave.section_id,
    grave.lot_id,
    ST_Centroid(ST_Collect(grave.geometry)) AS center_point
  FROM gravesites grave
  WHERE grave.lot_id IS NOT NULL
    AND grave.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM lots lot
      WHERE lot.cemetery_id = grave.cemetery_id
        AND lot.section_id IS NOT DISTINCT FROM grave.section_id
        AND lot.lot_id = grave.lot_id
        AND lot.block_id IS NULL
        AND lot.deleted_at IS NULL
    )
  GROUP BY
    grave.cemetery_id,
    grave.section_uuid,
    grave.facility_id,
    grave.section_id,
    grave.lot_id
),
lot_dimensions AS (
  SELECT
    cemetery_id,
    section_uuid,
    facility_id,
    section_id,
    lot_id,
    ST_X(center_point) AS longitude,
    ST_Y(center_point) AS latitude,
    (20 * 0.3048) / 2 / (111320 * cos(radians(ST_Y(center_point)))) AS half_width_degrees,
    (10 * 0.3048) / 2 / 111320 AS half_height_degrees
  FROM grouped_gravesites
)
INSERT INTO lots (
  cemetery_id,
  section_uuid,
  name,
  facility_id,
  section_id,
  block_id,
  lot_id,
  width_feet,
  length_feet,
  geometry,
  updated_at
)
SELECT
  cemetery_id,
  section_uuid,
  concat('Lot ', lot_id),
  facility_id,
  section_id,
  NULL,
  lot_id,
  10.00,
  20.00,
  ST_Multi(
    ST_MakeEnvelope(
      longitude - half_width_degrees,
      latitude - half_height_degrees,
      longitude + half_width_degrees,
      latitude + half_height_degrees,
      4326
    )
  )::geometry(MultiPolygon, 4326),
  now()
FROM lot_dimensions
ON CONFLICT (facility_id, section_id, lot_id) WHERE block_id IS NULL DO NOTHING;

UPDATE gravesites grave
SET lot_uuid = lot.id,
    updated_at = now()
FROM lots lot
WHERE grave.lot_uuid IS NULL
  AND grave.cemetery_id = lot.cemetery_id
  AND grave.section_id IS NOT DISTINCT FROM lot.section_id
  AND grave.lot_id = lot.lot_id
  AND lot.block_id IS NULL
  AND lot.deleted_at IS NULL;

INSERT INTO lot_owner_parties (
  display_name,
  contact_name,
  full_address,
  municipality,
  state,
  zip,
  phone,
  email,
  notes
)
SELECT DISTINCT ON (normalized.display_name)
  normalized.display_name,
  normalized.contact_name,
  normalized.full_address,
  normalized.municipality,
  normalized.state,
  normalized.zip,
  normalized.phone,
  normalized.email,
  normalized.notes
FROM (
  SELECT
    COALESCE(NULLIF(trim(owner.owner), ''), NULLIF(trim(owner.co_owner), ''), 'Unknown owner') AS display_name,
    NULLIF(trim(concat_ws(' and ', owner.owner, owner.co_owner)), '') AS contact_name,
    owner.full_address,
    owner.municipality,
    owner.state,
    owner.zip,
    owner.phone,
    owner.email,
    owner.notes
  FROM owners owner
  JOIN gravesites grave
    ON grave.id = owner.gravesite_uuid
  WHERE grave.lot_uuid IS NOT NULL
    AND owner.deleted_at IS NULL
) normalized
ORDER BY normalized.display_name, normalized.contact_name NULLS LAST;

WITH owner_lots AS (
  SELECT DISTINCT ON (grave.lot_uuid, party.id)
    grave.lot_uuid,
    party.id AS party_id,
    owner.sale_date,
    owner.notes
  FROM owners owner
  JOIN gravesites grave
    ON grave.id = owner.gravesite_uuid
  JOIN lot_owner_parties party
    ON party.display_name = COALESCE(NULLIF(trim(owner.owner), ''), NULLIF(trim(owner.co_owner), ''), 'Unknown owner')
  WHERE grave.lot_uuid IS NOT NULL
    AND owner.deleted_at IS NULL
  ORDER BY grave.lot_uuid, party.id, owner.sale_date DESC NULLS LAST, owner.created_at DESC
),
owner_events AS (
  SELECT
    gen_random_uuid() AS event_id,
    distinct_events.lot_uuid,
    distinct_events.sale_date,
    distinct_events.notes
  FROM (
    SELECT DISTINCT lot_uuid, sale_date, notes
    FROM owner_lots
  ) distinct_events
),
created_events AS (
  INSERT INTO lot_ownership_events (
    id,
    lot_uuid,
    event_type,
    effective_date,
    recorded_by,
    notes
  )
  SELECT
    event_id,
    lot_uuid,
    'deed',
    sale_date,
    'Migrated from gravesite owner records',
    notes
  FROM owner_events
  RETURNING id
)
INSERT INTO lot_ownership_event_parties (
  lot_ownership_event_uuid,
  lot_owner_party_uuid
)
SELECT
  owner_events.event_id,
  owner_lots.party_id
FROM owner_lots
JOIN owner_events
  ON owner_events.lot_uuid = owner_lots.lot_uuid
 AND owner_events.sale_date IS NOT DISTINCT FROM owner_lots.sale_date
 AND owner_events.notes IS NOT DISTINCT FROM owner_lots.notes
JOIN created_events
  ON created_events.id = owner_events.event_id;

--rollback DROP TRIGGER IF EXISTS gravesites_lot_capacity_check ON gravesites;
--rollback DROP FUNCTION IF EXISTS enforce_lot_gravesite_limit();
--rollback DROP VIEW IF EXISTS current_lot_owners;
--rollback DROP VIEW IF EXISTS current_lot_ownership_events;
--rollback DROP INDEX IF EXISTS lot_ownership_event_parties_party_idx;
--rollback DROP INDEX IF EXISTS lot_ownership_events_lot_effective_idx;
--rollback DROP INDEX IF EXISTS lot_owner_parties_display_name_trgm_idx;
--rollback DROP TABLE IF EXISTS lot_ownership_event_parties;
--rollback DROP TABLE IF EXISTS lot_ownership_events;
--rollback DROP TABLE IF EXISTS lot_owner_parties;
--rollback DROP INDEX IF EXISTS lots_section_scoped_identifier_unique;
--rollback ALTER TABLE gravesites DROP CONSTRAINT IF EXISTS gravesites_dimensions_check;
--rollback ALTER TABLE gravesites DROP COLUMN IF EXISTS length_feet, DROP COLUMN IF EXISTS width_feet;
--rollback ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_dimensions_check;
--rollback ALTER TABLE lots DROP COLUMN IF EXISTS length_feet, DROP COLUMN IF EXISTS width_feet;
