--liquibase formatted sql

--changeset cemeterymapping:124-repair-c-0190-kempf-anna-scope splitStatements:false
WITH c_0190_marker AS (
  SELECT id
  FROM headstones
  WHERE headstone_id = 'TLC-HS-0190'
    AND deleted_at IS NULL
),
misassigned_anna_records AS (
  SELECT DISTINCT
    burials.id AS burial_uuid,
    correct_gravesite.id AS correct_gravesite_uuid,
    correct_gravesite.gravesite_id AS correct_gravesite_id
  FROM burials
  JOIN headstone_burials AS non_c_0190_burial_link
    ON non_c_0190_burial_link.burial_uuid = burials.id
   AND non_c_0190_burial_link.deleted_at IS NULL
  JOIN headstones AS non_c_0190_marker
    ON non_c_0190_marker.id = non_c_0190_burial_link.headstone_uuid
   AND non_c_0190_marker.deleted_at IS NULL
   AND non_c_0190_marker.headstone_id <> 'TLC-HS-0190'
  JOIN gravesites AS correct_gravesite
    ON correct_gravesite.id = non_c_0190_marker.gravesite_uuid
   AND correct_gravesite.deleted_at IS NULL
  WHERE burials.deleted_at IS NULL
    AND lower(COALESCE(burials.full_name, '')) = 'anna kempf'
    AND EXISTS (
      SELECT 1
      FROM headstone_burials AS c_0190_burial_link
      JOIN c_0190_marker
        ON c_0190_marker.id = c_0190_burial_link.headstone_uuid
      WHERE c_0190_burial_link.burial_uuid = burials.id
        AND c_0190_burial_link.deleted_at IS NULL
    )
),
restored_burials AS (
  UPDATE burials
  SET
    gravesite_uuid = misassigned_anna_records.correct_gravesite_uuid,
    gravesite_id = misassigned_anna_records.correct_gravesite_id,
    updated_at = now()
  FROM misassigned_anna_records
  WHERE burials.id = misassigned_anna_records.burial_uuid
  RETURNING burials.id
)
UPDATE headstone_burials
SET
  deleted_at = now(),
  deleted_by = NULL,
  delete_reason = 'Repair C-0190 split so Anna Kempf records linked to another marker remain with that marker.'
FROM restored_burials, c_0190_marker
WHERE headstone_burials.burial_uuid = restored_burials.id
  AND headstone_burials.headstone_uuid = c_0190_marker.id
  AND headstone_burials.deleted_at IS NULL;

--rollback UPDATE headstone_burials SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL WHERE delete_reason = 'Repair C-0190 split so Anna Kempf records linked to another marker remain with that marker.';
