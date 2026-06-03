--liquibase formatted sql

--changeset cemeterymapping:042-section-g-deed-holders splitStatements:false
WITH source_deed_holders(gravesite_id, deed_holder) AS (
  VALUES
    ('G-001', 'Irlbacher, A.'),
    ('G-002', 'Irlbacher, J.'),
    ('G-003', 'Scherer, J.'),
    ('G-004', 'Scherer, J.'),
    ('G-005', 'Scherer, J.'),
    ('G-006', 'Scherer, J.'),
    ('G-007', 'Eshenbuagh, Diane'),
    ('G-008', 'Eshenbuagh, Diane'),
    ('G-009', 'White, S & T'),
    ('G-010', 'White, S & T'),
    ('G-011', 'White, S & T'),
    ('G-012', 'White, S & T'),
    ('G-014', 'Hein, J'),
    ('G-017', 'Vondracek, A & D'),
    ('G-018', 'Vondracek, A & D'),
    ('G-019', 'Kivlan, R & G'),
    ('G-020', 'Kivlan, R & G'),
    ('G-021', 'Kivlan, R & G'),
    ('G-022', 'Schinagl, D & S'),
    ('G-023', 'Schinagl, D & S'),
    ('G-024', 'Williams, D'),
    ('G-025', 'Abbott, T & S'),
    ('G-026', 'Abbott, T & S'),
    ('G-027', 'Ayers, J & J'),
    ('G-028', 'Ayers, J & J'),
    ('G-029', 'Bridge, J'),
    ('G-030', 'Bridge, D'),
    ('G-031', 'Eshenbaugh, A & D'),
    ('G-032', 'Eshenbaugh, A & D'),
    ('G-033', 'Eshenbaugh, A & D'),
    ('G-034', 'Eshenbaugh, A & D'),
    ('G-035', 'Eshenbaugh, A & D'),
    ('G-036', 'Kaelin, C & J'),
    ('G-037', 'Kaelin, C & J'),
    ('G-042', 'Smith, J & N'),
    ('G-043', 'Smith, J & N'),
    ('G-044', 'Smith, J & N'),
    ('G-045', 'Hudnall, Y & W'),
    ('G-046', 'Hudnall, Y & W'),
    ('G-047', 'Barbiaux, V'),
    ('G-048', 'Barbiaux, V'),
    ('G-049', 'Barbiaux, V'),
    ('G-050', 'Baur, L & R'),
    ('G-051', 'Baur, L & R'),
    ('G-052', 'Baur, L & R'),
    ('G-053', 'Baur, L & R'),
    ('G-054', 'Baur, L & R'),
    ('G-055', 'Baur, L & R'),
    ('G-056', 'Wieseckel, G & T'),
    ('G-057', 'Wieseckel, G & T')
),
source_metadata AS (
  SELECT
    'Section G Plot Plan With Notations.pdf page 2'::varchar(250) AS document_reference,
    'section_g_plot_plan_deed_list'::varchar(100) AS source_table,
    'Imported from page 2 deed holder list. Source heading says Section F, interpreted as Section G based on the file name and reviewed Section G plan context.'::varchar(4000) AS notes
),
trinity AS (
  SELECT id AS cemetery_id
  FROM cemeteries
  WHERE name = 'Trinity Lutheran Church Cemetery'
    AND deleted_at IS NULL
  ORDER BY id
  LIMIT 1
),
deed_holders AS (
  SELECT DISTINCT deed_holder
  FROM source_deed_holders
),
inserted_parties AS (
  INSERT INTO ownership_parties (display_name, notes)
  SELECT
    deed_holders.deed_holder,
    'Created from Section G deed holder list.'
  FROM deed_holders
  WHERE NOT EXISTS (
    SELECT 1
    FROM ownership_parties existing
    WHERE existing.display_name = deed_holders.deed_holder
      AND existing.deleted_at IS NULL
  )
  RETURNING id, display_name
),
parties AS (
  SELECT id, display_name
  FROM inserted_parties
  UNION
  SELECT id, display_name
  FROM (
    SELECT
      ownership_parties.id,
      ownership_parties.display_name,
      row_number() OVER (
        PARTITION BY ownership_parties.display_name
        ORDER BY ownership_parties.created_at, ownership_parties.id
      ) AS party_rank
    FROM ownership_parties
    JOIN deed_holders
      ON deed_holders.deed_holder = ownership_parties.display_name
    WHERE ownership_parties.deleted_at IS NULL
  ) ranked_parties
  WHERE party_rank = 1
),
inserted_events AS (
  INSERT INTO ownership_events (
    cemetery_id,
    event_type,
    recorded_by,
    document_reference,
    notes,
    source_table
  )
  SELECT
    trinity.cemetery_id,
    'deed',
    'Section G Plot Plan With Notations.pdf',
    source_metadata.document_reference,
    concat(source_metadata.notes, ' Deed holder: ', parties.display_name, '.'),
    source_metadata.source_table
  FROM parties
  CROSS JOIN trinity
  CROSS JOIN source_metadata
  WHERE NOT EXISTS (
    SELECT 1
    FROM ownership_events existing
    WHERE existing.source_table = source_metadata.source_table
      AND existing.document_reference = source_metadata.document_reference
      AND existing.notes LIKE concat('%Deed holder: ', parties.display_name, '.%')
      AND existing.deleted_at IS NULL
  )
  RETURNING id, notes
),
events AS (
  SELECT
    inserted_events.id,
    substring(inserted_events.notes FROM 'Deed holder: (.*)\.$') AS deed_holder
  FROM inserted_events
  UNION
  SELECT
    ownership_events.id,
    substring(ownership_events.notes FROM 'Deed holder: (.*)\.$') AS deed_holder
  FROM ownership_events
  CROSS JOIN source_metadata
  WHERE ownership_events.source_table = source_metadata.source_table
    AND ownership_events.document_reference = source_metadata.document_reference
    AND ownership_events.deleted_at IS NULL
),
inserted_event_parties AS (
  INSERT INTO ownership_event_parties (ownership_event_uuid, ownership_party_uuid, ownership_role)
  SELECT
    events.id,
    parties.id,
    'owner'
  FROM events
  JOIN parties
    ON parties.display_name = events.deed_holder
  ON CONFLICT (ownership_event_uuid, ownership_party_uuid) DO NOTHING
  RETURNING ownership_event_uuid
)
INSERT INTO ownership_event_rights (
  ownership_event_uuid,
  target_type,
  gravesite_uuid,
  right_type,
  notes
)
SELECT
  events.id,
  'gravesite',
  gravesites.id,
  'burial_right',
  concat('Section G deed holder list assigns ', source_deed_holders.gravesite_id, ' to ', source_deed_holders.deed_holder, '.')
FROM source_deed_holders
JOIN events
  ON events.deed_holder = source_deed_holders.deed_holder
JOIN gravesites
  ON gravesites.gravesite_id = source_deed_holders.gravesite_id
JOIN trinity
  ON trinity.cemetery_id = gravesites.cemetery_id
WHERE gravesites.section_id = 'G'
  AND gravesites.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ownership_event_rights existing
    WHERE existing.ownership_event_uuid = events.id
      AND existing.target_type = 'gravesite'
      AND existing.gravesite_uuid = gravesites.id
      AND existing.deleted_at IS NULL
  );

--rollback DELETE FROM ownership_event_rights WHERE ownership_event_uuid IN (SELECT id FROM ownership_events WHERE source_table = 'section_g_plot_plan_deed_list');
--rollback DELETE FROM ownership_event_parties WHERE ownership_event_uuid IN (SELECT id FROM ownership_events WHERE source_table = 'section_g_plot_plan_deed_list');
--rollback DELETE FROM ownership_events WHERE source_table = 'section_g_plot_plan_deed_list';
--rollback DELETE FROM ownership_parties WHERE notes = 'Created from Section G deed holder list.' AND NOT EXISTS (SELECT 1 FROM ownership_event_parties WHERE ownership_event_parties.ownership_party_uuid = ownership_parties.id);
--rollback DELETE FROM audit_events WHERE action = 'delete' AND target_table IN ('ownership_event_rights', 'ownership_event_parties', 'ownership_events', 'ownership_parties');
