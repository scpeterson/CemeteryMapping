--liquibase formatted sql

--changeset cemeterymapping:033-media-assets splitStatements:false
CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cemetery_id uuid NOT NULL REFERENCES cemeteries(id) ON DELETE CASCADE,
  asset_type varchar(50) NOT NULL DEFAULT 'photo',
  storage_key varchar(500) NOT NULL,
  file_url varchar(700) NOT NULL,
  thumbnail_url varchar(700),
  original_filename varchar(255),
  content_type varchar(100),
  byte_size integer,
  captured_at timestamptz,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  captured_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  captured_by_external_subject varchar(300),
  captured_by_email varchar(320),
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  gps_accuracy numeric(10, 2),
  device_make varchar(100),
  device_model varchar(100),
  notes varchar(4000),
  source varchar(50) NOT NULL DEFAULT 'admin_upload',
  status varchar(50) NOT NULL DEFAULT 'linked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(500),
  CONSTRAINT media_assets_asset_type_check CHECK (asset_type IN ('photo', 'document', 'scan', 'map', 'other')),
  CONSTRAINT media_assets_source_check CHECK (source IN ('iphone', 'admin_upload', 'field_upload', 'import', 'other')),
  CONSTRAINT media_assets_status_check CHECK (status IN ('staged', 'linked', 'needs_review', 'rejected')),
  CONSTRAINT media_assets_latitude_check CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT media_assets_longitude_check CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE TABLE gravesite_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  gravesite_uuid uuid NOT NULL REFERENCES gravesites(id) ON DELETE CASCADE,
  relationship_type varchar(50) NOT NULL DEFAULT 'documents',
  status varchar(50) NOT NULL DEFAULT 'linked',
  notes varchar(4000),
  linked_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  linked_by_external_subject varchar(300),
  linked_by_email varchar(320),
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(500),
  CONSTRAINT gravesite_media_assets_unique UNIQUE (media_asset_id, gravesite_uuid),
  CONSTRAINT gravesite_media_assets_status_check CHECK (status IN ('linked', 'needs_review', 'rejected')),
  CONSTRAINT gravesite_media_assets_relationship_check CHECK (relationship_type IN ('documents', 'context', 'overview', 'needs_review'))
);

CREATE TABLE headstone_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_asset_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  headstone_uuid uuid NOT NULL REFERENCES headstones(id) ON DELETE CASCADE,
  relationship_type varchar(50) NOT NULL DEFAULT 'documents',
  status varchar(50) NOT NULL DEFAULT 'linked',
  notes varchar(4000),
  linked_by_app_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  linked_by_external_subject varchar(300),
  linked_by_email varchar(320),
  linked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid REFERENCES app_users(id) ON DELETE SET NULL,
  delete_reason varchar(500),
  CONSTRAINT headstone_media_assets_unique UNIQUE (media_asset_id, headstone_uuid),
  CONSTRAINT headstone_media_assets_status_check CHECK (status IN ('linked', 'needs_review', 'rejected')),
  CONSTRAINT headstone_media_assets_relationship_check CHECK (relationship_type IN ('documents', 'context', 'detail', 'needs_review'))
);

CREATE INDEX media_assets_cemetery_status_idx ON media_assets (cemetery_id, status, uploaded_at DESC);
CREATE INDEX media_assets_uploaded_at_idx ON media_assets (uploaded_at DESC);
CREATE INDEX gravesite_media_assets_gravesite_idx ON gravesite_media_assets (gravesite_uuid, status);
CREATE INDEX gravesite_media_assets_asset_idx ON gravesite_media_assets (media_asset_id, status);
CREATE INDEX headstone_media_assets_headstone_idx ON headstone_media_assets (headstone_uuid, status);
CREATE INDEX headstone_media_assets_asset_idx ON headstone_media_assets (media_asset_id, status);

CREATE TRIGGER touch_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_gravesite_media_assets_updated_at
  BEFORE UPDATE ON gravesite_media_assets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER touch_headstone_media_assets_updated_at
  BEFORE UPDATE ON headstone_media_assets
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER audit_media_assets_changes
  AFTER INSERT OR UPDATE OR DELETE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_gravesite_media_assets_changes
  AFTER INSERT OR UPDATE OR DELETE ON gravesite_media_assets
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

CREATE TRIGGER audit_headstone_media_assets_changes
  AFTER INSERT OR UPDATE OR DELETE ON headstone_media_assets
  FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

--rollback DROP TRIGGER IF EXISTS audit_headstone_media_assets_changes ON headstone_media_assets;
--rollback DROP TRIGGER IF EXISTS audit_gravesite_media_assets_changes ON gravesite_media_assets;
--rollback DROP TRIGGER IF EXISTS audit_media_assets_changes ON media_assets;
--rollback DROP TRIGGER IF EXISTS touch_headstone_media_assets_updated_at ON headstone_media_assets;
--rollback DROP TRIGGER IF EXISTS touch_gravesite_media_assets_updated_at ON gravesite_media_assets;
--rollback DROP TRIGGER IF EXISTS touch_media_assets_updated_at ON media_assets;
--rollback DROP INDEX IF EXISTS headstone_media_assets_asset_idx;
--rollback DROP INDEX IF EXISTS headstone_media_assets_headstone_idx;
--rollback DROP INDEX IF EXISTS gravesite_media_assets_asset_idx;
--rollback DROP INDEX IF EXISTS gravesite_media_assets_gravesite_idx;
--rollback DROP INDEX IF EXISTS media_assets_uploaded_at_idx;
--rollback DROP INDEX IF EXISTS media_assets_cemetery_status_idx;
--rollback DROP TABLE IF EXISTS headstone_media_assets;
--rollback DROP TABLE IF EXISTS gravesite_media_assets;
--rollback DROP TABLE IF EXISTS media_assets;
