export function derivedGravesiteStatusSql({ gravesiteAlias = "gravesites", statusTypeAlias = "status_type" } = {}) {
  return `
    CASE
      WHEN ${statusTypeAlias}.code = 'needs_review' THEN ${statusTypeAlias}.code
      WHEN EXISTS (
        SELECT 1
        FROM burials status_burials
        WHERE status_burials.gravesite_uuid = ${gravesiteAlias}.id
          AND status_burials.deleted_at IS NULL
      ) THEN 'occupied'
      WHEN ${statusTypeAlias}.code = 'reserved' THEN ${statusTypeAlias}.code
      WHEN EXISTS (
        SELECT 1
        FROM owners status_legacy_owners
        WHERE status_legacy_owners.gravesite_uuid = ${gravesiteAlias}.id
          AND status_legacy_owners.deleted_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM current_ownership_right_owners status_rights
        WHERE (
            status_rights.target_type = 'gravesite'
            AND status_rights.gravesite_uuid = ${gravesiteAlias}.id
          )
          OR (
            status_rights.target_type = 'lot'
            AND status_rights.lot_uuid = ${gravesiteAlias}.lot_uuid
          )
      ) THEN 'sold'
      WHEN NOT EXISTS (
        SELECT 1
        FROM owners status_legacy_owners
        WHERE status_legacy_owners.gravesite_uuid = ${gravesiteAlias}.id
          AND status_legacy_owners.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM current_ownership_right_owners status_rights
        WHERE (
            status_rights.target_type = 'gravesite'
            AND status_rights.gravesite_uuid = ${gravesiteAlias}.id
          )
          OR (
            status_rights.target_type = 'lot'
            AND status_rights.lot_uuid = ${gravesiteAlias}.lot_uuid
          )
      ) THEN 'available'
      ELSE 'unknown'
    END
  `;
}
