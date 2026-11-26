--liquibase formatted sql

--changeset cemeterymapping:524-trinity-burial-capacity splitStatements:false
CREATE TABLE burial_capacity_exceptions (
  gravesite_uuid uuid PRIMARY KEY REFERENCES gravesites(id),
  max_ashes_without_casket integer NOT NULL CHECK (max_ashes_without_casket >= 0),
  max_ashes_with_casket integer NOT NULL CHECK (
    max_ashes_with_casket BETWEEN 0 AND max_ashes_without_casket
  ),
  approval_reference text NOT NULL CHECK (btrim(approval_reference) <> '')
);
REVOKE ALL ON burial_capacity_exceptions FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cemetery_api') THEN
    REVOKE ALL ON burial_capacity_exceptions FROM cemetery_api;
    GRANT SELECT ON burial_capacity_exceptions TO cemetery_api;
  END IF;
END $$;

-- Exhibit B allows mixed interment. The earlier signed G-72 deed specifies
-- one casket OR up to three sets of ashes, and governs that plot individually.
INSERT INTO burial_capacity_exceptions (
  gravesite_uuid, max_ashes_without_casket, max_ashes_with_casket, approval_reference
)
SELECT grave.id, 3, 0, 'Trinity signed plot deed G72, May 2025 (Council-approved exception)'
FROM gravesites grave
JOIN cemeteries cemetery ON cemetery.id = grave.cemetery_id
JOIN sections section ON section.section_id = grave.section_uuid AND section.cemetery_id = cemetery.id
WHERE cemetery.facility_id = '1' AND section.name = 'G'
  AND grave.gravesite_id = 'G-072' AND grave.deleted_at IS NULL;

CREATE OR REPLACE FUNCTION cemetery_section_g_burial_capacity_violation(p_gravesite_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  WITH active_burials AS (
    SELECT COALESCE(burial_interment_types.code, 'casket') AS interment_type
    FROM burials
    LEFT JOIN burial_interment_types
      ON burial_interment_types.id = burials.interment_type_id
    LEFT JOIN burial_record_status_types status ON status.id = burials.burial_record_status_type_id
    WHERE burials.gravesite_uuid = p_gravesite_uuid
      AND burials.deleted_at IS NULL
      AND coalesce(status.code, 'interred') NOT IN ('pre_need_inscription', 'memorial')
  ),
  burial_counts AS (
    SELECT
      count(*) FILTER (WHERE interment_type = 'urn') AS urn_count,
      count(*) FILTER (WHERE interment_type <> 'urn') AS casket_count
    FROM active_burials
  ),
  limits AS (
    SELECT COALESCE(exception.max_ashes_without_casket, 2) AS max_ashes_without_casket,
           COALESCE(exception.max_ashes_with_casket,
                    CASE WHEN cemetery.facility_id = '1' THEN 1 ELSE 0 END) AS max_ashes_with_casket
    FROM gravesites grave
    JOIN cemeteries cemetery ON cemetery.id = grave.cemetery_id
    LEFT JOIN burial_capacity_exceptions exception ON exception.gravesite_uuid = grave.id
    WHERE grave.id = p_gravesite_uuid
  )
  SELECT EXISTS (
    SELECT 1
    FROM burial_counts CROSS JOIN limits
    WHERE casket_count > 1
       OR (casket_count = 1 AND urn_count > max_ashes_with_casket)
       OR urn_count > max_ashes_without_casket
  )
$$;

--rollback CREATE OR REPLACE FUNCTION cemetery_section_g_burial_capacity_violation(p_gravesite_uuid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$ WITH active_burials AS ( SELECT COALESCE(burial_interment_types.code, 'casket') AS interment_type FROM burials LEFT JOIN burial_interment_types ON burial_interment_types.id = burials.interment_type_id LEFT JOIN burial_record_status_types status ON status.id = burials.burial_record_status_type_id WHERE burials.gravesite_uuid = p_gravesite_uuid AND burials.deleted_at IS NULL AND coalesce(status.code, 'interred') NOT IN ('pre_need_inscription', 'memorial') ), burial_counts AS ( SELECT count(*) FILTER (WHERE interment_type = 'urn') AS urn_count, count(*) FILTER (WHERE interment_type <> 'urn') AS casket_count FROM active_burials ) SELECT EXISTS ( SELECT 1 FROM burial_counts WHERE casket_count > 1 OR (casket_count = 1 AND urn_count > 0) OR urn_count > 2 ) $$;
--rollback DROP TABLE burial_capacity_exceptions;
