--liquibase formatted sql

--changeset cemeterymapping:510-burial-military-unit
ALTER TABLE burials ADD COLUMN military_unit varchar(500);
COMMENT ON COLUMN burials.military_unit IS 'Recorded military unit or organization, such as a company, regiment, battalion, or ship; separate from service branch.';

--rollback ALTER TABLE burials DROP COLUMN military_unit;
