import { derivedGravesiteStatusSql } from "../gravesiteStatusSql.mjs";
import { optionalTextParameter, reportResult, requireTextParameter, scopedWhere } from "./shared.mjs";

export async function runOwnerHoldings(client, definition, parameters, cemeteryIds) {
  const ownerName = requireTextParameter(parameters, "ownerName", "Owner name", 250);
  const values = [`%${ownerName}%`];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const result = await client.query(
    `
      WITH matched_holdings AS (
        SELECT DISTINCT
          cemeteries.id AS cemetery_id,
          cemeteries.name AS cemetery,
          current_ownership_right_owners.display_name AS owner_name,
          current_ownership_right_owners.target_type,
          CASE
            WHEN current_ownership_right_owners.target_type = 'lot' THEN concat_ws('-', NULLIF(lots.section_id, ''), NULLIF(lots.lot_id, ''))
            ELSE concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, ''))
          END AS record_label,
          current_ownership_right_owners.effective_date,
          current_ownership_right_owners.event_type,
          ownership_events.document_reference,
          ownership_events.notes AS remarks
        FROM current_ownership_right_owners
        JOIN ownership_events
          ON ownership_events.id = current_ownership_right_owners.ownership_event_uuid
        LEFT JOIN gravesites
          ON current_ownership_right_owners.target_type = 'gravesite'
         AND gravesites.id = current_ownership_right_owners.gravesite_uuid
        LEFT JOIN lots
          ON current_ownership_right_owners.target_type = 'lot'
         AND lots.id = current_ownership_right_owners.lot_uuid
        JOIN cemeteries
          ON cemeteries.id = COALESCE(gravesites.cemetery_id, lots.cemetery_id, current_ownership_right_owners.cemetery_id)
        WHERE lower(current_ownership_right_owners.display_name) LIKE lower($1)
          AND current_ownership_right_owners.target_type IN ('lot', 'gravesite')
          ${scope}

        UNION ALL

        SELECT DISTINCT
          cemeteries.id AS cemetery_id,
          cemeteries.name AS cemetery,
          matched_legacy.owner_name,
          'gravesite' AS target_type,
          concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS record_label,
          owners.sale_date AS effective_date,
          'purchase' AS event_type,
          NULL::text AS document_reference,
          owners.notes AS remarks
        FROM owners
        JOIN gravesites
          ON gravesites.id = owners.gravesite_uuid
        JOIN cemeteries
          ON cemeteries.id = gravesites.cemetery_id
        CROSS JOIN LATERAL (
          SELECT owners.owner AS owner_name WHERE lower(owners.owner) LIKE lower($1)
          UNION ALL
          SELECT owners.co_owner AS owner_name WHERE lower(owners.co_owner) LIKE lower($1)
        ) matched_legacy
        WHERE owners.deleted_at IS NULL
          AND gravesites.deleted_at IS NULL
          ${scope}
      )
      SELECT cemetery, owner_name, target_type, record_label, effective_date, event_type, document_reference, remarks
      FROM matched_holdings
      ORDER BY target_type, record_label, owner_name
    `,
    values,
  );
  const lotCount = new Set(result.rows.filter((row) => row.target_type === "lot").map((row) => `${row.cemetery}:${row.record_label}`)).size;
  const gravesiteCount = new Set(result.rows.filter((row) => row.target_type === "gravesite").map((row) => `${row.cemetery}:${row.record_label}`)).size;
  const cemeteryNames = [...new Set(result.rows.map((row) => row.cemetery).filter(Boolean))];
  const isSingleCemetery = cemeteryNames.length === 1;

  return reportResult({
    definition,
    summary: `${lotCount} lot${lotCount === 1 ? "" : "s"} and ${gravesiteCount} gravesite${gravesiteCount === 1 ? "" : "s"} matched "${ownerName}".`,
    subtitle: isSingleCemetery ? cemeteryNames[0] : undefined,
    columns: [
      { key: "owner_name", label: "Owner" },
      { key: "target_type", label: "Type" },
      { key: "record_label", label: "Record" },
      { key: "effective_date", label: "Date" },
      { key: "event_type", label: "Event" },
      { key: "document_reference", label: "Document" },
      ...(isSingleCemetery ? [] : [{ key: "cemetery", label: "Cemetery" }]),
      { key: "remarks", label: "Remarks" },
    ],
    rows: result.rows,
  });
}

export async function runUnownedGravesites(client, definition, parameters, cemeteryIds) {
  const sectionName = optionalTextParameter(parameters, "sectionName", 80);
  const status = optionalTextParameter(parameters, "status", 50);
  const values = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);
  let sectionFilter = "";
  let statusFilter = "";
  if (sectionName) {
    values.push(sectionName);
    sectionFilter = `AND lower(gravesites.section_id) = lower($${values.length})`;
  }
  const derivedStatus = derivedGravesiteStatusSql();
  if (status) {
    values.push(status);
    statusFilter = `WHERE lower(unowned.status) = lower($${values.length})`;
  }

  const result = await client.query(
    `
      WITH unowned AS (
        SELECT
          cemeteries.name AS cemetery,
          gravesites.section_id AS section,
          concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS gravesite,
          gravesites.gravesite_id AS record_id,
          CASE
            WHEN gravesites.lot_uuid IS NULL THEN 'No lot assigned'
            ELSE concat_ws('-', NULLIF(lots.section_id, ''), NULLIF(lots.lot_id, ''))
          END AS assigned_lot,
          ${derivedStatus} AS status,
          gravesites.geometry_confidence,
          (
            SELECT string_agg(burial_names.name, ', ' ORDER BY burial_names.name)
            FROM (
              SELECT DISTINCT COALESCE(
                NULLIF(burials.full_name, ''),
                NULLIF(btrim(concat_ws(' ', burials.first_name, burials.maiden_name, burials.last_name, burials.name_suffix)), '')
              ) AS name
              FROM burials
              WHERE burials.gravesite_uuid = gravesites.id
                AND burials.deleted_at IS NULL
            ) burial_names
            WHERE burial_names.name IS NOT NULL
          ) AS burials,
          (
            SELECT string_agg(marker_ids.marker_id, ', ' ORDER BY marker_ids.marker_id)
            FROM (
              SELECT DISTINCT headstones.headstone_id AS marker_id
              FROM headstones
              LEFT JOIN headstone_gravesites
                ON headstone_gravesites.headstone_uuid = headstones.id
               AND headstone_gravesites.deleted_at IS NULL
              WHERE headstones.deleted_at IS NULL
                AND (headstones.gravesite_uuid = gravesites.id OR headstone_gravesites.gravesite_uuid = gravesites.id)
            ) marker_ids
            WHERE marker_ids.marker_id IS NOT NULL
          ) AS markers,
          gravesites.geometry_notes AS remarks
        FROM gravesites
        JOIN cemeteries
          ON cemeteries.id = gravesites.cemetery_id
        LEFT JOIN lots
          ON lots.id = gravesites.lot_uuid
         AND lots.deleted_at IS NULL
        LEFT JOIN gravesite_status_types status_type
          ON status_type.id = gravesites.status_type_id
        WHERE gravesites.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM owners legacy_owner
            WHERE legacy_owner.gravesite_uuid = gravesites.id
              AND legacy_owner.deleted_at IS NULL
          )
          AND NOT EXISTS (
            SELECT 1
            FROM current_ownership_right_owners current_owner
            WHERE (current_owner.target_type = 'gravesite' AND current_owner.gravesite_uuid = gravesites.id)
               OR (current_owner.target_type = 'lot' AND current_owner.lot_uuid = gravesites.lot_uuid)
          )
          ${scope}
          ${sectionFilter}
      )
      SELECT cemetery, section, gravesite, record_id, assigned_lot, status, geometry_confidence, burials, markers, remarks
      FROM unowned
      ${statusFilter}
      ORDER BY cemetery, section, gravesite
    `,
    values,
  );
  const cemeteryNames = [...new Set(result.rows.map((row) => row.cemetery).filter(Boolean))];
  const isSingleCemetery = cemeteryNames.length === 1;

  return reportResult({
    definition,
    summary: `${result.rows.length} gravesite${result.rows.length === 1 ? " has" : "s have"} no current direct or whole-lot owner recorded.`,
    subtitle: isSingleCemetery ? cemeteryNames[0] : undefined,
    columns: [
      { key: "gravesite", label: "Gravesite" },
      { key: "record_id", label: "Record ID" },
      { key: "assigned_lot", label: "Assigned lot" },
      { key: "status", label: "Status" },
      { key: "burials", label: "Burials" },
      { key: "markers", label: "Markers" },
      { key: "geometry_confidence", label: "Geometry confidence" },
      { key: "remarks", label: "Remarks" },
      ...(isSingleCemetery ? [] : [{ key: "cemetery", label: "Cemetery" }]),
    ],
    rows: result.rows,
    notes: ["No owner found means no current ownership record exists in the application; it does not prove the gravesite was never deeded."],
  });
}
