--liquibase formatted sql

--changeset cemeterymapping:239-verified-places-and-burial-death-location splitStatements:false
CREATE TABLE places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(500) NOT NULL,
  locality varchar(250),
  administrative_area varchar(250),
  country_name varchar(250) NOT NULL,
  country_code varchar(2) NOT NULL,
  geometry geometry(Point, 4326),
  authority_name varchar(250) NOT NULL,
  authority_identifier varchar(250) NOT NULL,
  authority_url text NOT NULL,
  verification_status varchar(50) NOT NULL DEFAULT 'verified',
  verified_at timestamptz,
  verified_by text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  delete_reason text,
  CONSTRAINT places_display_name_check CHECK (btrim(display_name) <> ''),
  CONSTRAINT places_country_code_check CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT places_verification_status_check CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT places_authority_unique UNIQUE (authority_name, authority_identifier)
);

CREATE INDEX places_active_name_idx
  ON places (display_name)
  WHERE deleted_at IS NULL AND is_active;

CREATE INDEX places_geometry_gix ON places USING gist (geometry);

CREATE TRIGGER touch_places_updated_at
  BEFORE UPDATE ON places
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_places_changes
  AFTER INSERT OR UPDATE OR DELETE ON places
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

ALTER TABLE burials
  ADD COLUMN death_place_uuid uuid REFERENCES places(id) ON DELETE SET NULL;

CREATE INDEX burials_death_place_idx
  ON burials (death_place_uuid)
  WHERE deleted_at IS NULL AND death_place_uuid IS NOT NULL;

CREATE TABLE burial_place_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  burial_uuid uuid NOT NULL REFERENCES burials(id) ON DELETE CASCADE,
  place_uuid uuid NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  place_role varchar(50) NOT NULL,
  north_hills_ocr_source_fact_id uuid REFERENCES north_hills_ocr_source_facts(id) ON DELETE SET NULL,
  confidence varchar(50) NOT NULL DEFAULT 'review',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by text,
  delete_reason text,
  CONSTRAINT burial_place_evidence_role_check CHECK (place_role IN ('birth', 'death', 'funeral', 'residence', 'other')),
  CONSTRAINT burial_place_evidence_confidence_check CHECK (confidence IN ('high', 'medium', 'low', 'review')),
  CONSTRAINT burial_place_evidence_unique UNIQUE (burial_uuid, place_uuid, place_role, north_hills_ocr_source_fact_id)
);

CREATE INDEX burial_place_evidence_burial_idx
  ON burial_place_evidence (burial_uuid, place_role)
  WHERE deleted_at IS NULL;

CREATE TRIGGER touch_burial_place_evidence_updated_at
  BEFORE UPDATE ON burial_place_evidence
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_burial_place_evidence_changes
  AFTER INSERT OR UPDATE OR DELETE ON burial_place_evidence
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

ALTER TABLE north_hills_ocr_source_facts
  DROP CONSTRAINT north_hills_ocr_source_facts_type_check,
  ADD CONSTRAINT north_hills_ocr_source_facts_type_check
    CHECK (fact_type IN ('death_date', 'death_place', 'middle_initial', 'age_at_death', 'note'));

WITH jonesboro AS (
  INSERT INTO places (
    display_name,
    locality,
    administrative_area,
    country_name,
    country_code,
    geometry,
    authority_name,
    authority_identifier,
    authority_url,
    verification_status,
    verified_at,
    verified_by
  )
  VALUES (
    'Jonesboro, Arkansas, United States',
    'Jonesboro',
    'Arkansas',
    'United States',
    'US',
    ST_SetSRID(ST_MakePoint(-90.6790329, 35.8197553), 4326)::geometry(Point, 4326),
    'U.S. Census Bureau TIGERweb',
    'GEOID 0535710',
    'https://tigerweb.geo.census.gov/tigerwebmain/Files/bas26/tigerweb_bas26_incplace_2025_acs25_ar.html',
    'verified',
    now(),
    'migration 239; U.S. Census Bureau incorporated-place record'
  )
  ON CONFLICT (authority_name, authority_identifier) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    locality = EXCLUDED.locality,
    administrative_area = EXCLUDED.administrative_area,
    country_name = EXCLUDED.country_name,
    country_code = EXCLUDED.country_code,
    geometry = EXCLUDED.geometry,
    authority_url = EXCLUDED.authority_url,
    verification_status = 'verified',
    verified_at = now(),
    verified_by = EXCLUDED.verified_by,
    is_active = true,
    deleted_at = NULL,
    deleted_by = NULL,
    delete_reason = NULL,
    updated_at = now()
  RETURNING id
),
william AS (
  UPDATE burials
  SET
    death_place_uuid = jonesboro.id,
    review_notes = concat_ws(
      ' ',
      NULLIF(burials.review_notes, ''),
      'Death place Jonesboro, Arkansas is supported by Church Records on NHG page 204 and normalized to verified U.S. Census place GEOID 0535710.'
    ),
    updated_at = now()
  FROM jonesboro
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'william c wiskeman'
    AND burials.gravesite_id = 'TLC-GPS-0244'
  RETURNING burials.id, burials.death_place_uuid
),
death_place_fact AS (
  INSERT INTO north_hills_ocr_source_facts (
    entry_id,
    source_code,
    source_label,
    fact_type,
    fact_value,
    raw_text,
    confidence,
    status,
    promoted_burial_uuid,
    reviewed_by_external_subject,
    reviewed_at
  )
  SELECT
    entries.id,
    'CR',
    'Church Records',
    'death_place',
    'Jonesboro, Arkansas',
    'CR: W. C. d. May 10, 1955 in Jonesboro, Ark., cremated and ashes buried June 6.',
    'high',
    'promoted',
    william.id,
    'migration 239 normalized death-place evidence',
    now()
  FROM north_hills_ocr_entries entries
  CROSS JOIN william
  WHERE entries.source_page_number = 204
    AND entries.name_text = 'WISKEMAN'
    AND entries.raw_text ILIKE '%Jonesboro, Ark.%'
  ORDER BY entries.id
  LIMIT 1
  ON CONFLICT (entry_id, source_code, fact_type, fact_value) DO UPDATE SET
    confidence = 'high',
    status = 'promoted',
    promoted_burial_uuid = EXCLUDED.promoted_burial_uuid,
    reviewed_by_external_subject = EXCLUDED.reviewed_by_external_subject,
    reviewed_at = now(),
    updated_at = now()
  RETURNING id, promoted_burial_uuid
)
INSERT INTO burial_place_evidence (
  burial_uuid,
  place_uuid,
  place_role,
  north_hills_ocr_source_fact_id,
  confidence,
  notes
)
SELECT
  william.id,
  william.death_place_uuid,
  'death',
  death_place_fact.id,
  'high',
  'NHG page 204 Church Records death-place statement linked to verified U.S. Census place GEOID 0535710.'
FROM william
JOIN death_place_fact
  ON death_place_fact.promoted_burial_uuid = william.id
ON CONFLICT (burial_uuid, place_uuid, place_role, north_hills_ocr_source_fact_id) DO UPDATE SET
  confidence = 'high',
  notes = EXCLUDED.notes,
  updated_at = now(),
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL;

--rollback DROP TABLE IF EXISTS burial_place_evidence; ALTER TABLE burials DROP COLUMN IF EXISTS death_place_uuid; DROP TABLE IF EXISTS places; ALTER TABLE north_hills_ocr_source_facts DROP CONSTRAINT north_hills_ocr_source_facts_type_check; ALTER TABLE north_hills_ocr_source_facts ADD CONSTRAINT north_hills_ocr_source_facts_type_check CHECK (fact_type IN ('death_date', 'middle_initial', 'age_at_death', 'note'));
