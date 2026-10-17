--liquibase formatted sql

--changeset cemeterymapping:437-split-d-0453-brandt-gravesites splitStatements:false
DO $$
DECLARE
  source gravesites%ROWTYPE;
  marker headstones%ROWTYPE;
  combined burials%ROWTYPE;
  north_west geometry;
  south_west geometry;
  north_east geometry;
  south_east geometry;
  new_geometry geometry;
  new_grave_id uuid;
  elizabeth_id uuid;
  n integer;
BEGIN
  SELECT * INTO source FROM gravesites
    WHERE gravesite_id='TLC-GPS-0453' AND section_id='D' AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;
  PERFORM assert_migration_prerequisite(source.geometry IS NOT NULL, 'D-0453 must have geometry');
  SELECT * INTO marker FROM headstones
    WHERE headstone_id='TLC-HS-0453' AND gravesite_uuid=source.id AND deleted_at IS NULL;
  PERFORM assert_migration_prerequisite(FOUND AND marker.geometry IS NOT NULL,
    'TLC-HS-0453 must remain linked to D-0453 with geometry');
  SELECT b.* INTO combined FROM burials b JOIN headstone_burials hb ON hb.burial_uuid=b.id
    WHERE hb.headstone_uuid=marker.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.gravesite_uuid=source.id AND b.full_name='Regina, Elizabeth Brandt';
  PERFORM assert_migration_prerequisite(FOUND AND (
    SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid=b.id
    WHERE hb.headstone_uuid=marker.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.gravesite_uuid=source.id AND b.full_name='Regina, Elizabeth Brandt')=1,
    'exactly one combined Regina, Elizabeth Brandt burial must belong to this marker and grave');
  PERFORM assert_migration_prerequisite((
    SELECT count(*) FROM burials b JOIN headstone_burials hb ON hb.burial_uuid=b.id
    WHERE hb.headstone_uuid=marker.id AND hb.deleted_at IS NULL AND b.deleted_at IS NULL
      AND b.gravesite_uuid=source.id AND b.full_name='Philip Brandt')=1,
    'exactly one Philip Brandt burial must remain in D-0453');
  PERFORM assert_migration_prerequisite(NOT EXISTS (
    SELECT 1 FROM gravesites WHERE cemetery_id=source.cemetery_id
      AND (gravesite_id IN ('TLC-GPS-0453-01','TLC-GPS-0453-02')
        OR (section_id='D' AND grave_id IN ('0453A','0453B')))),
    'new D-0453A and D-0453B identifiers must be unused');

  -- Keep D-0453 and the surveyed marker fixed. New graves extend eastward
  -- from its northwestern corner, each four feet farther north.
  south_west := ST_SetSRID(ST_MakePoint(ST_XMin(source.geometry),ST_YMax(source.geometry)),4326);
  FOR n IN 1..2 LOOP
    north_west := ST_Project(south_west::geography,4*0.3048,0)::geometry;
    south_east := ST_Project(south_west::geography,10*0.3048,pi()/2)::geometry;
    north_east := ST_Project(north_west::geography,10*0.3048,pi()/2)::geometry;
    new_geometry := ST_Multi(ST_MakePolygon(ST_MakeLine(ARRAY[
      south_west,south_east,north_east,north_west,south_west])));
    PERFORM assert_migration_prerequisite(ST_IsValid(new_geometry) AND NOT EXISTS (
      SELECT 1 FROM gravesites g WHERE g.cemetery_id=source.cemetery_id AND g.deleted_at IS NULL
        AND g.geometry IS NOT NULL AND ST_Intersects(g.geometry,new_geometry)
        AND ST_Area(ST_Intersection(g.geometry,new_geometry)::geography)>0.001),
      'new Brandt graves must not overlap existing active graves');
    new_grave_id := gen_random_uuid();
    INSERT INTO gravesites SELECT (jsonb_populate_record(NULL::gravesites,to_jsonb(source)||jsonb_build_object(
      'id',new_grave_id,'name',CASE n WHEN 1 THEN 'Regina Brandt' ELSE 'Elizabeth Brandt' END,
      'grave_id',CASE n WHEN 1 THEN '0453A' ELSE '0453B' END,
      'gravesite_id',CASE n WHEN 1 THEN 'TLC-GPS-0453-01' ELSE 'TLC-GPS-0453-02' END,
      'geometry',ST_AsEWKT(new_geometry),'width_feet',4,'length_feet',10,
      'geometry_type','operational','geometry_confidence','estimated',
      'geometry_source','Migration 437: user-directed 4-by-10-foot graves north of unchanged D-0453.',
      'geometry_notes','Estimated placement authorized 2026-10-09; original grave and TLC-HS-0453 remain fixed. Field survey may refine this placement.',
      'created_at',now(),'updated_at',now()))).*;
    INSERT INTO headstone_gravesites(headstone_uuid,gravesite_uuid,relationship_type)
      VALUES(marker.id,new_grave_id,'spans');
    IF n=1 THEN
      UPDATE burials SET first_name='Regina',full_name='Regina Brandt',
        gravesite_uuid=new_grave_id,gravesite_id='TLC-GPS-0453-01',
        birth_date=DATE '1818-08-29',birth_date_text='1818-08-29',
        death_date=DATE '1901-06-14',death_date_text='1901-06-14',
        source_properties=COALESCE(source_properties,'{}'::jsonb)||jsonb_build_object(
          'Brandt0453Split',jsonb_build_object('originalCombinedBurial',to_jsonb(combined),
            'dateSource','TLC-HS-0453 front inscription','reviewedAt','2026-10-09')),
        notes=concat_ws(' ',NULLIF(notes,''),'Combined Regina/Elizabeth record split on 2026-10-09; dates transcribed from TLC-HS-0453.'),
        updated_at=now() WHERE id=combined.id;
    ELSE
      elizabeth_id := gen_random_uuid();
      INSERT INTO burials SELECT (jsonb_populate_record(NULL::burials,to_jsonb(combined)||jsonb_build_object(
        'id',elizabeth_id,'first_name','Elizabeth','full_name','Elizabeth Brandt',
        'gravesite_uuid',new_grave_id,'gravesite_id','TLC-GPS-0453-02',
        'birth_date','1850-03-02','birth_date_text','1850-03-02',
        'death_date','1927-10-17','death_date_text','1927-10-17',
        'source_properties',COALESCE(combined.source_properties,'{}'::jsonb)||jsonb_build_object(
          'Brandt0453Split',jsonb_build_object('originalCombinedBurialId',combined.id,
            'dateSource','TLC-HS-0453 right inscription','reviewedAt','2026-10-09')),
        'notes',concat_ws(' ',NULLIF(combined.notes,''),'Combined Regina/Elizabeth record split on 2026-10-09; dates transcribed from TLC-HS-0453.'),
        'created_at',now(),'updated_at',now()))).*;
      INSERT INTO headstone_burials(headstone_uuid,burial_uuid) VALUES(marker.id,elizabeth_id);
    END IF;
    south_west := north_west;
  END LOOP;
END $$;

-- Preserve the correction and evidence; restore from the pre-release backup if needed.
--rollback empty
