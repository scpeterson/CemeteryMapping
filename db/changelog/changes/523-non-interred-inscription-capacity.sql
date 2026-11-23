--liquibase formatted sql

--changeset cemeterymapping:523-non-interred-inscription-capacity splitStatements:false
-- Inscriptions are evidence of a person, not an interment. Unknown statuses retain conservative capacity counting.
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
  )
  SELECT EXISTS (
    SELECT 1
    FROM burial_counts
    WHERE casket_count > 1
       OR (casket_count = 1 AND urn_count > 0)
       OR urn_count > 2
  )
$$;

--rollback CREATE OR REPLACE FUNCTION cemetery_section_g_burial_capacity_violation(p_gravesite_uuid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$   WITH active_burials AS (     SELECT COALESCE(burial_interment_types.code, 'casket') AS interment_type     FROM burials     LEFT JOIN burial_interment_types       ON burial_interment_types.id = burials.interment_type_id     WHERE burials.gravesite_uuid = p_gravesite_uuid       AND burials.deleted_at IS NULL   ),   burial_counts AS (     SELECT       count(*) FILTER (WHERE interment_type = 'urn') AS urn_count,       count(*) FILTER (WHERE interment_type <> 'urn') AS casket_count     FROM active_burials   )   SELECT EXISTS (     SELECT 1     FROM burial_counts     WHERE casket_count > 1        OR (casket_count = 1 AND urn_count > 0)        OR urn_count > 2   ) $$;
