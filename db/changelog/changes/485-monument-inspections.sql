--liquibase formatted sql

--changeset cemeterymapping:485-monument-inspections splitStatements:false
--validCheckSum 9:80e840954817aa20f23a6eea565e034b
-- Original a61d2f9 has identical forward SQL; only rollback instructions changed.
CREATE TABLE monument_inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 headstone_uuid uuid NOT NULL REFERENCES headstones(id),
 inspected_at date,
 inspection_year integer NOT NULL CHECK (inspection_year BETWEEN 1 AND 9999),
 source_type text NOT NULL CHECK(source_type IN ('nhg','field_survey','historical')),
 source text NOT NULL CHECK(btrim(source)<>''),
 condition_type_id uuid NOT NULL REFERENCES headstone_condition_types(id),
 condition_notes text NOT NULL DEFAULT '',
 inscription text NOT NULL DEFAULT '',
 faces jsonb NOT NULL DEFAULT '[]'::jsonb,
 source_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
 origin_key text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(headstone_uuid,origin_key),
 CHECK(inspected_at IS NULL OR extract(year FROM inspected_at)=inspection_year),
 CHECK(source_type<>'nhg' OR (inspected_at IS NOT NULL AND inspected_at=DATE '2005-10-11'))
);
CREATE INDEX monument_inspections_marker_date_idx ON monument_inspections(headstone_uuid,inspection_year DESC,inspected_at DESC);
CREATE TRIGGER audit_monument_inspections_changes AFTER INSERT OR UPDATE OR DELETE ON monument_inspections
 FOR EACH ROW EXECUTE FUNCTION audit_record_change('id');

-- Keep the existing field assessment as its own observation. The administrator
-- identifies these as 2026 inspections; preserve missing day/month as year-only.
INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,faces,origin_key)
SELECT id,last_inspected_at,COALESCE(extract(year FROM last_inspected_at)::integer,2026),'field_survey',
 'Cemetery administrator field inspection',condition_type_id,COALESCE(condition_notes,''),COALESCE(inscription,''),faces,
 'field:'||COALESCE(last_inspected_at::text,'2026') FROM headstones WHERE deleted_at IS NULL;

CREATE FUNCTION refresh_nhg_inspection(marker_id uuid) RETURNS void LANGUAGE plpgsql AS $$
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
  DELETE FROM monument_inspections WHERE headstone_uuid=marker_id AND origin_key='nhg';
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
 condition_notes=EXCLUDED.condition_notes,inscription=EXCLUDED.inscription,source_entries=EXCLUDED.source_entries,updated_at=now();
END $$;
SELECT refresh_nhg_inspection(id) FROM headstones WHERE deleted_at IS NULL;

-- A reviewed forward correction supplies the exact date for old NHG transcriptions.
-- Preserve their IDs, text, attribution and face associations.
ALTER TABLE headstones DISABLE TRIGGER sync_headstone_faces;
UPDATE headstones SET historical_transcriptions=COALESCE((SELECT jsonb_agg(CASE
 WHEN h->>'source' ~* '(\mNHG\M|North Hills Genealogists)' THEN h||jsonb_build_object('sourceDate','2005-10-11') ELSE h END)
 FROM jsonb_array_elements(historical_transcriptions) h),'[]'::jsonb),
 faces=COALESCE((SELECT jsonb_agg(f||jsonb_build_object('historicalTranscriptions',COALESCE((SELECT jsonb_agg(CASE
 WHEN h->>'source' ~* '(\mNHG\M|North Hills Genealogists)' THEN h||jsonb_build_object('sourceDate','2005-10-11') ELSE h END)
 FROM jsonb_array_elements(COALESCE(f->'historicalTranscriptions','[]'::jsonb)) h),'[]'::jsonb)))
 FROM jsonb_array_elements(faces) f),'[]'::jsonb),faces_revision=faces_revision+1
 WHERE historical_transcriptions::text ~* '(NHG|North Hills Genealogists)';
ALTER TABLE headstones ENABLE TRIGGER sync_headstone_faces;

CREATE FUNCTION capture_monument_inspection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR (NEW.last_inspected_at,NEW.condition_type_id,NEW.condition_notes,NEW.inscription,NEW.faces)
 IS DISTINCT FROM (OLD.last_inspected_at,OLD.condition_type_id,OLD.condition_notes,OLD.inscription,OLD.faces) THEN
 INSERT INTO monument_inspections(headstone_uuid,inspected_at,inspection_year,source_type,source,condition_type_id,condition_notes,inscription,faces,origin_key)
 VALUES(NEW.id,NEW.last_inspected_at,COALESCE(extract(year FROM NEW.last_inspected_at)::integer,extract(year FROM current_date)::integer),
 'field_survey','Cemetery administrator field inspection',NEW.condition_type_id,COALESCE(NEW.condition_notes,''),COALESCE(NEW.inscription,''),NEW.faces,
 'field:'||COALESCE(NEW.last_inspected_at::text,extract(year FROM current_date)::text))
 ON CONFLICT(headstone_uuid,origin_key) DO UPDATE SET condition_type_id=EXCLUDED.condition_type_id,condition_notes=EXCLUDED.condition_notes,
 inscription=EXCLUDED.inscription,faces=EXCLUDED.faces,updated_at=now();
 END IF;
 PERFORM refresh_nhg_inspection(NEW.id);
 RETURN NEW;
END $$;
CREATE TRIGGER capture_monument_inspection AFTER INSERT OR UPDATE OF last_inspected_at,condition_type_id,condition_notes,inscription,faces,source_properties,historical_transcriptions
 ON headstones FOR EACH ROW EXECUTE FUNCTION capture_monument_inspection();
CREATE FUNCTION refresh_linked_nhg_inspection() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN PERFORM refresh_nhg_inspection(OLD.headstone_uuid); END IF;
 IF TG_OP<>'DELETE' THEN PERFORM refresh_nhg_inspection(NEW.headstone_uuid); END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER refresh_linked_nhg_inspection AFTER INSERT OR UPDATE OR DELETE ON north_hills_ocr_entry_headstone_links
 FOR EACH ROW EXECUTE FUNCTION refresh_linked_nhg_inspection();
-- Schema rollback removes inspection history. Back up before rollback; use a forward correction for operational recovery.
--rollback DROP TRIGGER IF EXISTS capture_monument_inspection ON headstones;
--rollback DROP TRIGGER IF EXISTS refresh_linked_nhg_inspection ON north_hills_ocr_entry_headstone_links;
--rollback DROP TRIGGER IF EXISTS refresh_repaired_nhg_inspections ON north_hills_ocr_entries;
--rollback DROP FUNCTION IF EXISTS refresh_repaired_nhg_inspections();
--rollback DROP FUNCTION IF EXISTS refresh_linked_nhg_inspection();
--rollback DROP FUNCTION IF EXISTS capture_monument_inspection();
--rollback DROP FUNCTION IF EXISTS refresh_nhg_inspection(uuid);
--rollback DROP TABLE IF EXISTS monument_inspections;

-- Runtime access follows the existing restricted API role, when configured.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cemetery_api') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON monument_inspections TO cemetery_api;
 END IF;
END $$;

-- OCR repairs refresh the derived observation as well as reviewed link changes.
CREATE FUNCTION refresh_repaired_nhg_inspections() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE marker_id uuid;
BEGIN
 FOR marker_id IN SELECT DISTINCT headstone_uuid FROM north_hills_ocr_entry_headstone_links WHERE entry_id=NEW.id AND status='linked' LOOP
  PERFORM refresh_nhg_inspection(marker_id);
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER refresh_repaired_nhg_inspections AFTER UPDATE OF raw_text,source_entry,inscription_text ON north_hills_ocr_entries
 FOR EACH ROW EXECUTE FUNCTION refresh_repaired_nhg_inspections();
