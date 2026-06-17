--liquibase formatted sql

--changeset cemeterymapping:102-add-trinity-a-front-row-burial-use-restrictions
UPDATE lots
SET
  burial_use_status = 'non_burial',
  burial_use_notes = 'Lot exists in the cemetery lot grid, but it cannot contain gravesites or markers.',
  updated_at = now()
WHERE lots.deleted_at IS NULL
  AND lots.block_id IS NULL
  AND upper(COALESCE(lots.section_id, '')) = 'A'
  AND lots.lot_id IN ('5', '6', '7', '8');

--rollback UPDATE lots
--rollback SET burial_use_status = 'standard',
--rollback     burial_use_notes = NULL,
--rollback     updated_at = now()
--rollback WHERE lots.deleted_at IS NULL
--rollback   AND lots.block_id IS NULL
--rollback   AND upper(COALESCE(lots.section_id, '')) = 'A'
--rollback   AND lots.lot_id IN ('5', '6', '7', '8');
