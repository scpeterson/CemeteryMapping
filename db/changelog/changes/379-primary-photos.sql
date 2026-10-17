--liquibase formatted sql

--changeset cemeterymapping:379-primary-photos
ALTER TABLE headstone_media_assets ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
ALTER TABLE gravesite_media_assets ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX headstone_media_assets_one_primary
  ON headstone_media_assets (headstone_uuid)
  WHERE is_primary AND deleted_at IS NULL AND status = 'linked';
CREATE UNIQUE INDEX gravesite_media_assets_one_primary
  ON gravesite_media_assets (gravesite_uuid)
  WHERE is_primary AND deleted_at IS NULL AND status = 'linked';

--rollback DROP INDEX gravesite_media_assets_one_primary;
--rollback DROP INDEX headstone_media_assets_one_primary;
--rollback ALTER TABLE gravesite_media_assets DROP COLUMN is_primary;
--rollback ALTER TABLE headstone_media_assets DROP COLUMN is_primary;
