--liquibase formatted sql

--changeset cemeterymapping:511-sql-query-efficiency splitStatements:false rollbackSplitStatements:false
CREATE OR REPLACE FUNCTION public.refresh_nhg_inspection(marker_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE descriptors text; reading text; evidence jsonb; condition_code text; condition_id uuid; marker headstones%ROWTYPE;
BEGIN
 SELECT * INTO marker FROM headstones WHERE id=marker_id AND deleted_at IS NULL;
 IF NOT FOUND THEN RETURN; END IF;
 SELECT string_agg(DISTINCT COALESCE(NULLIF(e.source_entry->>'descriptor',''),split_part(e.raw_text,'"',1)), E'\n'),
  string_agg(DISTINCT NULLIF(e.inscription_text,''), E'\n\n'),
  jsonb_agg(DISTINCT jsonb_build_object('entryId',e.id,'page',e.source_page_number,'rawText',e.raw_text))
 INTO descriptors,reading,evidence
 FROM north_hills_ocr_entry_headstone_links l JOIN north_hills_ocr_entries e ON e.id=l.entry_id
 WHERE l.headstone_uuid=marker_id AND l.status='linked';

 IF reading IS NULL THEN
  SELECT string_agg(DISTINCT h->>'text',E'\n\n') INTO reading
  FROM jsonb_array_elements(marker.historical_transcriptions) h
  WHERE h->>'source' ~* '(\mNHG\M|North Hills Genealogists)';
 END IF;
 IF evidence IS NULL AND reading IS NULL AND COALESCE(marker.source_properties->'NormalizedProvenance'->>'nhgInclusion','')<>'listed' THEN
  DELETE FROM monument_inspections WHERE headstone_uuid=marker_id AND origin_key='nhg' AND NOT manually_edited;
  RETURN;
 END IF;

 SELECT CASE WHEN count(DISTINCT mapped)=1 THEN min(mapped) ELSE 'unknown' END INTO condition_code
 FROM (SELECT CASE lower(m[1]) WHEN 'exc' THEN 'excellent' ELSE lower(m[1]) END AS mapped
 FROM regexp_matches(COALESCE(descriptors,''),'\m(exc|excellent|good|fair|poor|damaged|unknown)\s+cond(?:ition)?\M','gi') m) codes;
 SELECT id INTO condition_id FROM headstone_condition_types WHERE code=condition_code;
 INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,source_entries,origin_key)
 VALUES(marker_id,'2005-10-11',2005,'nhg','North Hills Genealogists (NHG)',condition_id,
 COALESCE(descriptors,'NHG inclusion recorded; no confirmed source descriptor linked.'),COALESCE(reading,''),COALESCE(evidence,'[]'::jsonb),'nhg')
 ON CONFLICT(headstone_uuid,origin_key) DO UPDATE SET condition_type_id=EXCLUDED.condition_type_id,
 condition_notes=EXCLUDED.condition_notes,inscription=EXCLUDED.inscription,source_entries=EXCLUDED.source_entries,updated_at=now() WHERE NOT monument_inspections.manually_edited
 AND (monument_inspections.condition_type_id,monument_inspections.condition_notes,monument_inspections.inscription,monument_inspections.source_entries)
 IS DISTINCT FROM (EXCLUDED.condition_type_id,EXCLUDED.condition_notes,EXCLUDED.inscription,EXCLUDED.source_entries);
END $function$
;
CREATE OR REPLACE FUNCTION public.capture_monument_inspection()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
 IF TG_OP='INSERT' OR (NEW.last_inspected_at,NEW.condition_type_id,NEW.condition_notes,NEW.inscription,NEW.faces)
 IS DISTINCT FROM (OLD.last_inspected_at,OLD.condition_type_id,OLD.condition_notes,OLD.inscription,OLD.faces) THEN
 INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,faces,origin_key)
 VALUES(NEW.id,NEW.last_inspected_at,COALESCE(extract(year FROM NEW.last_inspected_at)::integer,extract(year FROM current_date)::integer),
 'field_survey','Cemetery administrator field inspection',NEW.condition_type_id,COALESCE(NEW.condition_notes,''),COALESCE(NEW.inscription,''),NEW.faces,
 'field:'||COALESCE(NEW.last_inspected_at::text,extract(year FROM current_date)::text))
 ON CONFLICT(headstone_uuid,origin_key) DO UPDATE SET condition_type_id=EXCLUDED.condition_type_id,condition_notes=EXCLUDED.condition_notes,
 inscription=EXCLUDED.inscription,faces=EXCLUDED.faces,updated_at=now() WHERE NOT monument_inspections.manually_edited
 AND (monument_inspections.condition_type_id,monument_inspections.condition_notes,monument_inspections.inscription,monument_inspections.faces)
 IS DISTINCT FROM (EXCLUDED.condition_type_id,EXCLUDED.condition_notes,EXCLUDED.inscription,EXCLUDED.faces);
 END IF;
 IF TG_OP='INSERT' OR (NEW.source_properties #> '{NormalizedProvenance,nhgInclusion}',NEW.historical_transcriptions)
 IS DISTINCT FROM (OLD.source_properties #> '{NormalizedProvenance,nhgInclusion}',OLD.historical_transcriptions) THEN
  PERFORM refresh_nhg_inspection(NEW.id);
 END IF;
 RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.refresh_linked_nhg_inspection()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.headstone_uuid,OLD.entry_id,OLD.status)
 IS NOT DISTINCT FROM (NEW.headstone_uuid,NEW.entry_id,NEW.status) THEN RETURN NULL; END IF;
 IF TG_OP<>'INSERT' AND (TG_OP='DELETE' OR OLD.headstone_uuid IS DISTINCT FROM NEW.headstone_uuid) THEN PERFORM refresh_nhg_inspection(OLD.headstone_uuid); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM refresh_nhg_inspection(NEW.headstone_uuid); END IF;
 RETURN NULL;
END $function$
;
CREATE OR REPLACE FUNCTION public.refresh_repaired_nhg_inspections()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE marker_id uuid;
BEGIN
 IF (NEW.raw_text,NEW.source_entry,NEW.inscription_text) IS NOT DISTINCT FROM
 (OLD.raw_text,OLD.source_entry,OLD.inscription_text) THEN RETURN NEW; END IF;
 FOR marker_id IN SELECT DISTINCT headstone_uuid FROM north_hills_ocr_entry_headstone_links WHERE entry_id=NEW.id AND status='linked' LOOP
  PERFORM refresh_nhg_inspection(marker_id);
 END LOOP;
 RETURN NEW;
END $function$
;
-- Keep the equivalent unique indexes and their constraints.
DROP INDEX blocks_facility_idx;
DROP INDEX deed_registry_entries_batch_source_row_number_idx;
DROP INDEX gravesites_cemetery_gravesite_idx;
DROP INDEX gravesites_facility_idx;
DROP INDEX lots_facility_idx;
-- Match normalizedSearchSql exactly; lower-only report indexes remain useful.
CREATE INDEX headstones_normalized_search_trgm_idx ON headstones USING gin (lower(regexp_replace(normalize(coalesce(headstone_id, ''), NFD), '[̀-ͯ]', '', 'g')) gin_trgm_ops) WHERE deleted_at IS NULL;

CREATE INDEX app_users_lower_email_idx ON app_users (lower(email));

--rollback CREATE OR REPLACE FUNCTION public.refresh_nhg_inspection(marker_id uuid)
--rollback  RETURNS void
--rollback  LANGUAGE plpgsql
--rollback AS $function$
--rollback DECLARE descriptors text; reading text; evidence jsonb; condition_code text; condition_id uuid; marker headstones%ROWTYPE;
--rollback BEGIN
--rollback  SELECT * INTO marker FROM headstones WHERE id=marker_id AND deleted_at IS NULL;
--rollback  IF NOT FOUND THEN RETURN; END IF;
--rollback  SELECT string_agg(DISTINCT COALESCE(NULLIF(e.source_entry->>'descriptor',''),split_part(e.raw_text,'"',1)), E'\n'),
--rollback   string_agg(DISTINCT NULLIF(e.inscription_text,''), E'\n\n'),
--rollback   jsonb_agg(DISTINCT jsonb_build_object('entryId',e.id,'page',e.source_page_number,'rawText',e.raw_text))
--rollback  INTO descriptors,reading,evidence
--rollback  FROM north_hills_ocr_entry_headstone_links l JOIN north_hills_ocr_entries e ON e.id=l.entry_id
--rollback  WHERE l.headstone_uuid=marker_id AND l.status='linked';
--rollback
--rollback  IF reading IS NULL THEN
--rollback   SELECT string_agg(DISTINCT h->>'text',E'\n\n') INTO reading
--rollback   FROM jsonb_array_elements(marker.historical_transcriptions) h
--rollback   WHERE h->>'source' ~* '(\mNHG\M|North Hills Genealogists)';
--rollback  END IF;
--rollback  IF evidence IS NULL AND reading IS NULL AND COALESCE(marker.source_properties->'NormalizedProvenance'->>'nhgInclusion','')<>'listed' THEN
--rollback   DELETE FROM monument_inspections WHERE headstone_uuid=marker_id AND origin_key='nhg' AND NOT manually_edited;
--rollback   RETURN;
--rollback  END IF;
--rollback
--rollback  SELECT CASE WHEN count(DISTINCT mapped)=1 THEN min(mapped) ELSE 'unknown' END INTO condition_code
--rollback  FROM (SELECT CASE lower(m[1]) WHEN 'exc' THEN 'excellent' ELSE lower(m[1]) END AS mapped
--rollback  FROM regexp_matches(COALESCE(descriptors,''),'\m(exc|excellent|good|fair|poor|damaged|unknown)\s+cond(?:ition)?\M','gi') m) codes;
--rollback  SELECT id INTO condition_id FROM headstone_condition_types WHERE code=condition_code;
--rollback  INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,source_entries,origin_key)
--rollback  VALUES(marker_id,'2005-10-11',2005,'nhg','North Hills Genealogists (NHG)',condition_id,
--rollback  COALESCE(descriptors,'NHG inclusion recorded; no confirmed source descriptor linked.'),COALESCE(reading,''),COALESCE(evidence,'[]'::jsonb),'nhg')
--rollback  ON CONFLICT(headstone_uuid,origin_key) DO UPDATE SET condition_type_id=EXCLUDED.condition_type_id,
--rollback  condition_notes=EXCLUDED.condition_notes,inscription=EXCLUDED.inscription,source_entries=EXCLUDED.source_entries,updated_at=now() WHERE NOT monument_inspections.manually_edited;
--rollback END $function$
--rollback ;
--rollback CREATE OR REPLACE FUNCTION public.capture_monument_inspection()
--rollback  RETURNS trigger
--rollback  LANGUAGE plpgsql
--rollback AS $function$
--rollback BEGIN
--rollback  IF TG_OP='INSERT' OR (NEW.last_inspected_at,NEW.condition_type_id,NEW.condition_notes,NEW.inscription,NEW.faces)
--rollback  IS DISTINCT FROM (OLD.last_inspected_at,OLD.condition_type_id,OLD.condition_notes,OLD.inscription,OLD.faces) THEN
--rollback  INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,faces,origin_key)
--rollback  VALUES(NEW.id,NEW.last_inspected_at,COALESCE(extract(year FROM NEW.last_inspected_at)::integer,extract(year FROM current_date)::integer),
--rollback  'field_survey','Cemetery administrator field inspection',NEW.condition_type_id,COALESCE(NEW.condition_notes,''),COALESCE(NEW.inscription,''),NEW.faces,
--rollback  'field:'||COALESCE(NEW.last_inspected_at::text,extract(year FROM current_date)::text))
--rollback  ON CONFLICT(headstone_uuid,origin_key) DO UPDATE SET condition_type_id=EXCLUDED.condition_type_id,condition_notes=EXCLUDED.condition_notes,
--rollback  inscription=EXCLUDED.inscription,faces=EXCLUDED.faces,updated_at=now() WHERE NOT monument_inspections.manually_edited;
--rollback  END IF;
--rollback  PERFORM refresh_nhg_inspection(NEW.id);
--rollback  RETURN NEW;
--rollback END $function$
--rollback ;
--rollback CREATE OR REPLACE FUNCTION public.refresh_linked_nhg_inspection()
--rollback  RETURNS trigger
--rollback  LANGUAGE plpgsql
--rollback AS $function$
--rollback BEGIN
--rollback  IF TG_OP<>'INSERT' THEN PERFORM refresh_nhg_inspection(OLD.headstone_uuid); END IF;
--rollback  IF TG_OP<>'DELETE' THEN PERFORM refresh_nhg_inspection(NEW.headstone_uuid); END IF;
--rollback  RETURN NULL;
--rollback END $function$
--rollback ;
--rollback CREATE OR REPLACE FUNCTION public.refresh_repaired_nhg_inspections()
--rollback  RETURNS trigger
--rollback  LANGUAGE plpgsql
--rollback AS $function$
--rollback DECLARE marker_id uuid;
--rollback BEGIN
--rollback  FOR marker_id IN SELECT DISTINCT headstone_uuid FROM north_hills_ocr_entry_headstone_links WHERE entry_id=NEW.id AND status='linked' LOOP
--rollback   PERFORM refresh_nhg_inspection(marker_id);
--rollback  END LOOP;
--rollback  RETURN NEW;
--rollback END $function$
--rollback ;
--rollback CREATE INDEX blocks_facility_idx ON public.blocks USING btree (facility_id, section_id, block_id);
--rollback CREATE INDEX deed_registry_entries_batch_source_row_number_idx ON public.deed_registry_entries USING btree (batch_id, source_row_number);
--rollback CREATE INDEX gravesites_cemetery_gravesite_idx ON public.gravesites USING btree (cemetery_id, gravesite_id);
--rollback CREATE INDEX gravesites_facility_idx ON public.gravesites USING btree (facility_id, section_id, block_id, lot_id, grave_id);
--rollback CREATE INDEX lots_facility_idx ON public.lots USING btree (facility_id, section_id, block_id, lot_id);
--rollback DROP INDEX headstones_normalized_search_trgm_idx;
--rollback DROP INDEX app_users_lower_email_idx;
