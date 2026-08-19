import { optionalPositiveIntegerParameter, optionalTextParameter, reportResult, scopedWhere } from "./shared.mjs";

export async function runMaintenanceNeeds(client, definition, parameters, cemeteryIds) {
  const daysSinceCleaned = optionalPositiveIntegerParameter(parameters, "daysSinceCleaned");
  const values = [];

  if (daysSinceCleaned) {
    const scope = scopedWhere("marker_scope.cemetery_id", values, cemeteryIds);
    values.push(daysSinceCleaned);
    const daysParam = `$${values.length}`;
    const result = await client.query(
      `
        WITH marker_scope AS (
          SELECT
            headstones.id,
            headstones.headstone_id,
            cemeteries.id AS cemetery_id,
            cemeteries.name AS cemetery,
            COALESCE(primary_gravesite.gravesite_id, linked_gravesite.gravesite_id) AS gravesite_id,
            COALESCE(primary_gravesite.section_id, linked_gravesite.section_id) AS section_id,
            COALESCE(primary_gravesite.grave_id, linked_gravesite.grave_id) AS grave_id
          FROM headstones
          LEFT JOIN gravesites primary_gravesite
            ON primary_gravesite.id = headstones.gravesite_uuid
           AND primary_gravesite.deleted_at IS NULL
          LEFT JOIN LATERAL (
            SELECT gravesites.cemetery_id, gravesites.gravesite_id, gravesites.section_id, gravesites.grave_id
            FROM headstone_gravesites
            JOIN gravesites
              ON gravesites.id = headstone_gravesites.gravesite_uuid
             AND gravesites.deleted_at IS NULL
            WHERE headstone_gravesites.headstone_uuid = headstones.id
              AND headstone_gravesites.deleted_at IS NULL
            ORDER BY gravesites.gravesite_id
            LIMIT 1
          ) linked_gravesite ON true
          JOIN cemeteries
            ON cemeteries.id = COALESCE(primary_gravesite.cemetery_id, linked_gravesite.cemetery_id)
          WHERE headstones.deleted_at IS NULL
            AND cemeteries.deleted_at IS NULL
            ${scope}
        ),
        last_cleaned AS (
          SELECT
            maintenance_records.headstone_uuid,
            max(COALESCE(maintenance_records.completed_at, maintenance_records.observed_at)) AS last_cleaned_at
          FROM maintenance_records
          JOIN maintenance_action_types
            ON maintenance_action_types.id = maintenance_records.action_type_id
          WHERE maintenance_records.deleted_at IS NULL
            AND maintenance_records.status = 'completed'
            AND maintenance_action_types.code = 'cleaned'
          GROUP BY maintenance_records.headstone_uuid
        )
        SELECT
          marker_scope.cemetery,
          'headstone' AS target_type,
          marker_scope.headstone_id AS target,
          concat_ws('-', NULLIF(marker_scope.section_id, ''), NULLIF(marker_scope.grave_id, '')) AS grave,
          last_cleaned.last_cleaned_at,
          CASE
            WHEN last_cleaned.last_cleaned_at IS NULL THEN NULL
            ELSE (CURRENT_DATE - last_cleaned.last_cleaned_at)::int
          END AS days_since_cleaned
        FROM marker_scope
        LEFT JOIN last_cleaned
          ON last_cleaned.headstone_uuid = marker_scope.id
        WHERE last_cleaned.last_cleaned_at IS NULL
          OR last_cleaned.last_cleaned_at < CURRENT_DATE - (${daysParam}::int * INTERVAL '1 day')
        ORDER BY last_cleaned.last_cleaned_at NULLS FIRST, marker_scope.cemetery, marker_scope.headstone_id
      `,
      values,
    );

    return reportResult({
      definition,
      summary: `${result.rows.length} marker${result.rows.length === 1 ? "" : "s"} have not been cleaned in ${daysSinceCleaned} day${daysSinceCleaned === 1 ? "" : "s"}.`,
      columns: [
        { key: "target", label: "Marker" },
        { key: "grave", label: "Grave" },
        { key: "last_cleaned_at", label: "Last cleaned" },
        { key: "days_since_cleaned", label: "Days" },
        { key: "cemetery", label: "Cemetery" },
      ],
      rows: result.rows,
      notes: ["Markers with no completed cleaning record are included."],
    });
  }

  const status = optionalTextParameter(parameters, "status", 30) || "open";
  const targetType = optionalTextParameter(parameters, "targetType", 30);
  const issueCode = optionalTextParameter(parameters, "issueCode", 50);
  const actionCode = optionalTextParameter(parameters, "actionCode", 50);
  const scope = scopedWhere("maintenance_records.cemetery_id", values, cemeteryIds);
  const filters = [scope];
  if (status && status !== "all") {
    values.push(status);
    filters.push(` AND maintenance_records.status = $${values.length}`);
  }
  if (targetType && targetType !== "all") {
    filters.push(targetType === "headstone" ? " AND maintenance_records.headstone_uuid IS NOT NULL" : " AND maintenance_records.gravesite_uuid IS NOT NULL");
  }
  if (issueCode) {
    values.push(issueCode);
    filters.push(` AND maintenance_issue_types.code = $${values.length}`);
  }
  if (actionCode) {
    values.push(actionCode);
    filters.push(` AND maintenance_action_types.code = $${values.length}`);
  }

  const result = await client.query(
    `
      SELECT
        cemeteries.name AS cemetery,
        CASE WHEN maintenance_records.headstone_uuid IS NOT NULL THEN 'headstone' ELSE 'gravesite' END AS target_type,
        COALESCE(headstones.headstone_id, gravesites.gravesite_id) AS target,
        concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS grave,
        maintenance_issue_types.label AS issue,
        maintenance_action_types.label AS action,
        maintenance_priority_types.label AS priority,
        maintenance_records.status,
        maintenance_records.observed_at,
        maintenance_records.completed_at,
        maintenance_records.performed_by,
        maintenance_records.notes
      FROM maintenance_records
      JOIN cemeteries
        ON cemeteries.id = maintenance_records.cemetery_id
      LEFT JOIN gravesites
        ON gravesites.id = maintenance_records.gravesite_uuid
      LEFT JOIN headstones
        ON headstones.id = maintenance_records.headstone_uuid
      LEFT JOIN maintenance_issue_types
        ON maintenance_issue_types.id = maintenance_records.issue_type_id
      LEFT JOIN maintenance_action_types
        ON maintenance_action_types.id = maintenance_records.action_type_id
      JOIN maintenance_priority_types
        ON maintenance_priority_types.id = maintenance_records.priority_type_id
      WHERE maintenance_records.deleted_at IS NULL
        ${filters.join("")}
      ORDER BY
        maintenance_priority_types.sort_order DESC,
        maintenance_records.observed_at DESC,
        cemetery,
        target
    `,
    values,
  );

  return reportResult({
    definition,
    summary: `${result.rows.length} maintenance record${result.rows.length === 1 ? "" : "s"} matched.`,
    columns: [
      { key: "target_type", label: "Type" },
      { key: "target", label: "Target" },
      { key: "grave", label: "Grave" },
      { key: "issue", label: "Issue" },
      { key: "action", label: "Action" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
      { key: "observed_at", label: "Observed" },
      { key: "completed_at", label: "Completed" },
      { key: "performed_by", label: "By" },
      { key: "cemetery", label: "Cemetery" },
      { key: "notes", label: "Notes" },
    ],
    rows: result.rows,
  });
}

export function runDeedClaimTraceGuide(definition, parameters) {
  const claimantName = optionalTextParameter(parameters, "claimantName", 250);
  const subject = claimantName ? ` for ${claimantName}` : "";
  const rows = [
    {
      step: 1,
      area: "Identify the claimed lot",
      action: "Search deed registry evidence, owner names, family surnames, lot hints, and related grave labels.",
      output: "Candidate lot, gravesites, and matching evidence entries.",
    },
    {
      step: 2,
      area: "Check current rights",
      action: "Review current ownership events for the lot and any individual gravesites inside it.",
      output: "Current owner, right type, event date, document reference, and release history.",
    },
    {
      step: 3,
      area: "Check use of the lot",
      action: "Inspect burials and headstone links for every gravesite in the lot.",
      output: "Used, unused, reserved, and conflicting gravesites.",
    },
    {
      step: 4,
      area: "Establish chain of title",
      action: "Compare the claimant's parents or family name against prior events, legacy owner rows, and scanned evidence.",
      output: "Evidence chain from original deed holder to current claimant.",
    },
    {
      step: 5,
      area: "Record the decision",
      action: "Create or update a deed investigation case, link supporting evidence, and record a corrective ownership event if approved.",
      output: "Audited investigation notes and a documented ownership decision.",
    },
  ];

  return reportResult({
    definition,
    summary: `Trace deed claim${subject} by linking evidence, ownership history, and actual lot usage.`,
    columns: [
      { key: "step", label: "Step" },
      { key: "area", label: "Area" },
      { key: "action", label: "Action" },
      { key: "output", label: "Output" },
    ],
    rows,
    notes: ["This guide does not grant ownership by itself. It organizes the evidence an admin should review before recording a decision."],
  });
}
