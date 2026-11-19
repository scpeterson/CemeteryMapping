--liquibase formatted sql

--changeset cemeterymapping:522-policy-administration splitStatements:false
CREATE TABLE location_policy_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(),
 actor_id uuid REFERENCES app_users(id) ON DELETE SET NULL, actor_email text NOT NULL,
 cemetery_id uuid, section_uuid uuid, block_uuid uuid, rule_key text NOT NULL,
 before_value jsonb, after_value jsonb, reason text NOT NULL, revision bigint NOT NULL, scope_label text NOT NULL
);
CREATE INDEX location_policy_history_scope ON location_policy_history(cemetery_id,created_at DESC,id);
-- The API retains no direct catalog/history DML. The narrowly scoped function
-- validates the current database account and assignment, not a submitted role.
CREATE FUNCTION change_location_policy(p_actor uuid,p_cemetery uuid,p_section uuid,p_block uuid,
 p_rule text,p_enabled boolean,p_reason text,p_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor app_users; prior jsonb; updated jsonb; current_revision bigint; baseline jsonb; scope_label text;
BEGIN
 SELECT * INTO actor FROM app_users WHERE id=p_actor AND is_active FOR SHARE;
 IF NOT FOUND OR (actor.role_name<>'admin' AND (p_cemetery IS NULL OR NOT EXISTS (
   SELECT 1 FROM app_user_cemetery_access WHERE app_user_id=p_actor AND cemetery_id=p_cemetery
    AND can_edit AND role_name='cemetery-admin' FOR SHARE))) THEN
  RAISE EXCEPTION 'Policy permission denied' USING ERRCODE='42501';
 END IF;
 IF p_rule NOT IN ('no_gravesites','no_interactive_creation','flat_markers_only','single_primary_marker','casket_or_two_urns')
    OR p_rule IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500
    OR (p_section IS NOT NULL AND p_cemetery IS NULL) OR (p_block IS NOT NULL AND p_section IS NULL) THEN
   RAISE EXCEPTION 'Invalid policy change' USING ERRCODE='22023';
 END IF;
 IF (p_cemetery IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cemeteries WHERE id=p_cemetery AND deleted_at IS NULL FOR SHARE))
 OR (p_section IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sections WHERE section_id=p_section AND cemetery_id=p_cemetery AND deleted_at IS NULL FOR SHARE))
 OR (p_block IS NOT NULL AND NOT EXISTS (SELECT 1 FROM blocks WHERE id=p_block AND section_uuid=p_section AND cemetery_id=p_cemetery AND deleted_at IS NULL FOR SHARE)) THEN
  RAISE EXCEPTION 'Invalid policy scope' USING ERRCODE='22023';
 END IF;
 -- Same lock ordering as migration 521; no policy/data write can race the preview
 -- or save. The revision detects both concurrent edits and expired previews.
 LOCK TABLE gravesites,headstones,headstone_gravesites,burials,sections,blocks IN SHARE ROW EXCLUSIVE MODE;
 SELECT revision INTO current_revision FROM location_policy_revision WHERE singleton FOR UPDATE;
 IF p_revision IS DISTINCT FROM current_revision THEN
  RAISE EXCEPTION 'Policy changed; preview again' USING ERRCODE='40001';
 END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'enabled',gravesite_location_policy(id,p_rule))),'[]'::jsonb)
 INTO baseline FROM gravesites WHERE deleted_at IS NULL AND (p_cemetery IS NULL OR cemetery_id=p_cemetery)
   AND (p_section IS NULL OR section_uuid=p_section OR (section_uuid IS NULL AND section_id=(SELECT name FROM sections WHERE section_id=p_section)))
   AND (p_block IS NULL OR block_uuid=p_block);
 SELECT to_jsonb(p) INTO prior FROM location_policies p WHERE cemetery_id IS NOT DISTINCT FROM p_cemetery
  AND section_uuid IS NOT DISTINCT FROM p_section AND block_uuid IS NOT DISTINCT FROM p_block AND rule_key=p_rule;
 IF p_enabled IS NULL THEN
  DELETE FROM location_policies WHERE cemetery_id IS NOT DISTINCT FROM p_cemetery
   AND section_uuid IS NOT DISTINCT FROM p_section AND block_uuid IS NOT DISTINCT FROM p_block AND rule_key=p_rule;
 ELSE
  INSERT INTO location_policies(cemetery_id,section_uuid,block_uuid,rule_key,enabled,reason)
  VALUES(p_cemetery,p_section,p_block,p_rule,p_enabled,btrim(p_reason))
  ON CONFLICT(cemetery_id,section_uuid,block_uuid,rule_key) DO UPDATE SET enabled=EXCLUDED.enabled,reason=EXCLUDED.reason;
 END IF;
 SELECT to_jsonb(p) INTO updated FROM location_policies p WHERE cemetery_id IS NOT DISTINCT FROM p_cemetery
  AND section_uuid IS NOT DISTINCT FROM p_section AND block_uuid IS NOT DISTINCT FROM p_block AND rule_key=p_rule;
 SELECT revision INTO current_revision FROM location_policy_revision WHERE singleton;
 SELECT coalesce(nullif(concat_ws(' / ',(SELECT name FROM cemeteries WHERE id=p_cemetery),
  (SELECT 'Section '||name FROM sections WHERE section_id=p_section),
  (SELECT 'Block '||block_id FROM blocks WHERE id=p_block)),''),'System') INTO scope_label;
 INSERT INTO location_policy_history(actor_id,actor_email,cemetery_id,section_uuid,block_uuid,rule_key,before_value,after_value,reason,revision,scope_label)
 VALUES(p_actor,actor.email,p_cemetery,p_section,p_block,p_rule,prior,updated,btrim(p_reason),current_revision,scope_label);
 RETURN jsonb_build_object('revision',current_revision::text,'baseline',baseline);
END $$;
REVOKE ALL ON FUNCTION change_location_policy(uuid,uuid,uuid,uuid,text,boolean,text,bigint) FROM PUBLIC;

--rollback DROP FUNCTION change_location_policy(uuid,uuid,uuid,uuid,text,boolean,text,bigint);
--rollback DROP TABLE location_policy_history;
