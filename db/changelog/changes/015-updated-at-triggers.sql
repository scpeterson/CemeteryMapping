--liquibase formatted sql

--changeset cemeterymapping:015-updated-at-triggers splitStatements:false
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_app_users_updated_at ON app_users;
CREATE TRIGGER touch_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_blocks_updated_at ON blocks;
CREATE TRIGGER touch_blocks_updated_at
  BEFORE UPDATE ON blocks
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_burials_updated_at ON burials;
CREATE TRIGGER touch_burials_updated_at
  BEFORE UPDATE ON burials
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_cemeteries_updated_at ON cemeteries;
CREATE TRIGGER touch_cemeteries_updated_at
  BEFORE UPDATE ON cemeteries
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_gravesites_updated_at ON gravesites;
CREATE TRIGGER touch_gravesites_updated_at
  BEFORE UPDATE ON gravesites
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_headstones_updated_at ON headstones;
CREATE TRIGGER touch_headstones_updated_at
  BEFORE UPDATE ON headstones
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_lot_owner_parties_updated_at ON lot_owner_parties;
CREATE TRIGGER touch_lot_owner_parties_updated_at
  BEFORE UPDATE ON lot_owner_parties
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_lot_ownership_events_updated_at ON lot_ownership_events;
CREATE TRIGGER touch_lot_ownership_events_updated_at
  BEFORE UPDATE ON lot_ownership_events
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_lots_updated_at ON lots;
CREATE TRIGGER touch_lots_updated_at
  BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_memorials_updated_at ON memorials;
CREATE TRIGGER touch_memorials_updated_at
  BEFORE UPDATE ON memorials
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_owners_updated_at ON owners;
CREATE TRIGGER touch_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS touch_sections_updated_at ON sections;
CREATE TRIGGER touch_sections_updated_at
  BEFORE UPDATE ON sections
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

--rollback DROP TRIGGER IF EXISTS touch_sections_updated_at ON sections;
--rollback DROP TRIGGER IF EXISTS touch_owners_updated_at ON owners;
--rollback DROP TRIGGER IF EXISTS touch_memorials_updated_at ON memorials;
--rollback DROP TRIGGER IF EXISTS touch_lots_updated_at ON lots;
--rollback DROP TRIGGER IF EXISTS touch_lot_ownership_events_updated_at ON lot_ownership_events;
--rollback DROP TRIGGER IF EXISTS touch_lot_owner_parties_updated_at ON lot_owner_parties;
--rollback DROP TRIGGER IF EXISTS touch_headstones_updated_at ON headstones;
--rollback DROP TRIGGER IF EXISTS touch_gravesites_updated_at ON gravesites;
--rollback DROP TRIGGER IF EXISTS touch_cemeteries_updated_at ON cemeteries;
--rollback DROP TRIGGER IF EXISTS touch_burials_updated_at ON burials;
--rollback DROP TRIGGER IF EXISTS touch_blocks_updated_at ON blocks;
--rollback DROP TRIGGER IF EXISTS touch_app_users_updated_at ON app_users;
--rollback DROP FUNCTION IF EXISTS touch_updated_at();
