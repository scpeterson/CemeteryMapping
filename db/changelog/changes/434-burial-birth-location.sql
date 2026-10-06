--liquibase formatted sql

--changeset cemeterymapping:434-burial-birth-location
ALTER TABLE burials ADD COLUMN birth_place_uuid uuid REFERENCES places(id) ON DELETE SET NULL;
CREATE INDEX burials_birth_place_idx ON burials (birth_place_uuid) WHERE deleted_at IS NULL AND birth_place_uuid IS NOT NULL;

--rollback ALTER TABLE burials DROP COLUMN birth_place_uuid;
