--liquibase formatted sql

--changeset cemeterymapping:490-back-descriptions-as-faces splitStatements:false rollbackSplitStatements:false
-- Preserve existing face IDs/metadata and never assign a field reading to NHG.
CREATE FUNCTION migrate_back_face(faces jsonb, front_text text, back_text text, front_id uuid, back_id uuid)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb:=COALESCE(faces,'[]'::jsonb); item jsonb; normalized jsonb:='[]'::jsonb; has_back boolean:=false;
BEGIN
 IF jsonb_array_length(result)=0 THEN
  result:=jsonb_build_array(jsonb_build_object('id',front_id::text,'label','Front','inscription',COALESCE(front_text,''),'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb));
 ELSIF jsonb_array_length(result)=1 AND lower(btrim(result->0->>'label'))='unspecified face' THEN
  result:=jsonb_set(result,'{0,label}','"Front"'::jsonb);
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(result) LOOP
  IF lower(btrim(item->>'label'))='back' THEN
   has_back:=true;
   IF COALESCE(item->>'inscription','')<>back_text
    AND right(COALESCE(item->>'inscription',''),length(E'\n\n'||back_text))<>E'\n\n'||back_text THEN
    item:=item||jsonb_build_object('inscription',CASE WHEN COALESCE(item->>'inscription','')='' THEN back_text ELSE (item->>'inscription')||E'\n\n'||back_text END,
      'inscriptionStatus','transcribed','currentLegibility','unknown');
   END IF;
  END IF;
  IF length(COALESCE(item->>'inscription',''))>20000 THEN RAISE EXCEPTION 'Back migration would exceed the face inscription limit'; END IF;
  normalized:=normalized||jsonb_build_array(item);
 END LOOP;
 IF NOT has_back THEN
  normalized:=normalized||jsonb_build_array(jsonb_build_object('id',back_id::text,'label','Back','inscription',back_text,
   'inscriptionStatus','transcribed','currentLegibility','unknown','historicalTranscriptions','[]'::jsonb,'notes','','burialIds','[]'::jsonb,'mediaAssetIds','[]'::jsonb));
 END IF;
 IF jsonb_array_length(normalized)>32 THEN RAISE EXCEPTION 'Back migration would exceed the 32-face limit'; END IF;
 RETURN normalized;
END $$;

CREATE FUNCTION back_migration_reading(faces jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN jsonb_array_length(faces)=1 THEN faces->0->>'inscription'
 ELSE string_agg((f->>'label')||E'\n'||COALESCE(f->>'inscription',''),E'\n\n' ORDER BY n)
 FILTER(WHERE COALESCE(f->>'inscription','') ~ '[^[:space:]]') END
 FROM jsonb_array_elements(faces) WITH ORDINALITY t(f,n)
$$;

-- The normal capture trigger would refresh visits and NHG during a structural
-- migration. Update only the matching field snapshot explicitly instead.
ALTER TABLE headstones DISABLE TRIGGER capture_monument_inspection;
DO $$
DECLARE marker record; visit record; front_id uuid; back_id uuid; migrated jsonb;
BEGIN
 FOR marker IN SELECT * FROM headstones WHERE btrim(COALESCE(back_description,''))<>'' LOOP
  front_id:=COALESCE((marker.faces->0->>'id')::uuid,gen_random_uuid());
  SELECT (f->>'id')::uuid INTO back_id FROM jsonb_array_elements(marker.faces) f WHERE lower(btrim(f->>'label'))='back' LIMIT 1;
  back_id:=COALESCE(back_id,gen_random_uuid());
  migrated:=migrate_back_face(marker.faces,marker.inscription,marker.back_description,front_id,back_id);
  UPDATE headstones SET faces=migrated,
   source_properties=COALESCE(source_properties,'{}'::jsonb)||jsonb_build_object('BackFaceMigration490',jsonb_build_object(
    'originalBackDescription',marker.back_description,'fieldDate',marker.last_inspected_at,'frontFaceId',front_id,'backFaceId',back_id)),
   updated_at=now() WHERE id=marker.id;
  FOR visit IN SELECT * FROM monument_inspections WHERE headstone_uuid=marker.id AND source_type='field_survey'
   AND inspected_at IS NOT DISTINCT FROM marker.last_inspected_at
   AND (marker.last_inspected_at IS NOT NULL OR origin_key='field:2026') LOOP
   migrated:=migrate_back_face(visit.faces,visit.inscription,marker.back_description,front_id,back_id);
   UPDATE monument_inspections SET faces=migrated,
    inscription=CASE WHEN visit.faces='[]'::jsonb OR visit.inscription IS NOT DISTINCT FROM back_migration_reading(visit.faces)
     THEN COALESCE(back_migration_reading(migrated),'') ELSE visit.inscription END,
    updated_at=now() WHERE id=visit.id;
  END LOOP;
 END LOOP;
END $$;
ALTER TABLE headstones ENABLE TRIGGER capture_monument_inspection;
DROP FUNCTION migrate_back_face(jsonb,text,text,uuid,uuid);
DROP FUNCTION back_migration_reading(jsonb);
ALTER TABLE headstones DROP COLUMN back_description;

-- Restore the retired column for older schemas. Face/readings remain preserved;
-- operational recovery should use a reviewed forward correction.
--rollback ALTER TABLE headstones ADD COLUMN back_description text;
--rollback UPDATE headstones SET back_description=source_properties->'BackFaceMigration490'->>'originalBackDescription' WHERE source_properties->'BackFaceMigration490' IS NOT NULL;
