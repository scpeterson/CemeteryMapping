--liquibase formatted sql

--changeset cemeterymapping:296-correct-c-0311-william-king-name
UPDATE gravesites
SET name = 'William F King', updated_at = now()
WHERE gravesite_id = 'TLC-GPS-0311'
  AND deleted_at IS NULL
  AND name IS DISTINCT FROM 'William F King';

--rollback UPDATE gravesites SET name = 'William E King', updated_at = now() WHERE gravesite_id = 'TLC-GPS-0311' AND deleted_at IS NULL AND name = 'William F King';
