--liquibase formatted sql

--changeset cemeterymapping:112-media-asset-display-order splitStatements:false
ALTER TABLE gravesite_media_assets
  ADD COLUMN display_order integer NOT NULL DEFAULT 0;

ALTER TABLE headstone_media_assets
  ADD COLUMN display_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    link.id,
    ROW_NUMBER() OVER (
      PARTITION BY link.gravesite_uuid
      ORDER BY media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
    ) - 1 AS display_order
  FROM gravesite_media_assets link
  JOIN media_assets
    ON media_assets.id = link.media_asset_id
  WHERE link.deleted_at IS NULL
    AND link.status = 'linked'
    AND media_assets.deleted_at IS NULL
    AND media_assets.status = 'linked'
)
UPDATE gravesite_media_assets link
SET display_order = ranked.display_order
FROM ranked
WHERE ranked.id = link.id;

WITH ranked AS (
  SELECT
    link.id,
    ROW_NUMBER() OVER (
      PARTITION BY link.headstone_uuid
      ORDER BY media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC, media_assets.id
    ) - 1 AS display_order
  FROM headstone_media_assets link
  JOIN media_assets
    ON media_assets.id = link.media_asset_id
  WHERE link.deleted_at IS NULL
    AND link.status = 'linked'
    AND media_assets.deleted_at IS NULL
    AND media_assets.status = 'linked'
)
UPDATE headstone_media_assets link
SET display_order = ranked.display_order
FROM ranked
WHERE ranked.id = link.id;

CREATE INDEX gravesite_media_assets_display_order_idx ON gravesite_media_assets (gravesite_uuid, status, display_order);
CREATE INDEX headstone_media_assets_display_order_idx ON headstone_media_assets (headstone_uuid, status, display_order);

--rollback DROP INDEX IF EXISTS headstone_media_assets_display_order_idx;
--rollback DROP INDEX IF EXISTS gravesite_media_assets_display_order_idx;
--rollback ALTER TABLE headstone_media_assets DROP COLUMN IF EXISTS display_order;
--rollback ALTER TABLE gravesite_media_assets DROP COLUMN IF EXISTS display_order;
