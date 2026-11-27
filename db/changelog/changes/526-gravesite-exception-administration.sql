--liquibase formatted sql

--changeset cemeterymapping:526-gravesite-exception-administration splitStatements:false
CREATE TABLE gravesite_exception_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  gravesite_uuid uuid NOT NULL REFERENCES gravesites(id),
  actor_id uuid NOT NULL REFERENCES app_users(id),
  rule text NOT NULL,
  before_value jsonb,
  after_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION save_gravesite_exception(
  actor_id uuid, cemetery_id uuid, p_grave uuid, rule_name text,
  expected jsonb, approval text, ashes_only integer, ashes_with_casket integer, marker_width numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  actor app_users;
  previous jsonb;
  saved jsonb;
  marker_id uuid;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Reload the gravesite and retry' USING ERRCODE = '40001';
  END IF;
  SELECT * INTO actor FROM app_users WHERE id = actor_id AND is_active FOR SHARE;
  IF NOT FOUND OR (actor.role_name <> 'admin' AND NOT EXISTS (
    SELECT 1 FROM app_user_cemetery_access access
    WHERE access.app_user_id = actor_id AND access.cemetery_id = save_gravesite_exception.cemetery_id
      AND access.can_edit AND access.role_name = 'cemetery-admin' FOR SHARE
  )) THEN RAISE EXCEPTION 'Exception permission denied' USING ERRCODE = '42501'; END IF;
  IF approval IS NULL OR length(btrim(approval)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Enter the written approval reference' USING ERRCODE = '22023';
  END IF;

  LOCK TABLE gravesites, headstones, headstone_gravesites, burials IN SHARE ROW EXCLUSIVE MODE;
  IF NOT EXISTS (
    SELECT 1 FROM gravesites g JOIN cemeteries c ON c.id = g.cemetery_id
    WHERE g.id = p_grave AND g.cemetery_id = save_gravesite_exception.cemetery_id
      AND g.deleted_at IS NULL AND c.deleted_at IS NULL AND c.facility_id = '1'
  ) THEN RAISE EXCEPTION 'Select an active Trinity gravesite' USING ERRCODE = '22023'; END IF;

  IF rule_name = 'burial' THEN
    IF NOT gravesite_location_policy(p_grave, 'casket_or_two_urns') THEN
      RAISE EXCEPTION 'Burial capacity enforcement must be active for this plot' USING ERRCODE = '22023';
    END IF;
    SELECT to_jsonb(e) - 'gravesite_uuid' INTO previous FROM burial_capacity_exceptions e WHERE e.gravesite_uuid = p_grave;
    IF previous IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Reload this exception before saving' USING ERRCODE = '40001'; END IF;
    INSERT INTO burial_capacity_exceptions AS e VALUES (p_grave, ashes_only, ashes_with_casket, btrim(approval))
    ON CONFLICT (gravesite_uuid) DO UPDATE SET max_ashes_without_casket = EXCLUDED.max_ashes_without_casket,
      max_ashes_with_casket = EXCLUDED.max_ashes_with_casket, approval_reference = EXCLUDED.approval_reference
    RETURNING to_jsonb(e) - 'gravesite_uuid' INTO saved;
    IF cemetery_section_g_burial_capacity_violation(p_grave) THEN
      RAISE EXCEPTION 'Existing burials exceed the proposed capacity' USING ERRCODE = '23514', CONSTRAINT = 'location_policy_capacity';
    END IF;
  ELSIF rule_name = 'marker' THEN
    SELECT to_jsonb(e) - 'gravesite_uuid' INTO previous FROM marker_width_exceptions e WHERE e.gravesite_uuid = p_grave;
    IF previous IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Reload this exception before saving' USING ERRCODE = '40001'; END IF;
    INSERT INTO marker_width_exceptions AS e VALUES (p_grave, marker_width, btrim(approval))
    ON CONFLICT (gravesite_uuid) DO UPDATE SET max_width_inches = EXCLUDED.max_width_inches,
      approval_reference = EXCLUDED.approval_reference
    RETURNING to_jsonb(e) - 'gravesite_uuid' INTO saved;
    FOR marker_id IN
      SELECT id FROM headstones WHERE gravesite_uuid = p_grave AND deleted_at IS NULL
      UNION
      SELECT headstone_uuid FROM headstone_gravesites WHERE gravesite_uuid = p_grave AND deleted_at IS NULL
    LOOP
      PERFORM validate_trinity_marker_size(marker_id);
    END LOOP;
  ELSE
    RAISE EXCEPTION 'Choose a supported exception type' USING ERRCODE = '22023';
  END IF;
  IF saved IS DISTINCT FROM previous THEN
    UPDATE location_policy_revision SET revision = revision + 1 WHERE singleton;
    INSERT INTO gravesite_exception_history (gravesite_uuid, actor_id, rule, before_value, after_value)
    VALUES (p_grave, save_gravesite_exception.actor_id, rule_name, previous, saved);
  END IF;
  RETURN saved;
END $$;
REVOKE ALL ON FUNCTION save_gravesite_exception(uuid,uuid,uuid,text,jsonb,text,integer,integer,numeric) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cemetery_api') THEN
    GRANT EXECUTE ON FUNCTION save_gravesite_exception(uuid,uuid,uuid,text,jsonb,text,integer,integer,numeric) TO cemetery_api;
  END IF;
END $$;
--rollback DROP FUNCTION save_gravesite_exception(uuid,uuid,uuid,text,jsonb,text,integer,integer,numeric);
--rollback DROP TABLE gravesite_exception_history;
