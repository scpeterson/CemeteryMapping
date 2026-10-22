--liquibase formatted sql

--changeset cemeterymapping:489-preserve-inspection-photo-face-labels
-- Preserve known assignments from the original 2026 face snapshots. Photos
-- associated with several faces remain unassigned rather than guessing.
UPDATE monument_photo_contexts c SET face_id=known.face_id
FROM (
 SELECT c.id, min(f->>'id')::uuid AS face_id
 FROM monument_photo_contexts c JOIN monument_inspections i ON i.id=c.inspection_id
 CROSS JOIN LATERAL jsonb_array_elements(i.faces) f
 WHERE c.deleted_at IS NULL AND c.face_id IS NULL AND i.source_type='field_survey' AND i.inspection_year=2026
 AND jsonb_exists(COALESCE(f->'mediaAssetIds','[]'::jsonb), c.media_asset_id::text)
 GROUP BY c.id HAVING count(*)=1
) known WHERE c.id=known.id;
--rollback empty
