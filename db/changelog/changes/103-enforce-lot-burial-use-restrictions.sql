--liquibase formatted sql

--changeset cemeterymapping:103-enforce-lot-burial-use-restrictions splitStatements:false
CREATE OR REPLACE FUNCTION enforce_lot_burial_use_restrictions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  selected_lot record;
  restricted_area record;
BEGIN
  IF NEW.lot_uuid IS NULL OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    lots.id,
    lots.burial_use_status,
    lots.section_id,
    lots.lot_id
  INTO selected_lot
  FROM lots
  WHERE lots.id = NEW.lot_uuid
    AND lots.deleted_at IS NULL;

  IF selected_lot.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF selected_lot.burial_use_status = 'non_burial' THEN
    RAISE EXCEPTION 'Lot %-% cannot contain gravesites or markers.', selected_lot.section_id, selected_lot.lot_id
      USING ERRCODE = '23514';
  END IF;

  SELECT
    lot_restricted_areas.name
  INTO restricted_area
  FROM lot_restricted_areas
  WHERE lot_restricted_areas.lot_uuid = NEW.lot_uuid
    AND lot_restricted_areas.deleted_at IS NULL
    AND ST_Intersects(NEW.geometry, lot_restricted_areas.geometry)
    AND ST_Area(ST_Intersection(NEW.geometry, lot_restricted_areas.geometry)) > 0
  ORDER BY lot_restricted_areas.name
  LIMIT 1;

  IF restricted_area.name IS NOT NULL THEN
    RAISE EXCEPTION 'Gravesite geometry overlaps prohibited lot area "%".', restricted_area.name
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gravesites_lot_burial_use_restrictions_check ON gravesites;
CREATE TRIGGER gravesites_lot_burial_use_restrictions_check
  BEFORE INSERT OR UPDATE OF lot_uuid, geometry, deleted_at ON gravesites
  FOR EACH ROW
  EXECUTE FUNCTION enforce_lot_burial_use_restrictions();

--rollback DROP TRIGGER IF EXISTS gravesites_lot_burial_use_restrictions_check ON gravesites;
--rollback DROP FUNCTION IF EXISTS enforce_lot_burial_use_restrictions();
