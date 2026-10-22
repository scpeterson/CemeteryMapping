--liquibase formatted sql

--changeset cemeterymapping:493-single-face-photo-links
-- Add existing active monument photos to the sole Front face. This structural
-- association must not recapture or overwrite independent inspection readings.
ALTER TABLE headstones DISABLE TRIGGER capture_monument_inspection;
WITH linked AS (
 SELECT h.id,jsonb_agg(m.id::text ORDER BY m.id) AS photo_ids
 FROM headstones h JOIN headstone_media_assets l ON l.headstone_uuid=h.id
 JOIN media_assets m ON m.id=l.media_asset_id
 WHERE h.deleted_at IS NULL AND jsonb_array_length(h.faces)=1 AND h.faces->0->>'label'='Front'
 AND l.deleted_at IS NULL AND l.status='linked' AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo'
 GROUP BY h.id
), merged AS (
 SELECT h.id,COALESCE(h.faces->0->'mediaAssetIds','[]'::jsonb) || COALESCE((
  SELECT jsonb_agg(p ORDER BY p) FROM jsonb_array_elements_text(linked.photo_ids) p
  WHERE NOT jsonb_exists(COALESCE(h.faces->0->'mediaAssetIds','[]'::jsonb),p)
 ),'[]'::jsonb) AS photo_ids
 FROM linked JOIN headstones h ON h.id=linked.id
)
UPDATE headstones h SET faces=jsonb_set(h.faces,'{0,mediaAssetIds}',merged.photo_ids),updated_at=now()
 FROM merged WHERE h.id=merged.id AND h.faces->0->'mediaAssetIds' IS DISTINCT FROM merged.photo_ids;
ALTER TABLE headstones ENABLE TRIGGER capture_monument_inspection;

-- Label only existing observation links. Each inspection uses its own Front
-- face identity; no photo is linked to an inspection that did not already own it.
UPDATE monument_photo_contexts c SET face_id=(
 CASE WHEN c.inspection_id IS NOT NULL THEN i.faces->0->>'id' ELSE h.faces->0->>'id' END
)::uuid,updated_at=now()
FROM headstones h LEFT JOIN monument_inspections i ON i.headstone_uuid=h.id
WHERE c.headstone_uuid=h.id AND (c.inspection_id IS NULL OR c.inspection_id=i.id)
 AND h.deleted_at IS NULL AND jsonb_array_length(h.faces)=1 AND h.faces->0->>'label'='Front'
 AND c.deleted_at IS NULL AND c.face_id IS NULL
 AND (c.inspection_id IS NULL OR (jsonb_array_length(i.faces)=1 AND i.faces->0->>'label'='Front'))
 AND EXISTS(SELECT 1 FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id
  WHERE l.headstone_uuid=h.id AND l.media_asset_id=c.media_asset_id AND l.deleted_at IS NULL AND l.status='linked'
  AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo');
-- Retain recorded photo associations when reverting the changelog.
--rollback empty
