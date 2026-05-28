--liquibase formatted sql

--changeset cemeterymapping:024-headstone-marker-lookups splitStatements:false
CREATE TABLE marker_types (
  code varchar(50) PRIMARY KEY,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  source_notes varchar(500),
  source_url varchar(500),
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE marker_material_types (
  code varchar(50) PRIMARY KEY,
  label varchar(100) NOT NULL,
  description varchar(500) NOT NULL,
  source_notes varchar(500),
  source_url varchar(500),
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO marker_types (code, label, description, source_notes, source_url, sort_order)
VALUES
  ('upright_headstone', 'Upright headstone', 'A vertical tablet or monument standing at the head of a grave, usually set on a base.', 'Common monument-industry category; VA provides upright marble and granite headstones.', 'https://www.cem.va.gov/hmm/types.asp', 10),
  ('flat_marker', 'Flat marker', 'A marker that lies flat at or near ground level.', 'Common monument-industry category; VA provides flat granite, marble, and bronze markers.', 'https://www.cem.va.gov/hmm/types.asp', 20),
  ('flush_marker', 'Flush marker', 'A flat marker installed flush with the ground surface.', 'Common cemetery and monument-industry category, often grouped with flat or grass markers.', NULL, 30),
  ('bevel_marker', 'Bevel marker', 'A low marker with a slightly raised back or beveled face.', 'Common monument-industry category.', NULL, 40),
  ('slant_marker', 'Slant marker', 'A marker with an angled face for easier reading.', 'Common monument-industry category.', NULL, 50),
  ('pillow_marker', 'Pillow marker', 'A low raised marker with a gently sloped or pillow-like top.', 'Common monument-industry term, sometimes related to bevel or slant markers.', NULL, 60),
  ('ledger', 'Ledger', 'A flat slab that covers most or all of a grave.', 'Common cemetery and monument-industry category.', NULL, 70),
  ('monument', 'Monument', 'A larger memorial structure that may mark one or more graves.', 'Common cemetery and monument-industry category.', NULL, 80),
  ('family_monument', 'Family monument', 'A shared monument that memorializes multiple family members, often across adjacent lots or gravesites.', 'Common cemetery and monument-industry category.', NULL, 90),
  ('companion_monument', 'Companion monument', 'A monument or marker intended for two people.', 'Common monument-industry category.', NULL, 100),
  ('footstone', 'Footstone', 'A smaller marker placed at the foot of a grave.', 'Common historic cemetery survey and cemetery-preservation term.', NULL, 110),
  ('plaque', 'Plaque', 'A mounted plate or tablet, often attached to a base, wall, niche, or other memorial.', 'Common cemetery and monument-industry category.', NULL, 120),
  ('bench', 'Bench', 'A memorial marker built as or incorporated into a bench.', 'Common monument-industry category.', NULL, 130),
  ('mausoleum_marker', 'Mausoleum marker', 'A marker, plaque, or inscription associated with a mausoleum crypt.', 'Common cemetery category.', NULL, 140),
  ('niche_marker', 'Niche marker', 'A marker or plaque associated with a columbarium niche.', 'VA provides niche markers for columbaria.', 'https://www.cem.va.gov/hmm/types.asp', 150),
  ('medallion', 'Medallion', 'A medallion attached to an existing privately purchased marker.', 'VA provides bronze medallions for eligible veterans in lieu of a government headstone or marker.', 'https://www.cem.va.gov/hmm/types.asp', 160),
  ('temporary_marker', 'Temporary marker', 'A temporary marker used before a permanent marker is installed or identified.', 'Common cemetery operations category.', NULL, 170),
  ('unknown', 'Unknown', 'Marker type has not been identified yet.', 'Application default when source data does not specify marker form.', NULL, 900),
  ('other', 'Other', 'Known marker type that is not represented by the current controlled list.', 'Application extension value.', NULL, 910)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  source_notes = EXCLUDED.source_notes,
  source_url = EXCLUDED.source_url,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO marker_material_types (code, label, description, source_notes, source_url, sort_order)
VALUES
  ('granite', 'Granite', 'Granite stone marker or monument material.', 'Common monument material; VA provides granite headstones and markers.', 'https://www.cem.va.gov/hmm/types.asp', 10),
  ('marble', 'Marble', 'Marble stone marker or monument material.', 'Common monument material; VA provides marble headstones and markers.', 'https://www.cem.va.gov/hmm/types.asp', 20),
  ('bronze', 'Bronze', 'Bronze marker, plaque, medallion, or mounted plate material.', 'Common marker material; VA provides flat bronze markers and medallions.', 'https://www.cem.va.gov/hmm/types.asp', 30),
  ('limestone', 'Limestone', 'Limestone marker or monument material.', 'Common historic marker material.', NULL, 40),
  ('sandstone', 'Sandstone', 'Sandstone marker or monument material.', 'Common historic marker material.', NULL, 50),
  ('slate', 'Slate', 'Slate marker or monument material.', 'Common historic marker material.', NULL, 60),
  ('concrete', 'Concrete', 'Concrete marker, base, or memorial material.', 'Common cemetery and monument material.', NULL, 70),
  ('metal', 'Metal', 'Metal marker material other than bronze or when the specific metal is unknown.', 'Application grouping for non-bronze metal markers.', NULL, 80),
  ('wood', 'Wood', 'Wood marker material.', 'Common temporary or historic marker material.', NULL, 90),
  ('ceramic_porcelain', 'Ceramic or porcelain', 'Ceramic or porcelain plaque, photo, or marker component.', 'Common memorial component material.', NULL, 100),
  ('glass', 'Glass', 'Glass marker, plaque, or memorial component.', 'Application extension value.', NULL, 110),
  ('zinc', 'Zinc', 'Zinc marker or monument material.', 'Common historic marker material, sometimes called white bronze.', NULL, 120),
  ('unknown', 'Unknown', 'Marker material has not been identified yet.', 'Application default when source data does not specify material.', NULL, 900),
  ('other', 'Other', 'Known marker material that is not represented by the current controlled list.', 'Application extension value.', NULL, 910)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  source_notes = EXCLUDED.source_notes,
  source_url = EXCLUDED.source_url,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = now();

ALTER TABLE headstones
  ADD COLUMN marker_type_code varchar(50) REFERENCES marker_types(code),
  ADD COLUMN material_type_code varchar(50) REFERENCES marker_material_types(code);

UPDATE headstones
SET marker_type_code = CASE
    WHEN marker_type IS NULL OR btrim(marker_type) = '' THEN 'unknown'
    WHEN lower(btrim(marker_type)) IN ('upright', 'upright headstone') THEN 'upright_headstone'
    WHEN lower(btrim(marker_type)) IN ('flat', 'flat marker', 'grass marker') THEN 'flat_marker'
    WHEN lower(btrim(marker_type)) IN ('flush', 'flush marker') THEN 'flush_marker'
    WHEN lower(btrim(marker_type)) IN ('bevel', 'bevel marker', 'hickey') THEN 'bevel_marker'
    WHEN lower(btrim(marker_type)) IN ('slant', 'slant marker') THEN 'slant_marker'
    WHEN lower(btrim(marker_type)) IN ('pillow', 'pillow marker') THEN 'pillow_marker'
    WHEN lower(btrim(marker_type)) IN ('ledger', 'slab') THEN 'ledger'
    WHEN lower(btrim(marker_type)) IN ('monument') THEN 'monument'
    WHEN lower(btrim(marker_type)) IN ('family monument') THEN 'family_monument'
    WHEN lower(btrim(marker_type)) IN ('companion monument', 'double monument') THEN 'companion_monument'
    WHEN lower(btrim(marker_type)) IN ('footstone') THEN 'footstone'
    WHEN lower(btrim(marker_type)) IN ('plaque') THEN 'plaque'
    WHEN lower(btrim(marker_type)) IN ('bench') THEN 'bench'
    WHEN lower(btrim(marker_type)) IN ('mausoleum marker') THEN 'mausoleum_marker'
    WHEN lower(btrim(marker_type)) IN ('niche marker') THEN 'niche_marker'
    WHEN lower(btrim(marker_type)) IN ('medallion') THEN 'medallion'
    WHEN lower(btrim(marker_type)) IN ('temporary', 'temporary marker') THEN 'temporary_marker'
    WHEN lower(btrim(marker_type)) = 'other' THEN 'other'
    ELSE 'unknown'
  END,
  material_type_code = CASE
    WHEN material IS NULL OR btrim(material) = '' THEN 'unknown'
    WHEN lower(btrim(material)) IN ('granite') THEN 'granite'
    WHEN lower(btrim(material)) IN ('marble') THEN 'marble'
    WHEN lower(btrim(material)) IN ('bronze') THEN 'bronze'
    WHEN lower(btrim(material)) IN ('limestone') THEN 'limestone'
    WHEN lower(btrim(material)) IN ('sandstone') THEN 'sandstone'
    WHEN lower(btrim(material)) IN ('slate') THEN 'slate'
    WHEN lower(btrim(material)) IN ('concrete', 'cement') THEN 'concrete'
    WHEN lower(btrim(material)) IN ('metal') THEN 'metal'
    WHEN lower(btrim(material)) IN ('wood', 'wooden') THEN 'wood'
    WHEN lower(btrim(material)) IN ('ceramic', 'porcelain', 'ceramic/porcelain') THEN 'ceramic_porcelain'
    WHEN lower(btrim(material)) IN ('glass') THEN 'glass'
    WHEN lower(btrim(material)) IN ('zinc', 'white bronze') THEN 'zinc'
    WHEN lower(btrim(material)) = 'other' THEN 'other'
    ELSE 'unknown'
  END
WHERE marker_type_code IS NULL
  OR material_type_code IS NULL;

ALTER TABLE headstones
  ALTER COLUMN marker_type_code SET DEFAULT 'unknown',
  ALTER COLUMN material_type_code SET DEFAULT 'unknown',
  ALTER COLUMN marker_type_code SET NOT NULL,
  ALTER COLUMN material_type_code SET NOT NULL;

CREATE INDEX headstones_marker_type_code_idx ON headstones (marker_type_code);
CREATE INDEX headstones_material_type_code_idx ON headstones (material_type_code);

DROP TRIGGER IF EXISTS touch_marker_types_updated_at ON marker_types;
CREATE TRIGGER touch_marker_types_updated_at
  BEFORE UPDATE ON marker_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_marker_material_types_updated_at ON marker_material_types;
CREATE TRIGGER touch_marker_material_types_updated_at
  BEFORE UPDATE ON marker_material_types
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS audit_marker_types_changes ON marker_types;
CREATE TRIGGER audit_marker_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON marker_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('code');

DROP TRIGGER IF EXISTS audit_marker_material_types_changes ON marker_material_types;
CREATE TRIGGER audit_marker_material_types_changes
  AFTER INSERT OR UPDATE OR DELETE ON marker_material_types
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('code');

--rollback DROP TRIGGER IF EXISTS audit_marker_material_types_changes ON marker_material_types;
--rollback DROP TRIGGER IF EXISTS audit_marker_types_changes ON marker_types;
--rollback DROP TRIGGER IF EXISTS touch_marker_material_types_updated_at ON marker_material_types;
--rollback DROP TRIGGER IF EXISTS touch_marker_types_updated_at ON marker_types;
--rollback DROP INDEX IF EXISTS headstones_material_type_code_idx;
--rollback DROP INDEX IF EXISTS headstones_marker_type_code_idx;
--rollback ALTER TABLE headstones DROP COLUMN IF EXISTS material_type_code, DROP COLUMN IF EXISTS marker_type_code;
--rollback DROP TABLE IF EXISTS marker_material_types;
--rollback DROP TABLE IF EXISTS marker_types;
