const statusLabels = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  sold: "Sold",
  needs_review: "Needs review",
  unknown: "Unknown",
};

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "");
}

function normalizeStatus(status) {
  return Object.hasOwn(statusLabels, status) ? status : "unknown";
}

function parseGeometry(value) {
  if (!value) return undefined;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function toSearchSummary(row) {
  return {
    id: row.gravesite_id,
    cemeteryId: row.cemetery_id,
    cemeteryName: row.cemetery_name,
    section: row.section_id ?? "",
    lot: row.lot_id ?? "",
    space: row.grave_id,
    status: normalizeStatus(row.status),
    geometry: parseGeometry(row.geometry),
  };
}

function reasonText(row, cleanedQuery) {
  if (!cleanedQuery && row.reason_label === "Status") return row.reason_value;
  return `${row.reason_label}: ${row.reason_value}`;
}

function groupSearchRows(rows, cleanedQuery) {
  const matchesByGrave = new Map();

  for (const row of rows) {
    const key = `${row.cemetery_id}:${row.gravesite_id}`;
    const match = matchesByGrave.get(key) ?? { grave: toSearchSummary(row), reasons: [] };
    const reason = reasonText(row, cleanedQuery);
    if (!match.reasons.includes(reason)) match.reasons.push(reason);
    matchesByGrave.set(key, match);
  }

  return [...matchesByGrave.values()];
}

export async function searchCemetery(pool, { query = "", statuses = [], includeOwnership = true, ownershipCemeteryIds } = {}) {
  const cleanedQuery = normalize(query.trim());
  const scopedOwnershipCemeteryIds = ownershipCemeteryIds?.map((id) => String(id));
  const result = await pool.query(
    `
      WITH status_labels(status, label) AS (
        VALUES
          ('available', 'Available'),
          ('reserved', 'Reserved'),
          ('occupied', 'Occupied'),
          ('sold', 'Sold'),
          ('needs_review', 'Needs review'),
          ('unknown', 'Unknown')
      ),
      base_graves AS (
        SELECT
          gravesites.id AS grave_uuid,
          gravesites.cemetery_id::text,
          cemeteries.name AS cemetery_name,
          gravesites.section_id,
          gravesites.lot_id,
          gravesites.grave_id,
          gravesites.gravesite_id,
          COALESCE(status_labels.status, 'unknown') AS status,
          COALESCE(status_labels.label, 'Unknown') AS status_label,
          ST_AsGeoJSON(gravesites.geometry)::json AS geometry
        FROM gravesites
        JOIN cemeteries
          ON cemeteries.id = gravesites.cemetery_id
        LEFT JOIN status_labels
          ON status_labels.status = lower(gravesites.status)
        WHERE gravesites.deleted_at IS NULL
          AND cemeteries.deleted_at IS NULL
          AND (cardinality($2::text[]) = 0 OR COALESCE(status_labels.status, 'unknown') = ANY($2::text[]))
      )
      SELECT
        base_graves.cemetery_id,
        base_graves.cemetery_name,
        base_graves.section_id,
        base_graves.lot_id,
        base_graves.grave_id,
        base_graves.gravesite_id,
        base_graves.status,
        base_graves.geometry,
        reasons.reason_label,
        reasons.reason_value
      FROM base_graves
      JOIN LATERAL (
        SELECT 'Status' AS reason_label, base_graves.status_label AS reason_value
        WHERE $1 = ''

        UNION ALL
        SELECT 'Grave', concat_ws('-', base_graves.section_id, base_graves.lot_id, base_graves.grave_id)
        WHERE $1 <> ''
          AND lower(concat_ws('-', base_graves.section_id, base_graves.lot_id, base_graves.grave_id)) LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Status', base_graves.status_label
        WHERE $1 <> ''
          AND lower(base_graves.status_label) LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Owner', owner_names.display_name
        FROM owners
        CROSS JOIN LATERAL (
          SELECT COALESCE(NULLIF(concat_ws(' and ', NULLIF(owners.owner, ''), NULLIF(owners.co_owner, '')), ''), 'Unknown owner') AS display_name
        ) owner_names
        WHERE $3::boolean
          AND ($4::text[] IS NULL OR base_graves.cemetery_id = ANY($4::text[]))
          AND $1 <> ''
          AND owners.gravesite_uuid = base_graves.grave_uuid
          AND owners.deleted_at IS NULL
          AND lower(owner_names.display_name) LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Historical owner', owner_names.display_name
        FROM owners
        CROSS JOIN LATERAL (
          SELECT COALESCE(NULLIF(concat_ws(' and ', NULLIF(owners.owner, ''), NULLIF(owners.co_owner, '')), ''), 'Unknown owner') AS display_name
        ) owner_names
        WHERE $3::boolean
          AND ($4::text[] IS NULL OR base_graves.cemetery_id = ANY($4::text[]))
          AND $1 <> ''
          AND owners.gravesite_uuid = base_graves.grave_uuid
          AND owners.deleted_at IS NULL
          AND lower(owner_names.display_name) LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Ownership date', owners.sale_date::text
        FROM owners
        WHERE $3::boolean
          AND ($4::text[] IS NULL OR base_graves.cemetery_id = ANY($4::text[]))
          AND $1 <> ''
          AND owners.gravesite_uuid = base_graves.grave_uuid
          AND owners.deleted_at IS NULL
          AND owners.sale_date IS NOT NULL
          AND owners.sale_date::text LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Burial', COALESCE(NULLIF(concat_ws(' ', NULLIF(burials.first_name, ''), NULLIF(burials.last_name, '')), ''), burials.full_name)
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND lower(COALESCE(NULLIF(concat_ws(' ', NULLIF(burials.first_name, ''), NULLIF(burials.last_name, '')), ''), burials.full_name, '')) LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Birth', burials.birth_date::text
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND burials.birth_date IS NOT NULL
          AND burials.birth_date::text LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Death', burials.death_date::text
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND burials.death_date IS NOT NULL
          AND burials.death_date::text LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Burial date', burials.burial_date::text
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND burials.burial_date IS NOT NULL
          AND burials.burial_date::text LIKE '%' || $1 || '%'
      ) reasons ON reasons.reason_value IS NOT NULL
      ORDER BY
        base_graves.cemetery_name,
        base_graves.section_id,
        base_graves.lot_id,
        base_graves.grave_id,
        base_graves.gravesite_id,
        reasons.reason_label,
        reasons.reason_value
    `,
    [cleanedQuery, statuses, includeOwnership, scopedOwnershipCemeteryIds],
  );

  return groupSearchRows(result.rows, cleanedQuery);
}
