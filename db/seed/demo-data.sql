BEGIN;

DELETE FROM headstones
WHERE headstone_id IN ('DEMO-HS-HARRIS', 'DEMO-HS-MILLER');

DELETE FROM cemeteries
WHERE facility_id IN ('DEMO-ST-MARK', 'DEMO-MEMORIAL');

INSERT INTO cemeteries (
  facility_id,
  name,
  full_address,
  municipality,
  agency,
  owned_by,
  maintained_by,
  contact_name,
  contact_phone,
  contact_email,
  earliest_burial_year,
  notes,
  geometry
)
VALUES (
  'DEMO-ST-MARK',
  'St. Mark Church Cemetery',
  '100 Church Lane',
  'Demo Township',
  'St. Mark Church',
  0,
  0,
  'Church Clerk',
  '555-0100',
  'records@example.test',
  1965,
  'Demo cemetery data for DEV/TEST/STAGE only.',
  ST_Multi(ST_MakeEnvelope(-76.70475, 39.19584, -76.70383, 39.19625, 4326))::geometry(MultiPolygon, 4326)
);

INSERT INTO cemeteries (
  facility_id,
  name,
  full_address,
  municipality,
  agency,
  owned_by,
  maintained_by,
  contact_name,
  contact_phone,
  contact_email,
  earliest_burial_year,
  notes,
  geometry
)
VALUES (
  'DEMO-MEMORIAL',
  'Memorial Grove Cemetery',
  '200 Grove Road',
  'Demo Township',
  'Demo Township',
  1,
  1,
  'Town Clerk',
  '555-0200',
  'memorial@example.test',
  1980,
  'Second demo cemetery with overlapping grave identifiers.',
  ST_Multi(ST_MakeEnvelope(-76.70350, 39.19584, -76.70292, 39.19618, 4326))::geometry(MultiPolygon, 4326)
);

INSERT INTO sections (cemetery_id, name, facility_id, geometry)
SELECT id, 'A', facility_id,
  ST_Multi(ST_MakeEnvelope(-76.70470, 39.19588, -76.70425, 39.19621, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries
WHERE facility_id = 'DEMO-ST-MARK';

UPDATE sections
SET alternate_names = ARRAY['NA', 'New Annex']::text[]
WHERE facility_id = 'DEMO-ST-MARK'
  AND name = 'A';

INSERT INTO sections (cemetery_id, name, facility_id, geometry)
SELECT id, 'A', facility_id,
  ST_Multi(ST_MakeEnvelope(-76.70346, 39.19589, -76.70298, 39.19613, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries
WHERE facility_id = 'DEMO-MEMORIAL';

UPDATE sections
SET alternate_names = ARRAY['NA', 'New Annex']::text[]
WHERE facility_id = 'DEMO-MEMORIAL'
  AND name = 'A';

INSERT INTO sections (cemetery_id, name, facility_id, geometry)
SELECT id, 'B', facility_id,
  ST_Multi(ST_MakeEnvelope(-76.70423, 39.19588, -76.70388, 39.19621, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries
WHERE facility_id = 'DEMO-ST-MARK';

UPDATE sections
SET alternate_names = ARRAY['OC', 'Original Cemetery']::text[]
WHERE facility_id = 'DEMO-ST-MARK'
  AND name = 'B';

-- Memorial Grove intentionally uses a block so the demo covers both supported
-- hierarchies: Trinity-like section-scoped lots and block-scoped lots.
INSERT INTO blocks (cemetery_id, section_uuid, name, facility_id, section_id, block_id, geometry)
SELECT c.id, s.section_id, 'North Block', c.facility_id, s.name, 'N1',
  ST_Multi(ST_MakeEnvelope(-76.70345, 39.19590, -76.70300, 39.19612, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN sections s ON s.cemetery_id = c.id AND s.name = 'A'
WHERE c.facility_id = 'DEMO-MEMORIAL';

INSERT INTO lots (
  cemetery_id,
  section_uuid,
  name,
  facility_id,
  section_id,
  lot_id,
  width_feet,
  length_feet,
  burial_use_status,
  burial_use_notes,
  geometry_type,
  geometry_source,
  geometry_confidence,
  geometry_notes,
  geometry
)
SELECT c.id, s.section_id, concat('Lot ', seed.lot_id), c.facility_id, seed.section_id, seed.lot_id,
  seed.width_feet, seed.length_feet, seed.burial_use_status, seed.burial_use_notes,
  'schematic', 'Synthetic demo fixture', 'reviewed', seed.geometry_notes,
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', 10.00, 20.00, 'standard', NULL, 'Common five-gravesite lot footprint.', -76.70468, 39.19605, -76.70429, 39.19619),
    ('A', '02', 10.00, 12.00, 'standard', NULL, 'Smaller three-gravesite lot footprint.', -76.70468, 39.19591, -76.70441, 39.19605),
    ('A', '02A', 16.36, 16.00, 'standard', NULL, 'Letter suffix demonstrates a repeated historic lot number within one section.', -76.70440, 39.19591, -76.70429, 39.19605),
    ('B', '01', 16.36, 16.00, 'standard', NULL, 'Non-standard historic-map-style lot footprint.', -76.70420, 39.19605, -76.70393, 39.19619),
    ('B', '02', 10.00, 20.00, 'standard', NULL, 'Common lot footprint with mixed review statuses.', -76.70420, 39.19591, -76.70393, 39.19605),
    ('B', '03', 10.00, 20.00, 'non_burial', 'Grid area cannot contain gravesites or markers.', 'Restricted grid lot exercises lot burial-use rules.', -76.70420, 39.19589, -76.70393, 39.19591)
) AS seed(section_id, lot_id, width_feet, length_feet, burial_use_status, burial_use_notes, geometry_notes, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
WHERE c.facility_id = 'DEMO-ST-MARK';

INSERT INTO lots (
  cemetery_id,
  section_uuid,
  block_uuid,
  name,
  facility_id,
  section_id,
  block_id,
  lot_id,
  width_feet,
  length_feet,
  geometry_type,
  geometry_source,
  geometry_confidence,
  geometry_notes,
  geometry
)
SELECT c.id, s.section_id, b.id, concat('Lot ', seed.lot_id), c.facility_id, seed.section_id, b.block_id, seed.lot_id,
  10.00, 20.00, 'schematic', 'Synthetic demo fixture', 'reviewed',
  'Block-scoped lot contrasts with Trinity-style section-scoped lots.',
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', -76.70344, 39.19598, -76.70314, 39.19612)
) AS seed(section_id, lot_id, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
JOIN blocks b ON b.cemetery_id = c.id AND b.section_id = seed.section_id AND b.block_id = 'N1'
WHERE c.facility_id = 'DEMO-MEMORIAL';

INSERT INTO gravesites (
  cemetery_id,
  section_uuid,
  lot_uuid,
  name,
  facility_id,
  section_id,
  lot_id,
  grave_id,
  gravesite_id,
  status_type_id,
  cost,
  geometry
)
SELECT c.id, s.section_id, l.id, s.name, c.facility_id, seed.section_id, seed.lot_id, seed.grave_id,
  concat(seed.section_id, '-', seed.lot_id, '-', seed.grave_id),
  status_type.id,
  seed.cost,
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', '01', 'occupied', 1200.00, -76.70466, 39.19607, -76.70455, 39.19617),
    ('A', '01', '02', 'reserved', 1200.00, -76.70454, 39.19607, -76.70443, 39.19617),
    ('A', '01', '03', 'available', 1200.00, -76.70442, 39.19607, -76.70431, 39.19617),
    ('A', '02', '01', 'occupied', 1200.00, -76.70466, 39.19593, -76.70455, 39.19603),
    ('A', '02', '02', 'occupied', 1200.00, -76.70454, 39.19593, -76.70443, 39.19603),
    ('B', '01', '01', 'occupied', 1200.00, -76.70418, 39.19607, -76.70407, 39.19617),
    ('B', '01', '02', 'reserved', 1200.00, -76.70406, 39.19607, -76.70395, 39.19617),
    ('B', '02', '01', 'needs_review', 1200.00, -76.70418, 39.19593, -76.70407, 39.19603),
    ('B', '02', '02', 'available', 1200.00, -76.70406, 39.19593, -76.70395, 39.19603)
) AS seed(section_id, lot_id, grave_id, status, cost, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
JOIN lots l ON l.cemetery_id = c.id AND l.section_id = seed.section_id AND l.lot_id = seed.lot_id
JOIN gravesite_status_types status_type ON status_type.code = seed.status
WHERE c.facility_id = 'DEMO-ST-MARK';

INSERT INTO gravesites (
  cemetery_id,
  section_uuid,
  block_uuid,
  lot_uuid,
  name,
  facility_id,
  section_id,
  block_id,
  lot_id,
  grave_id,
  gravesite_id,
  status_type_id,
  cost,
  geometry
)
SELECT c.id, s.section_id, b.id, l.id, s.name, c.facility_id, seed.section_id, b.block_id, seed.lot_id, seed.grave_id,
  concat(seed.section_id, '-', seed.lot_id, '-', seed.grave_id),
  status_type.id,
  seed.cost,
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', '01', 'reserved', 950.00, -76.70342, 39.19600, -76.70330, 39.19610),
    ('A', '01', '02', 'available', 950.00, -76.70328, 39.19600, -76.70316, 39.19610)
) AS seed(section_id, lot_id, grave_id, status, cost, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
JOIN blocks b ON b.cemetery_id = c.id AND b.section_id = seed.section_id AND b.block_id = 'N1'
JOIN lots l ON l.cemetery_id = c.id AND l.block_uuid = b.id AND l.lot_id = seed.lot_id
JOIN gravesite_status_types status_type ON status_type.code = seed.status
WHERE c.facility_id = 'DEMO-MEMORIAL';

-- A passageway gravesite exercises valid section-only placement without a lot.
INSERT INTO gravesites (
  cemetery_id, section_uuid, name, facility_id, section_id, lot_uuid, lot_id,
  grave_id, gravesite_id, status_type_id, cost, geometry_type, geometry_source,
  geometry_confidence, geometry_notes, geometry
)
SELECT c.id, s.section_id, 'Passageway gravesite', c.facility_id, s.name, NULL, NULL,
  'P01', 'B-PASS-01', status_type.id, NULL, 'schematic', 'Synthetic demo fixture',
  'reviewed', 'Intentionally outside any lot to represent a reviewed passageway burial.',
  ST_Multi(ST_MakeEnvelope(-76.704225, 39.196075, -76.704205, 39.196145, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN sections s ON s.cemetery_id = c.id AND s.name = 'B'
JOIN gravesite_status_types status_type ON status_type.code = 'occupied'
WHERE c.facility_id = 'DEMO-ST-MARK';

INSERT INTO owners (gravesite_uuid, owner, co_owner, full_address, municipality, state, zip, phone, email, sale_date, notes, gravesite_id)
SELECT g.id, seed.owner, seed.co_owner, seed.full_address, seed.municipality, seed.state, seed.zip, seed.phone, seed.email, seed.sale_date::date, seed.notes, seed.gravesite_id
FROM gravesites g
JOIN (
  VALUES
    ('A-01-01', 'Harris Family Trust', NULL, '10 Oak Road', 'Demo Township', 'MD', '21000', '555-0101', 'harris@example.test', '1972-05-18', 'Primary contact: Elaine Harris'),
    ('A-01-02', 'Harris Family Trust', NULL, '10 Oak Road', 'Demo Township', 'MD', '21000', '555-0101', 'harris@example.test', '1972-05-18', 'Reserved for family use'),
    ('A-01-03', 'St. Mark Church Cemetery Association', NULL, '100 Church Lane', 'Demo Township', 'MD', '21000', '555-0100', 'records@example.test', '2023-08-10', 'Confirmed unsold during deed reconciliation'),
    ('A-02-01', 'Samuel Miller', 'Ruth Miller', '22 Maple Street', 'Demo Township', 'MD', '21000', '555-0102', 'miller@example.test', '1965-03-04', 'Receipt 1022'),
    ('A-02-02', 'Samuel Miller', 'Ruth Miller', '22 Maple Street', 'Demo Township', 'MD', '21000', '555-0102', 'miller@example.test', '1965-03-04', 'Separate gravesite under the shared Miller family deed.'),
    ('B-01-01', 'Garcia Family', NULL, '55 Cedar Court', 'Demo Township', 'MD', '21000', '555-0104', 'garcia@example.test', '2004-11-20', NULL),
    ('B-01-02', 'Garcia Family', NULL, '55 Cedar Court', 'Demo Township', 'MD', '21000', '555-0104', 'garcia@example.test', '2004-11-20', NULL),
    ('B-02-01', 'Margaret Green Estate', NULL, '77 Elm Drive', 'Demo Township', 'MD', '21000', '555-0105', 'green@example.test', '1989-09-16', 'Estate paperwork incomplete; verify current representative'),
    ('B-02-02', 'St. Mark Church Cemetery Association', NULL, '100 Church Lane', 'Demo Township', 'MD', '21000', '555-0100', 'records@example.test', '2024-04-09', NULL)
) AS seed(gravesite_id, owner, co_owner, full_address, municipality, state, zip, phone, email, sale_date, notes)
  ON seed.gravesite_id = g.gravesite_id
WHERE g.facility_id = 'DEMO-ST-MARK';

INSERT INTO owners (gravesite_uuid, owner, co_owner, full_address, municipality, state, zip, phone, email, sale_date, notes, gravesite_id)
SELECT g.id, seed.owner, seed.co_owner, seed.full_address, seed.municipality, seed.state, seed.zip, seed.phone, seed.email, seed.sale_date::date, seed.notes, seed.gravesite_id
FROM gravesites g
JOIN (
  VALUES
    ('A-01-01', 'Memorial Grove Association', NULL, '200 Grove Road', 'Demo Township', 'MD', '21000', '555-0200', 'memorial@example.test', '2020-02-14', 'Same grave identifier as St. Mark A-01-01, scoped to Memorial Grove.'),
    ('A-01-02', 'Memorial Grove Association', NULL, '200 Grove Road', 'Demo Township', 'MD', '21000', '555-0200', 'memorial@example.test', '2024-01-12', NULL)
) AS seed(gravesite_id, owner, co_owner, full_address, municipality, state, zip, phone, email, sale_date, notes)
  ON seed.gravesite_id = g.gravesite_id
WHERE g.facility_id = 'DEMO-MEMORIAL';

INSERT INTO burials (gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date, interment_type_id, burial_record_status_type_id, funeral_home, veteran, notes, gravesite_id)
SELECT g.id, seed.first_name, seed.last_name, concat_ws(' ', seed.first_name, seed.last_name), seed.sex, seed.birth_date::date, seed.death_date::date,
  seed.age, seed.burial_date::date, burial_interment_types.id, burial_record_status_types.id, seed.funeral_home, seed.veteran, seed.notes, seed.gravesite_id
FROM gravesites g
JOIN burial_interment_types
  ON burial_interment_types.code = 'casket'
JOIN burial_record_status_types
  ON burial_record_status_types.code = 'interred'
JOIN (
  VALUES
    ('A-01-01', 'Mary', 'Harris', 'F', '1931-04-12', '2011-09-02', 80, '2011-09-06', NULL, 'No', 'Interred beside spouse per family deed.'),
    ('A-02-01', 'Samuel', 'Miller', 'M', '1926-01-08', '1998-11-22', 72, '1998-11-26', NULL, 'No', NULL),
    ('A-02-02', 'Ruth', 'Miller', 'F', '1930-06-19', '2019-02-15', 88, '2019-02-20', NULL, 'No', 'Separate gravesite sharing one observed couple marker with Samuel Miller.'),
    ('B-01-01', 'Luis', 'Garcia', 'M', '1944-10-03', '2020-12-28', 76, '2021-01-04', NULL, 'No', NULL),
    ('B-02-01', 'Edward', 'Green', 'M', NULL, '1976-05-30', NULL, '1976-06-02', NULL, 'No', 'Birth date not present in ledger.')
) AS seed(gravesite_id, first_name, last_name, sex, birth_date, death_date, age, burial_date, funeral_home, veteran, notes)
  ON seed.gravesite_id = g.gravesite_id
WHERE g.facility_id = 'DEMO-ST-MARK';

INSERT INTO burials (gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date, interment_type_id, burial_record_status_type_id, funeral_home, veteran, notes, gravesite_id)
SELECT g.id, seed.first_name, seed.last_name, concat_ws(' ', seed.first_name, seed.last_name), seed.sex, seed.birth_date::date, seed.death_date::date,
  seed.age, seed.burial_date::date, burial_interment_types.id, burial_record_status_types.id, seed.funeral_home, seed.veteran, seed.notes, seed.gravesite_id
FROM gravesites g
JOIN burial_interment_types
  ON burial_interment_types.code = 'casket'
JOIN burial_record_status_types
  ON burial_record_status_types.code = 'interred'
JOIN (
  VALUES
    ('A-01-01', 'Helen', 'Rivera', 'F', '1948-08-17', '2022-03-09', 73, '2022-03-14', NULL, 'No', 'Imported from headstone spreadsheet row 89. Memorial Grove burial sharing a grave identifier used by St. Mark.')
) AS seed(gravesite_id, first_name, last_name, sex, birth_date, death_date, age, burial_date, funeral_home, veteran, notes)
  ON seed.gravesite_id = g.gravesite_id
WHERE g.facility_id = 'DEMO-MEMORIAL';

-- Seed observed markers after burials so marker-to-burial links can be created.
INSERT INTO headstones (
  gravesite_uuid, headstone_id, marker_type_id, material_type_id, condition_type_id,
  marker_scope_type_id, inscription, geometry, latitude, longitude, source_properties,
  data_confidence, review_status, review_notes
)
SELECT g.id, 'DEMO-HS-HARRIS', marker_type.id, material_type.id, condition_type.id,
  scope_type.id, 'Mary Harris', ST_SetSRID(ST_MakePoint(-76.704655, 39.19612), 4326),
  39.19612, -76.704655, '{"source":"synthetic-demo"}'::jsonb,
  'high', 'reviewed', 'Single-gravesite marker fixture.'
FROM gravesites g
JOIN marker_types marker_type ON marker_type.code = 'upright_headstone'
JOIN marker_material_types material_type ON material_type.code = 'granite'
JOIN headstone_condition_types condition_type ON condition_type.code = 'good'
JOIN marker_scope_types scope_type ON scope_type.code = 'single'
WHERE g.facility_id = 'DEMO-ST-MARK' AND g.gravesite_id = 'A-01-01';

INSERT INTO headstones (
  gravesite_uuid, headstone_id, marker_type_id, material_type_id, condition_type_id,
  marker_scope_type_id, inscription, geometry, latitude, longitude, source_properties,
  data_confidence, review_status, review_notes
)
SELECT g.id, 'DEMO-HS-MILLER', marker_type.id, material_type.id, condition_type.id,
  scope_type.id, 'Samuel and Ruth Miller', ST_SetSRID(ST_MakePoint(-76.70454, 39.19598), 4326),
  39.19598, -76.70454, '{"source":"synthetic-demo"}'::jsonb,
  'high', 'reviewed', 'Observed couple marker remains fixed and spans two separate gravesites.'
FROM gravesites g
JOIN marker_types marker_type ON marker_type.code = 'companion_monument'
JOIN marker_material_types material_type ON material_type.code = 'granite'
JOIN headstone_condition_types condition_type ON condition_type.code = 'good'
JOIN marker_scope_types scope_type ON scope_type.code = 'couple'
WHERE g.facility_id = 'DEMO-ST-MARK' AND g.gravesite_id = 'A-02-01';

INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
SELECT h.id, g.id,
  CASE WHEN h.headstone_id = 'DEMO-HS-MILLER' THEN 'spans' ELSE 'primary' END,
  CASE WHEN h.headstone_id = 'DEMO-HS-MILLER' THEN 'One observed marker spans both Miller gravesites.' ELSE NULL END
FROM headstones h
JOIN gravesites g ON
  (h.headstone_id = 'DEMO-HS-HARRIS' AND g.gravesite_id = 'A-01-01')
  OR (h.headstone_id = 'DEMO-HS-MILLER' AND g.gravesite_id IN ('A-02-01', 'A-02-02'))
WHERE g.facility_id = 'DEMO-ST-MARK';

INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
SELECT h.id, b.id
FROM headstones h
JOIN burials b ON
  (h.headstone_id = 'DEMO-HS-HARRIS' AND b.gravesite_id = 'A-01-01')
  OR (h.headstone_id = 'DEMO-HS-MILLER' AND b.gravesite_id IN ('A-02-01', 'A-02-02'))
JOIN gravesites g ON g.id = b.gravesite_uuid AND g.facility_id = 'DEMO-ST-MARK';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM blocks WHERE facility_id = 'DEMO-MEMORIAL' AND block_id = 'N1' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Demo fixture must include a block-scoped cemetery hierarchy.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id = 'DEMO-ST-MARK' AND lot_id = '02A' AND block_uuid IS NULL AND width_feet = 16.36 AND length_feet = 16.00
  ) THEN
    RAISE EXCEPTION 'Demo fixture must include a section-scoped, letter-suffixed, non-standard lot.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id = 'DEMO-ST-MARK' AND lot_id = '02' AND width_feet = 10.00 AND length_feet = 12.00
  ) THEN
    RAISE EXCEPTION 'Demo fixture must include a smaller three-gravesite lot footprint.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM lots WHERE facility_id = 'DEMO-ST-MARK' AND lot_id = '03' AND burial_use_status = 'non_burial' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Demo fixture must include a non-burial lot.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM gravesites WHERE facility_id = 'DEMO-ST-MARK' AND gravesite_id = 'B-PASS-01' AND lot_uuid IS NULL AND lot_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Demo fixture must include a passageway gravesite without a lot.';
  END IF;

  IF (SELECT count(*) FROM headstone_gravesites hgs JOIN headstones h ON h.id = hgs.headstone_uuid WHERE h.headstone_id = 'DEMO-HS-MILLER' AND hgs.relationship_type = 'spans' AND hgs.deleted_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'Demo couple marker must span exactly two gravesites.';
  END IF;

  IF (SELECT count(*) FROM headstone_burials hb JOIN headstones h ON h.id = hb.headstone_uuid WHERE h.headstone_id = 'DEMO-HS-MILLER' AND hb.deleted_at IS NULL) <> 2 THEN
    RAISE EXCEPTION 'Demo couple marker must link to both burials.';
  END IF;
END
$$;

COMMIT;
