--liquibase formatted sql

--changeset cemeterymapping:462-create-section-d-north-lot-row splitStatements:false
DO $$
DECLARE
  anchor lots%ROWTYPE;
  destination uuid;
  north_shift double precision;
  source_count integer;
BEGIN
  SELECT * INTO anchor FROM lots WHERE facility_id='1' AND section_id='C'
    AND lot_id='39A' AND block_id IS NULL AND deleted_at IS NULL;
  -- Imported survey lots are absent in clean installations.
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO source_count FROM lots WHERE cemetery_id=anchor.cemetery_id
    AND section_id='C' AND block_id IS NULL AND deleted_at IS NULL
    AND lot_id IN ('39A','46A','59','66','69','76A');
  IF source_count <> 6 THEN
    RAISE EXCEPTION 'Migration prerequisite failed: expected six Section C reference lots';
  END IF;
  SELECT section_id INTO STRICT destination FROM sections
    WHERE cemetery_id=anchor.cemetery_id AND name='D' AND deleted_at IS NULL;
  IF EXISTS (SELECT 1 FROM lots WHERE facility_id=anchor.facility_id AND section_id='D'
      AND block_id IS NULL AND lot_id IN ('38','47','58','67','68','77')) THEN
    RAISE EXCEPTION 'Migration prerequisite failed: destination lot numbers already exist';
  END IF;

  north_shift := ST_Y(ST_Project(
    ST_SetSRID(ST_MakePoint(ST_XMax(anchor.geometry),ST_YMax(anchor.geometry)),4326)::geography,
    11*0.3048,0)::geometry)-ST_YMin(anchor.geometry);

  IF EXISTS (
    SELECT 1 FROM lots source JOIN lots existing
      ON existing.cemetery_id=source.cemetery_id AND existing.deleted_at IS NULL
      AND ST_Intersects(existing.geometry,ST_Translate(source.geometry,0,north_shift))
    WHERE source.cemetery_id=anchor.cemetery_id AND source.section_id='C'
      AND source.block_id IS NULL AND source.deleted_at IS NULL
      AND source.lot_id IN ('39A','46A','59','66','69','76A')
      AND ST_Area(ST_Intersection(existing.geometry,ST_Translate(source.geometry,0,north_shift))::geography)>0.001
  ) THEN
    RAISE EXCEPTION 'Migration prerequisite failed: new row overlaps existing lots';
  END IF;

  INSERT INTO lots(cemetery_id,section_uuid,name,facility_id,section_id,block_id,lot_id,
    width_feet,length_feet,geometry,geometry_type,geometry_source,geometry_confidence,geometry_notes)
  SELECT source.cemetery_id,destination,'D-'||mapping.target,source.facility_id,'D',NULL,mapping.target,
    source.width_feet,source.length_feet,ST_Translate(source.geometry,0,north_shift),
    'operational','Section C reference row translated north; requested Section D extension.',
    'estimated','Matches C-'||source.lot_id||' shape. Southern border 11 feet north of the reference row northern border; eastern edge aligned with C-39A. No field survey.'
  FROM lots source JOIN (VALUES ('39A','38'),('46A','47'),('59','58'),
    ('66','67'),('69','68'),('76A','77')) mapping(reference,target)
    ON source.lot_id=mapping.reference
  WHERE source.cemetery_id=anchor.cemetery_id AND source.section_id='C'
    AND source.block_id IS NULL AND source.deleted_at IS NULL;
END $$;
