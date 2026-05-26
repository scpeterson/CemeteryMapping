BEGIN;

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

INSERT INTO lots (
  cemetery_id,
  section_uuid,
  name,
  facility_id,
  section_id,
  lot_id,
  geometry
)
SELECT c.id, s.section_id, concat('Lot ', seed.lot_id), c.facility_id, seed.section_id, seed.lot_id,
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', -76.70468, 39.19605, -76.70429, 39.19619),
    ('A', '02', -76.70468, 39.19591, -76.70441, 39.19605),
    ('B', '01', -76.70420, 39.19605, -76.70393, 39.19619),
    ('B', '02', -76.70420, 39.19591, -76.70393, 39.19605)
) AS seed(section_id, lot_id, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
WHERE c.facility_id = 'DEMO-ST-MARK';

INSERT INTO lots (
  cemetery_id,
  section_uuid,
  name,
  facility_id,
  section_id,
  lot_id,
  geometry
)
SELECT c.id, s.section_id, concat('Lot ', seed.lot_id), c.facility_id, seed.section_id, seed.lot_id,
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', -76.70344, 39.19598, -76.70314, 39.19612)
) AS seed(section_id, lot_id, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
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
  status,
  cost,
  geometry
)
SELECT c.id, s.section_id, l.id, s.name, c.facility_id, seed.section_id, seed.lot_id, seed.grave_id,
  concat(seed.section_id, '-', seed.lot_id, '-', seed.grave_id),
  seed.status,
  seed.cost,
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', '01', 'Occupied', 1200.00, -76.70466, 39.19607, -76.70455, 39.19617),
    ('A', '01', '02', 'Reserved', 1200.00, -76.70454, 39.19607, -76.70443, 39.19617),
    ('A', '01', '03', 'Available', 1200.00, -76.70442, 39.19607, -76.70431, 39.19617),
    ('A', '02', '01', 'Occupied', 1200.00, -76.70466, 39.19593, -76.70455, 39.19603),
    ('A', '02', '02', 'Sold', 1200.00, -76.70454, 39.19593, -76.70443, 39.19603),
    ('B', '01', '01', 'Occupied', 1200.00, -76.70418, 39.19607, -76.70407, 39.19617),
    ('B', '01', '02', 'Reserved', 1200.00, -76.70406, 39.19607, -76.70395, 39.19617),
    ('B', '02', '01', 'Needs Review', 1200.00, -76.70418, 39.19593, -76.70407, 39.19603),
    ('B', '02', '02', 'Available', 1200.00, -76.70406, 39.19593, -76.70395, 39.19603)
) AS seed(section_id, lot_id, grave_id, status, cost, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
JOIN lots l ON l.cemetery_id = c.id AND l.section_id = seed.section_id AND l.lot_id = seed.lot_id
WHERE c.facility_id = 'DEMO-ST-MARK';

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
  status,
  cost,
  geometry
)
SELECT c.id, s.section_id, l.id, s.name, c.facility_id, seed.section_id, seed.lot_id, seed.grave_id,
  concat(seed.section_id, '-', seed.lot_id, '-', seed.grave_id),
  seed.status,
  seed.cost,
  ST_Multi(ST_MakeEnvelope(seed.west, seed.south, seed.east, seed.north, 4326))::geometry(MultiPolygon, 4326)
FROM cemeteries c
JOIN (
  VALUES
    ('A', '01', '01', 'Reserved', 950.00, -76.70342, 39.19600, -76.70330, 39.19610),
    ('A', '01', '02', 'Available', 950.00, -76.70328, 39.19600, -76.70316, 39.19610)
) AS seed(section_id, lot_id, grave_id, status, cost, west, south, east, north)
  ON true
JOIN sections s ON s.cemetery_id = c.id AND s.name = seed.section_id
JOIN lots l ON l.cemetery_id = c.id AND l.section_id = seed.section_id AND l.lot_id = seed.lot_id
WHERE c.facility_id = 'DEMO-MEMORIAL';

INSERT INTO owners (gravesite_uuid, owner, co_owner, full_address, municipality, state, zip, phone, email, sale_date, notes, gravesite_id)
SELECT g.id, seed.owner, seed.co_owner, seed.full_address, seed.municipality, seed.state, seed.zip, seed.phone, seed.email, seed.sale_date::date, seed.notes, seed.gravesite_id
FROM gravesites g
JOIN (
  VALUES
    ('A-01-01', 'Harris Family Trust', NULL, '10 Oak Road', 'Demo Township', 'MD', '21000', '555-0101', 'harris@example.test', '1972-05-18', 'Primary contact: Elaine Harris'),
    ('A-01-02', 'Harris Family Trust', NULL, '10 Oak Road', 'Demo Township', 'MD', '21000', '555-0101', 'harris@example.test', '1972-05-18', 'Reserved for family use'),
    ('A-01-03', 'St. Mark Church Cemetery Association', NULL, '100 Church Lane', 'Demo Township', 'MD', '21000', '555-0100', 'records@example.test', '2023-08-10', 'Confirmed unsold during deed reconciliation'),
    ('A-02-01', 'Samuel Miller', 'Ruth Miller', '22 Maple Street', 'Demo Township', 'MD', '21000', '555-0102', 'miller@example.test', '1965-03-04', 'Receipt 1022'),
    ('A-02-02', 'Clara Watkins', NULL, '44 Pine Avenue', 'Demo Township', 'MD', '21000', '555-0103', 'watkins@example.test', '2008-07-12', 'Transfer Form 2008-17'),
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

INSERT INTO burials (gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date, funeral_home, monument_type, veteran, notes, gravesite_id)
SELECT g.id, seed.first_name, seed.last_name, concat_ws(' ', seed.first_name, seed.last_name), seed.sex, seed.birth_date::date, seed.death_date::date,
  seed.age, seed.burial_date::date, seed.funeral_home, seed.monument_type, seed.veteran, seed.notes, seed.gravesite_id
FROM gravesites g
JOIN (
  VALUES
    ('A-01-01', 'Mary', 'Harris', 'F', '1931-04-12', '2011-09-02', 80, '2011-09-06', NULL, NULL, 'No', 'Interred beside spouse per family deed.'),
    ('A-02-01', 'Samuel', 'Miller', 'M', '1926-01-08', '1998-11-22', 72, '1998-11-26', NULL, NULL, 'No', NULL),
    ('A-02-01', 'Ruth', 'Miller', 'F', '1930-06-19', '2019-02-15', 88, '2019-02-20', NULL, NULL, 'No', NULL),
    ('B-01-01', 'Luis', 'Garcia', 'M', '1944-10-03', '2020-12-28', 76, '2021-01-04', NULL, NULL, 'No', NULL),
    ('B-02-01', 'Edward', 'Green', 'M', NULL, '1976-05-30', NULL, '1976-06-02', NULL, NULL, 'No', 'Birth date not present in ledger.')
) AS seed(gravesite_id, first_name, last_name, sex, birth_date, death_date, age, burial_date, funeral_home, monument_type, veteran, notes)
  ON seed.gravesite_id = g.gravesite_id
WHERE g.facility_id = 'DEMO-ST-MARK';

INSERT INTO burials (gravesite_uuid, first_name, last_name, full_name, sex, birth_date, death_date, age, burial_date, funeral_home, monument_type, veteran, notes, gravesite_id)
SELECT g.id, seed.first_name, seed.last_name, concat_ws(' ', seed.first_name, seed.last_name), seed.sex, seed.birth_date::date, seed.death_date::date,
  seed.age, seed.burial_date::date, seed.funeral_home, seed.monument_type, seed.veteran, seed.notes, seed.gravesite_id
FROM gravesites g
JOIN (
  VALUES
    ('A-01-01', 'Helen', 'Rivera', 'F', '1948-08-17', '2022-03-09', 73, '2022-03-14', NULL, NULL, 'No', 'Imported from headstone spreadsheet row 89. Memorial Grove burial sharing a grave identifier used by St. Mark.')
) AS seed(gravesite_id, first_name, last_name, sex, birth_date, death_date, age, burial_date, funeral_home, monument_type, veteran, notes)
  ON seed.gravesite_id = g.gravesite_id
WHERE g.facility_id = 'DEMO-MEMORIAL';

COMMIT;
