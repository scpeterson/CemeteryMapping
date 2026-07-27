--liquibase formatted sql

--changeset cemeterymapping:265-retire-knobloch-monolith-placeholder-gravesite splitStatements:false
WITH monolith AS (
  SELECT id
  FROM headstones
  WHERE headstone_id = 'TLC-HS-0284'
    AND deleted_at IS NULL
),
real_gravesites AS (
  SELECT id, gravesite_id
  FROM gravesites
  WHERE gravesite_id IN ('TLC-GPS-0282', 'TLC-GPS-0283', 'TLC-GPS-0285')
    AND deleted_at IS NULL
)
INSERT INTO headstone_gravesites (
  headstone_uuid,
  gravesite_uuid,
  relationship_type,
  notes,
  updated_at
)
SELECT
  monolith.id,
  real_gravesites.id,
  'spans',
  'Knobloch monolith at NHG (8C,4) is the shared family marker for gravesites (8C,2), (8C,3), and (8C,5).',
  now()
FROM monolith
CROSS JOIN real_gravesites
ON CONFLICT (headstone_uuid, gravesite_uuid) DO UPDATE SET
  relationship_type = 'spans',
  notes = EXCLUDED.notes,
  deleted_at = NULL,
  deleted_by = NULL,
  delete_reason = NULL,
  updated_at = now();

UPDATE headstones
SET
  gravesite_uuid = (
    SELECT id
    FROM gravesites
    WHERE gravesite_id = 'TLC-GPS-0283'
      AND deleted_at IS NULL
  ),
  updated_at = now()
WHERE headstone_id = 'TLC-HS-0284'
  AND deleted_at IS NULL;

UPDATE headstone_gravesites
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'Removed marker link to nonexistent placeholder gravesite C-0284.',
  updated_at = now()
FROM headstones, gravesites
WHERE headstone_gravesites.headstone_uuid = headstones.id
  AND headstone_gravesites.gravesite_uuid = gravesites.id
  AND headstones.headstone_id = 'TLC-HS-0284'
  AND gravesites.gravesite_id = 'TLC-GPS-0284'
  AND headstone_gravesites.deleted_at IS NULL;

UPDATE gravesites
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'C-0284 represented the Knobloch monolith position, not a physical gravesite.',
  updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0284'
  AND deleted_at IS NULL;

--rollback UPDATE gravesites SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = now() WHERE gravesite_id = 'TLC-GPS-0284';
--rollback UPDATE headstone_gravesites SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, relationship_type = 'primary', notes = NULL, updated_at = now() FROM headstones, gravesites WHERE headstone_gravesites.headstone_uuid = headstones.id AND headstone_gravesites.gravesite_uuid = gravesites.id AND headstones.headstone_id = 'TLC-HS-0284' AND gravesites.gravesite_id = 'TLC-GPS-0284';
--rollback UPDATE headstones SET gravesite_uuid = (SELECT id FROM gravesites WHERE gravesite_id = 'TLC-GPS-0284'), updated_at = now() WHERE headstone_id = 'TLC-HS-0284';
--rollback UPDATE headstone_gravesites SET deleted_at = now(), deleted_by = NULL, delete_reason = 'Rollback of Knobloch monolith shared-gravesite links.', updated_at = now() FROM headstones, gravesites WHERE headstone_gravesites.headstone_uuid = headstones.id AND headstone_gravesites.gravesite_uuid = gravesites.id AND headstones.headstone_id = 'TLC-HS-0284' AND gravesites.gravesite_id IN ('TLC-GPS-0282', 'TLC-GPS-0283', 'TLC-GPS-0285') AND headstone_gravesites.relationship_type = 'spans';
