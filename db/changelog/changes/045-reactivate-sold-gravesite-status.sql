--liquibase formatted sql

--changeset cemeterymapping:045-reactivate-sold-gravesite-status splitStatements:false
UPDATE gravesite_status_types
SET is_active = true,
    description = 'Gravesite has deeded ownership or burial rights, either directly or through its lot, but has no active burial.',
    updated_at = now()
WHERE code = 'sold';

--rollback UPDATE gravesite_status_types SET is_active = false, description = 'Deprecated. Deeded but unoccupied gravesites are now derived as unknown unless manually marked reserved or needs review.', updated_at = now() WHERE code = 'sold';
