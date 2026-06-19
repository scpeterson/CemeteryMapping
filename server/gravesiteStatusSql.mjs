export function derivedGravesiteStatusSql({ gravesiteAlias = "gravesites", statusTypeAlias = "status_type" } = {}) {
  return `
    CASE
      WHEN ${statusTypeAlias}.code = 'needs_review' THEN ${statusTypeAlias}.code
      WHEN EXISTS (
        SELECT 1
        FROM burials status_burials
        LEFT JOIN burial_record_status_types status_burial_record_status
          ON status_burial_record_status.id = status_burials.burial_record_status_type_id
        WHERE status_burials.gravesite_uuid = ${gravesiteAlias}.id
          AND status_burials.deleted_at IS NULL
          AND COALESCE(status_burial_record_status.code, 'interred') = 'interred'
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
      WHEN EXISTS (
        SELECT 1
        FROM burials status_burials
        JOIN burial_record_status_types status_burial_record_status
          ON status_burial_record_status.id = status_burials.burial_record_status_type_id
        WHERE status_burials.gravesite_uuid = ${gravesiteAlias}.id
          AND status_burials.deleted_at IS NULL
          AND status_burial_record_status.code = 'pre_need_inscription'
      ) THEN 'reserved'
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
