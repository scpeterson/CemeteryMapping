--liquibase formatted sql

--changeset cemeterymapping:502-passageway-area-type splitStatements:false
ALTER TABLE lots ADD COLUMN area_type text NOT NULL DEFAULT 'lot'
  CHECK (area_type IN ('lot','passageway'));
ALTER TABLE lots ADD COLUMN location_references jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(location_references)='array');
COMMENT ON COLUMN lots.area_type IS 'Lots and passageways share map and assignment behavior; passageways allow only individual gravesite rights.';

CREATE OR REPLACE FUNCTION enforce_passageway_ownership()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND NEW.lot_uuid IS NOT NULL THEN
    -- Serialize with area-type changes and refuse every whole-area right,
    -- including releases, rather than representing a corridor as owned land.
    PERFORM 1 FROM lots WHERE id=NEW.lot_uuid FOR UPDATE;
    IF EXISTS(SELECT 1 FROM lots WHERE id=NEW.lot_uuid AND area_type='passageway') THEN
      RAISE EXCEPTION 'A passageway cannot have whole-area ownership. Assign the deed to individual gravesites in the passageway.' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER ownership_rights_no_passageway BEFORE INSERT OR UPDATE ON ownership_event_rights
  FOR EACH ROW EXECUTE FUNCTION enforce_passageway_ownership();
CREATE TRIGGER legacy_ownership_no_passageway BEFORE INSERT OR UPDATE ON lot_ownership_events
  FOR EACH ROW EXECUTE FUNCTION enforce_passageway_ownership();

CREATE FUNCTION enforce_passageway_conversion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.area_type='passageway' AND OLD.area_type IS DISTINCT FROM NEW.area_type
    AND (EXISTS(SELECT 1 FROM ownership_event_rights WHERE lot_uuid=NEW.id AND deleted_at IS NULL)
      OR EXISTS(SELECT 1 FROM lot_ownership_events WHERE lot_uuid=NEW.id AND deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'Resolve existing whole-lot rights before converting a lot to a passageway.' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lots_passageway_conversion BEFORE UPDATE OF area_type ON lots
  FOR EACH ROW EXECUTE FUNCTION enforce_passageway_conversion();

CREATE OR REPLACE FUNCTION enforce_lot_gravesite_limit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lot_uuid IS NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  PERFORM 1 FROM lots WHERE id=NEW.lot_uuid FOR UPDATE;
  -- A passageway is a corridor, not a five-space lot. Capacity is determined
  -- by reviewed individual gravesites; this does not grant burial rights.
  IF EXISTS(SELECT 1 FROM lots WHERE id=NEW.lot_uuid AND area_type='passageway') THEN RETURN NEW; END IF;
  IF (SELECT count(*) FROM gravesites existing WHERE existing.lot_uuid=NEW.lot_uuid
    AND existing.deleted_at IS NULL AND existing.id IS DISTINCT FROM NEW.id)>=5 THEN
    RAISE EXCEPTION 'Lot % cannot contain more than five active gravesites.',NEW.lot_uuid USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- Recovery uses a backup or a reviewed forward correction to preserve assigned passageways.
--rollback empty
