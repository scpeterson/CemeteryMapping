--liquibase formatted sql

--changeset cemeterymapping:044-derived-gravesite-status splitStatements:false
UPDATE gravesites
SET status_type_id = unknown_status.id
FROM gravesite_status_types sold_status
CROSS JOIN gravesite_status_types unknown_status
WHERE gravesites.status_type_id = sold_status.id
  AND sold_status.code = 'sold'
  AND unknown_status.code = 'unknown';

UPDATE gravesite_status_types
SET is_active = false,
    description = 'Deprecated. Deeded but unoccupied gravesites are now derived as unknown unless manually marked reserved or needs review.',
    updated_at = now()
WHERE code = 'sold';

--rollback UPDATE gravesite_status_types SET is_active = true, description = 'Burial rights have been sold or assigned, but occupation is not confirmed.', updated_at = now() WHERE code = 'sold';
