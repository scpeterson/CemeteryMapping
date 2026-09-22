--liquibase formatted sql

--changeset cemeterymapping:411-link-deer-family-monument splitStatements:false
CREATE TEMP TABLE deer_monument_people ON COMMIT DROP AS
SELECT h.id AS marker_id, g.id AS grave_id, b.id AS burial_id, expected.face_label, expected.face_order
FROM (VALUES
  ('TLC-GPS-0092', 'Nannie N Deer', 'Front', 2),
  ('TLC-GPS-0093', 'F. Myrtle Deer', 'Front', 1),
  ('TLC-GPS-0099', 'William Deer', 'Back', 1),
  ('TLC-GPS-0100', 'Mary Deer', 'Left', 1)
) AS expected(gravesite_id, full_name, face_label, face_order)
JOIN gravesites g ON g.gravesite_id = expected.gravesite_id AND g.deleted_at IS NULL
JOIN burials b ON b.gravesite_uuid = g.id AND b.full_name = expected.full_name AND b.deleted_at IS NULL
JOIN headstones h ON h.headstone_id = 'TLC-HS-0098' AND h.deleted_at IS NULL;

SELECT assert_migration_prerequisite(
  NOT EXISTS (SELECT 1 FROM headstones WHERE headstone_id = 'TLC-HS-0098' AND deleted_at IS NULL)
  OR ((SELECT count(*) FROM deer_monument_people) = 4
    AND (SELECT count(DISTINCT grave_id) FROM deer_monument_people) = 4),
  'Deer family monument must have exactly one matching person in each confirmed gravesite'
);

UPDATE headstone_gravesites hg
SET deleted_at = now(), deleted_by = NULL, updated_at = now(),
  delete_reason = 'Corrected Deer family monument links to confirmed B-0092, B-0093, B-0099 and B-0100.'
FROM headstones h, gravesites g
WHERE hg.headstone_uuid = h.id AND hg.gravesite_uuid = g.id
  AND h.headstone_id = 'TLC-HS-0098' AND h.deleted_at IS NULL
  AND g.gravesite_id = 'TLC-GPS-0094' AND hg.deleted_at IS NULL;

INSERT INTO headstone_gravesites (headstone_uuid, gravesite_uuid, relationship_type, notes)
SELECT marker_id, grave_id, 'secondary', 'Shared Deer family monument; individual burial is in this gravesite.'
FROM deer_monument_people
ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now();

INSERT INTO headstone_burials (headstone_uuid, burial_uuid)
SELECT marker_id, burial_id FROM deer_monument_people
ON CONFLICT (headstone_uuid, burial_uuid) DO UPDATE SET
  deleted_at = NULL, deleted_by = NULL, delete_reason = NULL;

-- Keep face text, photos, labels and order; associate the people named on each side.
-- Environments without these manually entered faces keep their existing faces.
UPDATE headstones h
SET faces = (
  SELECT jsonb_agg(CASE WHEN EXISTS (
      SELECT 1 FROM deer_monument_people p WHERE p.marker_id = h.id AND p.face_label = face->>'label'
    ) THEN jsonb_set(face, '{burialIds}', (
      SELECT jsonb_agg(p.burial_id::text ORDER BY p.face_order)
      FROM deer_monument_people p WHERE p.marker_id = h.id AND p.face_label = face->>'label'
    )) ELSE face END ORDER BY ordinal)
  FROM jsonb_array_elements(h.faces) WITH ORDINALITY AS f(face, ordinal)
), updated_at = now()
WHERE h.headstone_id = 'TLC-HS-0098' AND h.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(h.faces) face
    WHERE face->>'label' IN ('Front', 'Left', 'Back'));

--rollback empty
