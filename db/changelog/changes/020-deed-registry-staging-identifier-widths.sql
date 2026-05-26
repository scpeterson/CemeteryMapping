--liquibase formatted sql

--changeset cemeterymapping:020-deed-registry-staging-identifier-widths
ALTER TABLE deed_registry_entries
  ALTER COLUMN raw_section_text TYPE varchar(250),
  ALTER COLUMN parsed_section_name TYPE varchar(100),
  ALTER COLUMN parsed_section_alias TYPE varchar(100),
  ALTER COLUMN ownership_scope TYPE varchar(100),
  ALTER COLUMN parse_confidence TYPE varchar(100),
  ALTER COLUMN status TYPE varchar(100);

ALTER TABLE deed_registry_entry_allocations
  ALTER COLUMN allocation_type TYPE varchar(100),
  ALTER COLUMN section_name TYPE varchar(100),
  ALTER COLUMN section_alias TYPE varchar(100),
  ALTER COLUMN lot_identifier TYPE varchar(250),
  ALTER COLUMN plot_identifier TYPE varchar(100),
  ALTER COLUMN grave_number TYPE varchar(100),
  ALTER COLUMN parse_confidence TYPE varchar(100);

--rollback ALTER TABLE deed_registry_entry_allocations
--rollback   ALTER COLUMN allocation_type TYPE varchar(50),
--rollback   ALTER COLUMN section_name TYPE varchar(50),
--rollback   ALTER COLUMN section_alias TYPE varchar(50),
--rollback   ALTER COLUMN lot_identifier TYPE varchar(50),
--rollback   ALTER COLUMN plot_identifier TYPE varchar(50),
--rollback   ALTER COLUMN grave_number TYPE varchar(50),
--rollback   ALTER COLUMN parse_confidence TYPE varchar(50);
--rollback ALTER TABLE deed_registry_entries
--rollback   ALTER COLUMN raw_section_text TYPE varchar(50),
--rollback   ALTER COLUMN parsed_section_name TYPE varchar(50),
--rollback   ALTER COLUMN parsed_section_alias TYPE varchar(50),
--rollback   ALTER COLUMN ownership_scope TYPE varchar(50),
--rollback   ALTER COLUMN parse_confidence TYPE varchar(50),
--rollback   ALTER COLUMN status TYPE varchar(50);
