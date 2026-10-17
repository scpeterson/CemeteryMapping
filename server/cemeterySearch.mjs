import { normalizeSearchText } from "../shared/recordNormalization.mjs";
import { normalizedSearchSql, veteranSql } from "./searchNormalizationSql.mjs";
import { derivedGravesiteStatusSql } from "./gravesiteStatusSql.mjs";

const statusLabels = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  sold: "Sold",
  needs_review: "Needs review",
  unknown: "Unknown",
};

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

export async function searchCemetery(pool, { query = "", statuses = [], includeOwnership = true, ownershipCemeteryIds, cemeteryId, limit = 50, offset = 0 } = {}) {
  const cleanedQuery = normalizeSearchText(query);
  const scopedOwnershipCemeteryIds = ownershipCemeteryIds?.map((id) => String(id));
  const birthDateSearchValue = "COALESCE(burials.birth_date_text, burials.birth_date::text)";
  const deathDateSearchValue = "COALESCE(burials.death_date_text, burials.death_date::text)";
  const maidenNameSearchValue = "burials.maiden_name";
  const militaryBranchJoin = "LEFT JOIN military_branch_types ON military_branch_types.id = burials.military_branch_type_id";
  const militaryBranchValue = "military_branch_types.label";
  const militaryRankJoin = "LEFT JOIN military_rank_types ON military_rank_types.id = burials.military_rank_type_id";
  const militaryRankValue = "concat_ws(' ', military_rank_types.abbreviation, military_rank_types.label, military_rank_types.pay_grade)";
  const militaryWarServiceJoin = "LEFT JOIN military_war_service_types ON military_war_service_types.id = burials.military_war_service_type_id";
  const militaryWarServiceValue = "military_war_service_types.label";
  const militaryServiceSearchSql = `
        UNION ALL
        SELECT 'Military branch', ${militaryBranchValue}
        FROM burials
        ${militaryBranchJoin}
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${normalizedSearchSql(`coalesce(${militaryBranchValue}, '')`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Military rank', ${militaryRankValue}
        FROM burials
        ${militaryRankJoin}
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${normalizedSearchSql(`coalesce(${militaryRankValue}, '')`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'War service', ${militaryWarServiceValue}
        FROM burials
        ${militaryWarServiceJoin}
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${normalizedSearchSql(`coalesce(${militaryWarServiceValue}, '')`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Military decoration', military_decoration_types.label
        FROM burials
        JOIN burial_military_decorations ON burial_military_decorations.burial_uuid = burials.id
        JOIN military_decoration_types ON military_decoration_types.id = burial_military_decorations.military_decoration_type_id
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${normalizedSearchSql(`military_decoration_types.label`)} LIKE '%' || $1 || '%'
      `;
  const result = await pool.query(
    `
      WITH base_graves AS MATERIALIZED (
        SELECT
          gravesites.id AS grave_uuid,
          gravesites.cemetery_id::text,
          cemeteries.facility_id AS cemetery_facility_id,
          cemeteries.name AS cemetery_name,
          lots.name AS lot_name,
          gravesites.section_id,
          gravesites.lot_id,
          gravesites.grave_id,
          gravesites.gravesite_id,
          derived_status.status,
          COALESCE(derived_status_type.label, 'Unknown') AS status_label,
          ST_AsGeoJSON(gravesites.geometry)::json AS geometry
        FROM gravesites
        JOIN cemeteries
          ON cemeteries.id = gravesites.cemetery_id
        LEFT JOIN lots
          ON lots.id = gravesites.lot_uuid
         AND lots.deleted_at IS NULL
        LEFT JOIN gravesite_status_types status_type
          ON status_type.id = gravesites.status_type_id
        CROSS JOIN LATERAL (
          SELECT ${derivedGravesiteStatusSql()} AS status
        ) derived_status
        LEFT JOIN gravesite_status_types derived_status_type
          ON derived_status_type.code = derived_status.status
        WHERE gravesites.deleted_at IS NULL
          AND cemeteries.deleted_at IS NULL
          AND ($5::uuid IS NULL OR gravesites.cemetery_id = $5::uuid)
          AND (
            cardinality($2::text[]) = 0
            OR derived_status.status = ANY($2::text[])
          )
      ), matched_rows AS MATERIALIZED (
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
          AND ${normalizedSearchSql(`concat_ws('-', base_graves.section_id, base_graves.lot_id, base_graves.grave_id)`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Cemetery', base_graves.cemetery_name
        WHERE $1 <> ''
          AND ${normalizedSearchSql(`base_graves.cemetery_name`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Cemetery facility ID', base_graves.cemetery_facility_id
        WHERE $1 <> ''
          AND ${normalizedSearchSql(`coalesce(base_graves.cemetery_facility_id, '')`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Lot name', base_graves.lot_name
        WHERE $1 <> ''
          AND ${normalizedSearchSql(`coalesce(base_graves.lot_name, '')`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Lot number', base_graves.lot_id
        WHERE $1 <> ''
          AND ${normalizedSearchSql(`coalesce(base_graves.lot_id, '')`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Status', base_graves.status_label
        WHERE $1 <> ''
          AND ${normalizedSearchSql(`base_graves.status_label`)} LIKE '%' || $1 || '%'

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
          AND ${normalizedSearchSql(`owner_names.display_name`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Owner', current_ownership_right_owners.display_name
        FROM current_ownership_right_owners
        WHERE $3::boolean
          AND ($4::text[] IS NULL OR base_graves.cemetery_id = ANY($4::text[]))
          AND $1 <> ''
          AND current_ownership_right_owners.target_type = 'gravesite'
          AND current_ownership_right_owners.gravesite_uuid = base_graves.grave_uuid
          AND ${normalizedSearchSql(`current_ownership_right_owners.display_name`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Ownership date', current_ownership_right_owners.effective_date::text
        FROM current_ownership_right_owners
        WHERE $3::boolean
          AND ($4::text[] IS NULL OR base_graves.cemetery_id = ANY($4::text[]))
          AND $1 <> ''
          AND current_ownership_right_owners.target_type = 'gravesite'
          AND current_ownership_right_owners.gravesite_uuid = base_graves.grave_uuid
          AND current_ownership_right_owners.effective_date IS NOT NULL
          AND current_ownership_right_owners.effective_date::text LIKE '%' || $1 || '%'

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
        SELECT 'Burial', COALESCE(NULLIF(burials.display_name, ''), NULLIF(concat_ws(' ', NULLIF(burials.name_prefix, ''), NULLIF(burials.first_name, ''), NULLIF(${maidenNameSearchValue}, ''), NULLIF(burials.last_name, ''), NULLIF(burials.name_suffix, '')), ''), burials.full_name)
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${normalizedSearchSql(`concat_ws(' ', burials.display_name, burials.first_name, ${maidenNameSearchValue}, burials.last_name, burials.full_name)`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Birth', ${birthDateSearchValue}
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${birthDateSearchValue} IS NOT NULL
          AND ${normalizedSearchSql(`${birthDateSearchValue}`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Death', ${deathDateSearchValue}
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${deathDateSearchValue} IS NOT NULL
          AND ${normalizedSearchSql(`${deathDateSearchValue}`)} LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Burial date', burials.burial_date::text
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND burials.burial_date IS NOT NULL
          AND burials.burial_date::text LIKE '%' || $1 || '%'

        UNION ALL
        SELECT 'Veteran', COALESCE(NULLIF(burials.display_name, ''), NULLIF(concat_ws(' ', NULLIF(burials.name_prefix, ''), NULLIF(burials.first_name, ''), NULLIF(burials.last_name, ''), NULLIF(burials.name_suffix, '')), ''), burials.full_name, 'Veteran')
        FROM burials
        WHERE $1 <> ''
          AND burials.gravesite_uuid = base_graves.grave_uuid
          AND burials.deleted_at IS NULL
          AND ${veteranSql("burials.veteran")}
          AND 'veteran' LIKE '%' || $1 || '%'

        ${militaryServiceSearchSql}
      ) reasons ON reasons.reason_value IS NOT NULL
      ), page_graves AS (
        SELECT DISTINCT cemetery_id, cemetery_name, section_id, lot_id, grave_id, gravesite_id
        FROM matched_rows
        ORDER BY cemetery_name, section_id, lot_id, grave_id, gravesite_id, cemetery_id
        LIMIT $6::integer OFFSET $7::integer
      )
      SELECT matched_rows.*
      FROM page_graves
      JOIN matched_rows USING (cemetery_id, gravesite_id)
      ORDER BY page_graves.cemetery_name, page_graves.section_id, page_graves.lot_id,
        page_graves.grave_id, page_graves.gravesite_id, page_graves.cemetery_id,
        matched_rows.reason_label, matched_rows.reason_value
    `,
    [cleanedQuery, statuses, includeOwnership, scopedOwnershipCemeteryIds, cemeteryId ?? null, limit + 1, offset],
  );

  return groupSearchRows(result.rows, cleanedQuery);
}
