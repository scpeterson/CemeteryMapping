--liquibase formatted sql

--changeset cemeterymapping:096-geometry-metadata
ALTER TABLE lots
  ADD COLUMN geometry_type varchar(30) NOT NULL DEFAULT 'operational',
  ADD COLUMN geometry_source varchar(255),
  ADD COLUMN geometry_confidence varchar(30) NOT NULL DEFAULT 'estimated',
  ADD COLUMN geometry_notes text,
  ADD CONSTRAINT lots_geometry_type_check CHECK (geometry_type IN ('evidence', 'operational', 'schematic')),
  ADD CONSTRAINT lots_geometry_confidence_check CHECK (geometry_confidence IN ('gps', 'surveyed', 'reviewed', 'estimated', 'draft', 'unknown'));

ALTER TABLE gravesites
  ADD COLUMN geometry_type varchar(30) NOT NULL DEFAULT 'operational',
  ADD COLUMN geometry_source varchar(255),
  ADD COLUMN geometry_confidence varchar(30) NOT NULL DEFAULT 'estimated',
  ADD COLUMN geometry_notes text,
  ADD CONSTRAINT gravesites_geometry_type_check CHECK (geometry_type IN ('evidence', 'operational', 'schematic')),
  ADD CONSTRAINT gravesites_geometry_confidence_check CHECK (geometry_confidence IN ('gps', 'surveyed', 'reviewed', 'estimated', 'draft', 'unknown'));

UPDATE lots
SET
  geometry_type = 'schematic',
  geometry_source = 'Lot grid constructed from Section C anchors and historic diagram spacing.',
  geometry_confidence = 'reviewed',
  geometry_notes = 'Diagram layer geometry intended to preserve readable 10 ft x 20 ft lot layout; not a surveyed boundary.'
WHERE deleted_at IS NULL
  AND upper(COALESCE(section_id, '')) = 'C'
  AND block_id IS NULL
  AND lot_id IN (
    '10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
    '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
    '39', '40',
    '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51',
    '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85',
    '86', '87', '88', '89', '90',
    '91', '92', '93', '94', '95',
    '96', '97', '98', '99', '100'
  );

UPDATE lots
SET
  geometry_type = 'schematic',
  geometry_source = 'Lot grid constructed 12 ft east of Section C anchors and aligned to the Section C diagram rows.',
  geometry_confidence = 'reviewed',
  geometry_notes = 'Diagram layer geometry intended to preserve readable 10 ft x 20 ft lot layout; not a surveyed boundary.'
WHERE deleted_at IS NULL
  AND upper(COALESCE(section_id, '')) = 'A'
  AND block_id IS NULL
  AND lot_id IN (
    '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '30', '31', '32', '33', '34', '35', '36', '37', '38',
    '52', '53', '54', '55', '56', '57', '58', '59', '60',
    '61', '62', '63', '64', '65', '66', '67', '68', '69'
  );

UPDATE gravesites
SET
  geometry_type = 'operational',
  geometry_source = 'Generated Section G plot layout with no headstone GPS points recorded yet.',
  geometry_confidence = 'draft',
  geometry_notes = 'Operational gravesite polygons are placeholders until field evidence is linked.'
WHERE deleted_at IS NULL
  AND upper(COALESCE(section_id, '')) = 'G';

--rollback ALTER TABLE gravesites DROP CONSTRAINT IF EXISTS gravesites_geometry_confidence_check, DROP CONSTRAINT IF EXISTS gravesites_geometry_type_check, DROP COLUMN IF EXISTS geometry_notes, DROP COLUMN IF EXISTS geometry_confidence, DROP COLUMN IF EXISTS geometry_source, DROP COLUMN IF EXISTS geometry_type;
--rollback ALTER TABLE lots DROP CONSTRAINT IF EXISTS lots_geometry_confidence_check, DROP CONSTRAINT IF EXISTS lots_geometry_type_check, DROP COLUMN IF EXISTS geometry_notes, DROP COLUMN IF EXISTS geometry_confidence, DROP COLUMN IF EXISTS geometry_source, DROP COLUMN IF EXISTS geometry_type;
