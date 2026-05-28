--liquibase formatted sql

--changeset cemeterymapping:021-section-g-plot-gravesites splitStatements:false
ALTER TABLE deed_registry_entries
  DROP CONSTRAINT IF EXISTS deed_registry_entries_scope_check;

ALTER TABLE deed_registry_entries
  ADD CONSTRAINT deed_registry_entries_scope_check
  CHECK (ownership_scope IN ('whole_lot', 'multiple_lots', 'specific_graves', 'grave_count_only', 'passage', 'section_g_plot', 'section_g_gravesite', 'unknown'));

ALTER TABLE deed_registry_entry_allocations
  DROP CONSTRAINT IF EXISTS deed_registry_entry_allocations_type_check;

ALTER TABLE deed_registry_entry_allocations
  ADD CONSTRAINT deed_registry_entry_allocations_type_check
  CHECK (allocation_type IN ('lot', 'multiple_lot', 'passage', 'section_g_plot', 'section_g_gravesite', 'grave_number', 'grave_count', 'unknown'));

UPDATE deed_registry_entries
SET ownership_scope = 'section_g_gravesite',
    parsed_grave_numbers = parsed_plot_numbers,
    parse_notes = (
      SELECT ARRAY(
        SELECT DISTINCT note
        FROM unnest(parse_notes || ARRAY['Section G source uses plot numbers for 8 by 4 foot gravesites; north is shown at the bottom of the source plan.']) AS note
      )
    )
WHERE ownership_scope = 'section_g_plot';

UPDATE deed_registry_entry_allocations
SET allocation_type = 'section_g_gravesite',
    grave_number = COALESCE(grave_number, plot_identifier),
    parse_notes = (
      SELECT ARRAY(
        SELECT DISTINCT note
        FROM unnest(parse_notes || ARRAY['Section G plot number is treated as an 8 by 4 foot gravesite number.']) AS note
      )
    )
WHERE allocation_type = 'section_g_plot';

ALTER TABLE deed_registry_entries
  DROP CONSTRAINT IF EXISTS deed_registry_entries_scope_check;

ALTER TABLE deed_registry_entries
  ADD CONSTRAINT deed_registry_entries_scope_check
  CHECK (ownership_scope IN ('whole_lot', 'multiple_lots', 'specific_graves', 'grave_count_only', 'passage', 'section_g_gravesite', 'unknown'));

ALTER TABLE deed_registry_entry_allocations
  DROP CONSTRAINT IF EXISTS deed_registry_entry_allocations_type_check;

ALTER TABLE deed_registry_entry_allocations
  ADD CONSTRAINT deed_registry_entry_allocations_type_check
  CHECK (allocation_type IN ('lot', 'multiple_lot', 'passage', 'section_g_gravesite', 'grave_number', 'grave_count', 'unknown'));

--rollback ALTER TABLE deed_registry_entry_allocations DROP CONSTRAINT IF EXISTS deed_registry_entry_allocations_type_check;
--rollback ALTER TABLE deed_registry_entry_allocations ADD CONSTRAINT deed_registry_entry_allocations_type_check CHECK (allocation_type IN ('lot', 'multiple_lot', 'passage', 'section_g_plot', 'grave_number', 'grave_count', 'unknown'));
--rollback ALTER TABLE deed_registry_entries DROP CONSTRAINT IF EXISTS deed_registry_entries_scope_check;
--rollback ALTER TABLE deed_registry_entries ADD CONSTRAINT deed_registry_entries_scope_check CHECK (ownership_scope IN ('whole_lot', 'multiple_lots', 'specific_graves', 'grave_count_only', 'passage', 'section_g_plot', 'unknown'));
