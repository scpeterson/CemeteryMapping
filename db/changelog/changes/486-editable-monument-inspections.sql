--liquibase formatted sql

--changeset cemeterymapping:486-editable-monument-inspections splitStatements:false
ALTER TABLE monument_inspections ADD COLUMN manually_edited boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION refresh_nhg_inspection(marker_id uuid) RETURNS void LANGUAGE plpgsql AS $$
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
 -- Administrator-attributed NHG readings also count, even without a valid OCR link.
 IF reading IS NULL THEN
  SELECT string_agg(DISTINCT h->>'text',E'\n\n') INTO reading
  FROM jsonb_array_elements(marker.historical_transcriptions) h
  WHERE h->>'source' ~* '(\mNHG\M|North Hills Genealogists)';
 END IF;
 IF evidence IS NULL AND reading IS NULL AND COALESCE(marker.source_properties->'NormalizedProvenance'->>'nhgInclusion','')<>'listed' THEN
  DELETE FROM monument_inspections WHERE headstone_uuid=marker_id AND origin_key='nhg' AND NOT manually_edited;
  RETURN;
 END IF;
 -- Conflicting source conditions are unknown until reviewed; never copy the field condition.
 SELECT CASE WHEN count(DISTINCT mapped)=1 THEN min(mapped) ELSE 'unknown' END INTO condition_code
 FROM (SELECT CASE lower(m[1]) WHEN 'exc' THEN 'excellent' ELSE lower(m[1]) END AS mapped
 FROM regexp_matches(COALESCE(descriptors,''),'\m(exc|excellent|good|fair|poor|damaged|unknown)\s+cond(?:ition)?\M','gi') m) codes;
 SELECT id INTO condition_id FROM headstone_condition_types WHERE code=condition_code;
 INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,source_entries,origin_key)
 VALUES(marker_id,'2005-10-11',2005,'nhg','North Hills Genealogists (NHG)',condition_id,
 COALESCE(descriptors,'NHG inclusion recorded; no confirmed source descriptor linked.'),COALESCE(reading,''),COALESCE(evidence,'[]'::jsonb),'nhg')
 ON CONFLICT(headstone_uuid,origin_key) DO UPDATE SET condition_type_id=EXCLUDED.condition_type_id,
 condition_notes=EXCLUDED.condition_notes,inscription=EXCLUDED.inscription,source_entries=EXCLUDED.source_entries,updated_at=now() WHERE NOT monument_inspections.manually_edited;
END $$;

CREATE OR REPLACE FUNCTION capture_monument_inspection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR (NEW.last_inspected_at,NEW.condition_type_id,NEW.condition_notes,NEW.inscription,NEW.faces)
 IS DISTINCT FROM (OLD.last_inspected_at,OLD.condition_type_id,OLD.condition_notes,OLD.inscription,OLD.faces) THEN
 INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,faces,origin_key)
 VALUES(NEW.id,NEW.last_inspected_at,COALESCE(extract(year FROM NEW.last_inspected_at)::integer,extract(year FROM current_date)::integer),
 'field_survey','Cemetery administrator field inspection',NEW.condition_type_id,COALESCE(NEW.condition_notes,''),COALESCE(NEW.inscription,''),NEW.faces,
 'field:'||COALESCE(NEW.last_inspected_at::text,extract(year FROM current_date)::text))
 ON CONFLICT(headstone_uuid,origin_key) DO UPDATE SET condition_type_id=EXCLUDED.condition_type_id,condition_notes=EXCLUDED.condition_notes,
 inscription=EXCLUDED.inscription,faces=EXCLUDED.faces,updated_at=now() WHERE NOT monument_inspections.manually_edited;
 END IF;
 PERFORM refresh_nhg_inspection(NEW.id);
 RETURN NEW;
END $$;

-- Preserve inspection history and corrections; use a forward migration for recovery.
--rollback empty
