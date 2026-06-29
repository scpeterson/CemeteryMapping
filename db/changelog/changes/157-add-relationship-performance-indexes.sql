--liquibase formatted sql

--changeset cemeterymapping:157-add-relationship-performance-indexes
CREATE INDEX IF NOT EXISTS burials_gravesite_uuid_active_idx
  ON burials (gravesite_uuid)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS owners_gravesite_uuid_active_idx
  ON owners (gravesite_uuid)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS lots_cemetery_id_active_idx
  ON lots (cemetery_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS gravesites_lot_uuid_active_idx
  ON gravesites (lot_uuid)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS headstones_gravesite_uuid_active_idx
  ON headstones (gravesite_uuid)
  WHERE deleted_at IS NULL;

--rollback DROP INDEX IF EXISTS headstones_gravesite_uuid_active_idx;
--rollback DROP INDEX IF EXISTS gravesites_lot_uuid_active_idx;
--rollback DROP INDEX IF EXISTS lots_cemetery_id_active_idx;
--rollback DROP INDEX IF EXISTS owners_gravesite_uuid_active_idx;
--rollback DROP INDEX IF EXISTS burials_gravesite_uuid_active_idx;
