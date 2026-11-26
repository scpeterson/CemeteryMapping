--liquibase formatted sql

--changeset cemeterymapping:525-trinity-marker-dimensions splitStatements:false
ALTER TABLE headstones
  ADD COLUMN width_inches numeric CHECK (width_inches > 0 AND width_inches <= 10000),
  ADD COLUMN height_inches numeric CHECK (height_inches > 0 AND height_inches <= 10000),
  ADD COLUMN depth_inches numeric CHECK (depth_inches > 0 AND depth_inches <= 10000),
  ADD COLUMN rise_inches numeric CHECK (rise_inches >= 0 AND rise_inches <= 10000);

CREATE TABLE marker_width_exceptions (
  gravesite_uuid uuid PRIMARY KEY REFERENCES gravesites(id),
  max_width_inches numeric NOT NULL CHECK (max_width_inches > 0 AND max_width_inches <= 10000),
  approval_reference text NOT NULL CHECK (btrim(approval_reference) <> '')
);
REVOKE ALL ON marker_width_exceptions FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cemetery_api') THEN
    GRANT SELECT ON marker_width_exceptions TO cemetery_api;
  END IF;
END $$;
INSERT INTO marker_width_exceptions
SELECT gravesite_uuid, 36, approval_reference
FROM burial_capacity_exceptions
WHERE approval_reference = 'Trinity signed plot deed G72, May 2025 (Council-approved exception)';

CREATE FUNCTION validate_trinity_marker_size(marker_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  marker headstones;
  kind text;
  plot_ids uuid[];
  spanning_plots integer;
  principal_plots integer;
  foot_marker boolean;
  shared_marker boolean;
  max_width numeric;
  max_height numeric;
  max_depth numeric;
BEGIN
  SELECT * INTO marker FROM headstones WHERE id = marker_id AND deleted_at IS NULL;
  IF NOT FOUND OR (marker.width_inches IS NULL AND marker.height_inches IS NULL
      AND marker.depth_inches IS NULL AND marker.rise_inches IS NULL) THEN RETURN; END IF;

  SELECT code INTO kind FROM marker_types WHERE id = marker.marker_type_id;
  SELECT array_agg(DISTINCT g.id ORDER BY g.id),
         count(DISTINCT g.id) FILTER (WHERE l.relationship_type = 'spans'),
         count(DISTINCT g.id) FILTER (WHERE l.relationship_type IN ('primary', 'spans') OR g.id = marker.gravesite_uuid),
         coalesce(bool_or(l.relationship_type = 'footstone'), false)
    INTO plot_ids, spanning_plots, principal_plots, foot_marker
  FROM gravesites g
  JOIN cemeteries c ON c.id = g.cemetery_id AND c.facility_id = '1'
  LEFT JOIN headstone_gravesites l ON l.gravesite_uuid = g.id AND l.headstone_uuid = marker.id
    AND l.deleted_at IS NULL AND l.relationship_type IN ('primary', 'secondary', 'spans', 'footstone')
  WHERE g.deleted_at IS NULL AND (g.id = marker.gravesite_uuid OR l.gravesite_uuid IS NOT NULL);
  IF plot_ids IS NULL THEN RETURN; END IF;

  shared_marker := cardinality(plot_ids) = 2 AND principal_plots = 2 AND spanning_plots > 0 AND EXISTS (
    SELECT 1 FROM gravesites a JOIN gravesites b ON b.id = plot_ids[2]
    WHERE a.id = plot_ids[1] AND ST_DWithin(a.geometry::geography, b.geometry::geography, 0.0254)
      AND NOT ST_Equals(a.geometry, b.geometry)
  );
  IF foot_marker OR kind = 'footstone' THEN
    max_width := 24; max_depth := 12;
  ELSIF kind = 'upright_headstone' THEN
    max_width := CASE WHEN shared_marker THEN 50 ELSE 36 END;
    max_height := 36; max_depth := 16;
  ELSIF kind = 'flat_marker' THEN
    max_width := CASE WHEN shared_marker THEN 54 ELSE 28 END;
    max_depth := 18;
    IF cardinality(plot_ids) = 1 THEN
      SELECT coalesce((SELECT max_width_inches FROM marker_width_exceptions
                       WHERE gravesite_uuid = plot_ids[1]), max_width) INTO max_width;
      IF (
        SELECT count(*) = 2 AND count(*) FILTER (WHERE t.code = 'urn') = 2
        FROM burials b
        LEFT JOIN burial_interment_types t ON t.id = b.interment_type_id
        LEFT JOIN burial_record_status_types s ON s.id = b.burial_record_status_type_id
        WHERE b.gravesite_uuid = plot_ids[1] AND b.deleted_at IS NULL
          AND coalesce(s.code, 'interred') NOT IN ('pre_need_inscription', 'memorial')
      ) THEN max_depth := 34; END IF;
    END IF;
  ELSE
    RETURN;
  END IF;
  IF marker.width_inches > max_width OR marker.height_inches > max_height
      OR marker.depth_inches > max_depth
      OR ((foot_marker OR kind IN ('footstone', 'flat_marker')) AND marker.rise_inches > 0.5) THEN
    RAISE EXCEPTION 'Trinity marker limits for this plot: width % in, depth % in%. Flush markers may rise at most 0.5 in above grade.',
      max_width, max_depth, CASE WHEN max_height IS NULL THEN '' ELSE ', height ' || max_height || ' in' END
      USING ERRCODE = '23514', CONSTRAINT = 'trinity_marker_size';
  END IF;
END $$;

CREATE FUNCTION check_trinity_marker_size() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'headstones' THEN
    PERFORM validate_trinity_marker_size(NEW.id);
  ELSE
    IF TG_OP <> 'INSERT' THEN PERFORM validate_trinity_marker_size(OLD.headstone_uuid); END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.headstone_uuid <> OLD.headstone_uuid) THEN
      PERFORM validate_trinity_marker_size(NEW.headstone_uuid);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_trinity_marker_size AFTER INSERT OR UPDATE ON headstones
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_trinity_marker_size();
CREATE CONSTRAINT TRIGGER check_trinity_marker_link_size AFTER INSERT OR UPDATE OR DELETE ON headstone_gravesites
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_trinity_marker_size();

CREATE FUNCTION check_trinity_marker_size_for_plots() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  affected_plots uuid[];
  marker_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'gravesites' THEN
    affected_plots := ARRAY[NEW.id];
  ELSE
    affected_plots := ARRAY[
      (CASE WHEN TG_OP <> 'INSERT' THEN OLD.gravesite_uuid END),
      (CASE WHEN TG_OP <> 'DELETE' THEN NEW.gravesite_uuid END)
    ];
  END IF;
  FOR marker_id IN
    SELECT id FROM headstones WHERE gravesite_uuid = ANY(affected_plots) AND deleted_at IS NULL
    UNION
    SELECT headstone_uuid FROM headstone_gravesites WHERE gravesite_uuid = ANY(affected_plots) AND deleted_at IS NULL
  LOOP
    PERFORM validate_trinity_marker_size(marker_id);
  END LOOP;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER check_trinity_marker_grave_size
  AFTER UPDATE OF geometry, cemetery_id, deleted_at ON gravesites
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_trinity_marker_size_for_plots();
CREATE CONSTRAINT TRIGGER check_trinity_marker_burial_size
  AFTER INSERT OR DELETE OR UPDATE OF gravesite_uuid, interment_type_id, burial_record_status_type_id, deleted_at ON burials
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_trinity_marker_size_for_plots();

--rollback DROP TRIGGER check_trinity_marker_burial_size ON burials;
--rollback DROP TRIGGER check_trinity_marker_grave_size ON gravesites;
--rollback DROP FUNCTION check_trinity_marker_size_for_plots();
--rollback DROP TRIGGER check_trinity_marker_link_size ON headstone_gravesites;
--rollback DROP TRIGGER check_trinity_marker_size ON headstones;
--rollback DROP FUNCTION check_trinity_marker_size();
--rollback DROP FUNCTION validate_trinity_marker_size(uuid);
--rollback DROP TABLE marker_width_exceptions;
--rollback ALTER TABLE headstones DROP COLUMN rise_inches, DROP COLUMN depth_inches, DROP COLUMN height_inches, DROP COLUMN width_inches;
