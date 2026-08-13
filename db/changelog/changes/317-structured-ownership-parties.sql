--liquibase formatted sql

--changeset cemeterymapping:317-structured-ownership-parties splitStatements:false
ALTER TABLE ownership_parties
  ADD COLUMN first_name varchar(120),
  ADD COLUMN last_name varchar(120);

CREATE OR REPLACE VIEW current_ownership_right_owners AS
SELECT
  current_ownership_events.ownership_event_right_uuid,
  current_ownership_events.id AS ownership_event_uuid,
  current_ownership_events.cemetery_id,
  current_ownership_events.event_type,
  current_ownership_events.event_type_id,
  current_ownership_events.effective_date,
  current_ownership_events.recorded_at,
  current_ownership_events.target_type,
  current_ownership_events.lot_uuid,
  current_ownership_events.gravesite_uuid,
  current_ownership_events.section_uuid,
  current_ownership_events.unlocated_label,
  current_ownership_events.right_type,
  current_ownership_events.right_quantity,
  ownership_parties.id AS ownership_party_uuid,
  ownership_parties.display_name,
  ownership_event_parties.ownership_role,
  ownership_event_parties.share_numerator,
  ownership_event_parties.share_denominator,
  ownership_parties.first_name,
  ownership_parties.last_name,
  ownership_parties.full_address,
  ownership_parties.municipality,
  ownership_parties.state,
  ownership_parties.zip
FROM current_ownership_events
JOIN ownership_event_parties
  ON ownership_event_parties.ownership_event_uuid = current_ownership_events.id
JOIN ownership_parties
  ON ownership_parties.id = ownership_event_parties.ownership_party_uuid
WHERE current_ownership_events.event_type <> 'release'
  AND ownership_event_parties.ownership_role IN ('owner', 'grantee')
  AND ownership_parties.deleted_at IS NULL;

--rollback DROP VIEW IF EXISTS current_ownership_right_owners;
--rollback ALTER TABLE ownership_parties DROP COLUMN IF EXISTS last_name, DROP COLUMN IF EXISTS first_name;
--rollback CREATE VIEW current_ownership_right_owners AS SELECT current_ownership_events.ownership_event_right_uuid, current_ownership_events.id AS ownership_event_uuid, current_ownership_events.cemetery_id, current_ownership_events.event_type, current_ownership_events.event_type_id, current_ownership_events.effective_date, current_ownership_events.recorded_at, current_ownership_events.target_type, current_ownership_events.lot_uuid, current_ownership_events.gravesite_uuid, current_ownership_events.section_uuid, current_ownership_events.unlocated_label, current_ownership_events.right_type, current_ownership_events.right_quantity, ownership_parties.id AS ownership_party_uuid, ownership_parties.display_name, ownership_event_parties.ownership_role, ownership_event_parties.share_numerator, ownership_event_parties.share_denominator FROM current_ownership_events JOIN ownership_event_parties ON ownership_event_parties.ownership_event_uuid = current_ownership_events.id JOIN ownership_parties ON ownership_parties.id = ownership_event_parties.ownership_party_uuid WHERE current_ownership_events.event_type <> 'release' AND ownership_parties.deleted_at IS NULL;
