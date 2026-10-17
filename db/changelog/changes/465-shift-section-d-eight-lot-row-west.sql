--liquibase formatted sql

--changeset cemeterymapping:465-shift-section-d-eight-lot-row-west splitStatements:false
DO $$
DECLARE
  anchor lots%ROWTYPE;
  west_shift double precision;
  row_count integer;
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='D'
    AND lot_id='37' AND block_id IS NULL AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*) INTO row_count FROM lots WHERE cemetery_id=anchor.cemetery_id
    AND section_id='D' AND block_id IS NULL AND deleted_at IS NULL
    AND lot_id IN ('28','29','37','48','57','TMP01','TMP02','TMP03');
  IF row_count<>8 THEN
    RAISE EXCEPTION 'Migration prerequisite failed: expected all eight new Section D lots';
  END IF;

  -- One shared longitude offset keeps shared edges and latitudes unchanged.
  west_shift := ST_X(ST_Project(ST_Centroid(anchor.geometry)::geography,
    1*0.3048,3*pi()/2)::geometry)-ST_X(ST_Centroid(anchor.geometry));
  IF EXISTS (
    SELECT 1 FROM lots moving JOIN lots existing
      ON existing.cemetery_id=moving.cemetery_id AND existing.deleted_at IS NULL
      AND (existing.section_id='D' AND existing.block_id IS NULL
        AND existing.lot_id IN ('28','29','37','48','57','TMP01','TMP02','TMP03')) IS NOT TRUE
      AND ST_Intersects(existing.geometry,ST_Translate(moving.geometry,west_shift,0))
    WHERE moving.cemetery_id=anchor.cemetery_id AND moving.section_id='D'
      AND moving.block_id IS NULL AND moving.deleted_at IS NULL
      AND moving.lot_id IN ('28','29','37','48','57','TMP01','TMP02','TMP03')
      AND ST_Area(ST_Intersection(existing.geometry,ST_Translate(moving.geometry,west_shift,0))::geography)>0.001
  ) THEN
    RAISE EXCEPTION 'Migration prerequisite failed: shifted row overlaps existing lots';
  END IF;

  UPDATE lots SET geometry=ST_Translate(geometry,west_shift,0),updated_at=now(),
    geometry_notes=geometry_notes||' Entire row subsequently shifted one foot west; north-south position unchanged.'
  WHERE cemetery_id=anchor.cemetery_id AND section_id='D' AND block_id IS NULL
    AND deleted_at IS NULL AND lot_id IN ('28','29','37','48','57','TMP01','TMP02','TMP03');
END $$;

-- Recovery uses the pre-migration backup; preserve the owner-directed layout.
--rollback empty
