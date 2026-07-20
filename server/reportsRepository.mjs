import { derivedGravesiteStatusSql } from "./gravesiteStatusSql.mjs";

const roleRank = new Map([
  ["reader", 1],
  ["power-user", 2],
  ["cemetery-admin", 3],
  ["admin", 4],
]);

const reportDefinitions = [
  {
    id: "burial-date-extremes",
    title: "Oldest and latest burials",
    description: "Finds the earliest and most recent recorded burial dates.",
    category: "Burials",
    requiredRole: "reader",
    parameters: [],
    examples: ["What is the oldest burial in the cemetery?", "What is the latest burial?"],
  },
  {
    id: "veteran-service-summary",
    title: "Veteran service summary",
    description: "Counts veteran burials and groups them by branch and war service.",
    category: "Veterans",
    requiredRole: "reader",
    parameters: [],
    examples: ["How many veterans are buried here?", "What wars did veterans serve in?", "What service branches were they in?"],
  },
  {
    id: "spatial-inventory-counts",
    title: "Spatial inventory counts",
    description: "Counts markers and gravesites by cemetery and optional section.",
    category: "Inventory",
    requiredRole: "reader",
    parameters: [{ name: "sectionName", label: "Section", type: "text", required: false }],
    examples: [
      "How many markers are in section C?",
      "How many markers are in the cemetery?",
      "How many gravesites are in section C?",
      "How many gravesites are in the cemetery?",
    ],
  },
  {
    id: "marker-type-inventory",
    title: "Markers by type",
    description: "Lists markers grouped by marker type, cemetery, and optional section.",
    category: "Inventory",
    requiredRole: "reader",
    parameters: [
      { name: "sectionName", label: "Section", type: "text", required: false },
      { name: "markerType", label: "Marker type", type: "text", required: false },
    ],
    examples: ["List markers by type.", "What marker types are in section C?", "List flat markers."],
  },
  {
    id: "marker-burial-pages",
    title: "Marker burial pages",
    description: "Creates one printable page per burial linked to a marker, including marker photo, marker details, burial details, and NHG text.",
    category: "Burials",
    requiredRole: "reader",
    parameters: [
      { name: "markerId", label: "Marker ID", type: "text", required: false },
      { name: "personName", label: "Burial name", type: "text", required: false },
      { name: "sectionName", label: "Section", type: "text", required: false },
    ],
    examples: ["Print burial pages for marker TLC-HS-0228.", "Show marker burial pages for Schug.", "Print marker burial pages for section C."],
  },
  {
    id: "owner-holdings",
    title: "Owner holdings",
    description: "Lists lots and gravesites currently associated with an owner name.",
    category: "Ownership",
    requiredRole: "power-user",
    parameters: [{ name: "ownerName", label: "Owner name", type: "text", required: true }],
    examples: ["How many lots are owned by Smith?", "How many gravesites are owned by Maria Garcia?"],
  },
  {
    id: "available-inventory",
    title: "Available lots and gravesites",
    description: "Lists gravesites and whole lots that appear available for purchase.",
    category: "Inventory",
    requiredRole: "power-user",
    parameters: [],
    examples: ["What lots are available for purchase?", "What gravesites are available?"],
  },
  {
    id: "maintenance-needs",
    title: "Maintenance needs",
    description: "Lists open maintenance issues, completed work, or markers not cleaned within a selected time period.",
    category: "Maintenance",
    requiredRole: "power-user",
    parameters: [
      { name: "status", label: "Status", type: "text", required: false },
      { name: "targetType", label: "Target type", type: "text", required: false },
      { name: "issueCode", label: "Issue", type: "text", required: false },
      { name: "actionCode", label: "Action", type: "text", required: false },
      { name: "daysSinceCleaned", label: "Days since cleaned", type: "text", required: false },
    ],
    examples: [
      "Which markers are illegible?",
      "Which markers are listing or broken?",
      "Which gravesites need grass planted?",
      "Which gravesites need leveling?",
      "What markers have not been cleaned in a year?",
    ],
  },
  {
    id: "deed-claim-trace-guide",
    title: "Deed claim trace guide",
    description: "Outlines the records to inspect when someone claims inherited lot rights without paperwork.",
    category: "Investigations",
    requiredRole: "cemetery-admin",
    parameters: [{ name: "claimantName", label: "Claimant or family name", type: "text", required: false }],
    examples: ["How do we trace a deed claim with no paperwork?", "Parents owned a deed but the family has no documents."],
  },
];

function canRun(role, requiredRole) {
  return (roleRank.get(role) ?? 0) >= (roleRank.get(requiredRole) ?? Number.POSITIVE_INFINITY);
}

function toDefinition(definition) {
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    category: definition.category,
    requiredRole: definition.requiredRole,
    parameters: definition.parameters,
    examples: definition.examples,
  };
}

function definitionById(id) {
  return reportDefinitions.find((definition) => definition.id === id);
}

function compactText(value, maxLength = 250) {
  const text = String(value ?? "").trim().replace(/\s+/gu, " ");
  return text.slice(0, maxLength);
}

function optionalTextParameter(parameters, name, maxLength = 250) {
  return compactText(parameters?.[name], maxLength);
}

function requireTextParameter(parameters, name, label, maxLength = 250) {
  const text = optionalTextParameter(parameters, name, maxLength);
  if (!text) {
    const error = new Error(`${label} is required.`);
    error.code = "REPORT_PARAMETER_REQUIRED";
    throw error;
  }
  return text;
}

function optionalPositiveIntegerParameter(parameters, name, max = 3650) {
  const text = optionalTextParameter(parameters, name, 20);
  if (!text) return undefined;
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value) || value < 1 || value > max) {
    const error = new Error(`${name} must be between 1 and ${max}.`);
    error.code = "REPORT_PARAMETER_INVALID";
    throw error;
  }
  return value;
}

function assignedCemeteryIds(user) {
  return Array.isArray(user?.cemeteryAccess) ? [...new Set(user.cemeteryAccess.map((assignment) => assignment.cemeteryId).filter(Boolean))] : [];
}

function selectedAdminCemeteryId(parameters) {
  const cemeteryId = optionalTextParameter(parameters, "cemeteryId", 80);
  if (!cemeteryId || cemeteryId === "__all") return "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(cemeteryId)) {
    const error = new Error("Cemetery filter must be a UUID.");
    error.code = "REPORT_PARAMETER_INVALID";
    throw error;
  }
  return cemeteryId;
}

function reportCemeteryIds(user) {
  if (user?.role === "admin") return undefined;
  return assignedCemeteryIds(user);
}

function selectedReportCemeteryIds(user, parameters) {
  if (user?.role !== "admin") return reportCemeteryIds(user);
  const cemeteryId = selectedAdminCemeteryId(parameters);
  return cemeteryId ? [cemeteryId] : undefined;
}

function scopedWhere(columnName, values, cemeteryIds) {
  if (!cemeteryIds) return "";
  if (cemeteryIds.length === 0) return " AND false";
  values.push(cemeteryIds);
  return ` AND ${columnName} = ANY($${values.length}::uuid[])`;
}

function reportResult({ definition, summary, columns, rows, notes = [], layout }) {
  return {
    report: toDefinition(definition),
    summary,
    columns,
    rows,
    notes,
    generatedAt: new Date().toISOString(),
    ...(layout ? { layout } : {}),
  };
}

async function runMarkerBurialPages(client, definition, parameters, cemeteryIds) {
  const markerId = optionalTextParameter(parameters, "markerId", 80);
  const personName = optionalTextParameter(parameters, "personName", 120);
  const sectionName = optionalTextParameter(parameters, "sectionName", 80);
  const values = [];
  const filters = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);

  if (markerId) {
    values.push(`%${markerId}%`);
    filters.push(`headstones.headstone_id ILIKE $${values.length}`);
  }
  if (personName) {
    values.push(`%${personName}%`);
    filters.push(`COALESCE(NULLIF(burials.full_name, ''), concat_ws(' ', NULLIF(burials.first_name, ''), NULLIF(burials.last_name, ''))) ILIKE $${values.length}`);
  }
  if (sectionName) {
    values.push(sectionName);
    filters.push(`upper(gravesites.section_id) = upper($${values.length})`);
  }

  const result = await client.query(
    `
      SELECT
        headstones.id::text AS marker_uuid,
        headstones.headstone_id AS marker_id,
        cemeteries.name AS cemetery,
        gravesites.section_id AS section,
        gravesites.gravesite_id,
        concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS grave,
        COALESCE(NULLIF(marker_types.label, ''), marker_types.code) AS marker_type,
        COALESCE(NULLIF(marker_material_types.label, ''), marker_material_types.code) AS marker_material,
        COALESCE(NULLIF(headstone_condition_types.label, ''), headstone_condition_types.code) AS marker_condition,
        headstones.inscription,
        headstones.design_notes,
        headstones.back_description,
        headstones.condition_notes,
        COALESCE(marker_photo.file_url, NULLIF(headstones.photo_url, '')) AS photo_url,
        burials.id::text AS burial_uuid,
        COALESCE(NULLIF(burials.full_name, ''), concat_ws(' ', NULLIF(burials.first_name, ''), NULLIF(burials.maiden_name, ''), NULLIF(burials.last_name, ''))) AS person,
        burials.first_name,
        burials.last_name,
        burials.maiden_name,
        COALESCE(burials.birth_date_text, burials.birth_date::text) AS birth_date,
        COALESCE(burials.death_date_text, burials.death_date::text) AS death_date,
        burials.burial_date,
        burial_interment_types.label AS interment_type,
        burial_record_status_types.label AS record_status,
        burials.funeral_home,
        burials.veteran,
        military_branch_types.label AS military_branch,
        military_rank_types.label AS military_rank,
        military_war_service_types.label AS military_war_service,
        burials.notes AS burial_notes,
        nhg_evidence.nhg_text
      FROM headstones
      JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      JOIN burials
        ON burials.id = headstone_burials.burial_uuid
       AND burials.deleted_at IS NULL
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
       AND gravesites.deleted_at IS NULL
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
       AND cemeteries.deleted_at IS NULL
      LEFT JOIN marker_types ON marker_types.id = headstones.marker_type_id
      LEFT JOIN marker_material_types ON marker_material_types.id = headstones.material_type_id
      LEFT JOIN headstone_condition_types ON headstone_condition_types.id = headstones.condition_type_id
      LEFT JOIN burial_interment_types ON burial_interment_types.id = burials.interment_type_id
      LEFT JOIN burial_record_status_types ON burial_record_status_types.id = burials.burial_record_status_type_id
      LEFT JOIN military_branch_types ON military_branch_types.id = burials.military_branch_type_id
      LEFT JOIN military_rank_types ON military_rank_types.id = burials.military_rank_type_id
      LEFT JOIN military_war_service_types ON military_war_service_types.id = burials.military_war_service_type_id
      LEFT JOIN LATERAL (
        SELECT media_assets.file_url
        FROM headstone_media_assets
        JOIN media_assets ON media_assets.id = headstone_media_assets.media_asset_id
        WHERE headstone_media_assets.headstone_uuid = headstones.id
          AND headstone_media_assets.deleted_at IS NULL
          AND headstone_media_assets.status = 'linked'
          AND media_assets.deleted_at IS NULL
          AND media_assets.status = 'linked'
          AND media_assets.asset_type = 'photo'
        ORDER BY headstone_media_assets.display_order, media_assets.captured_at DESC NULLS LAST, media_assets.uploaded_at DESC
        LIMIT 1
      ) marker_photo ON true
      LEFT JOIN LATERAL (
        SELECT string_agg(
          concat_ws(' ', CASE WHEN entries.source_page_number IS NOT NULL THEN 'Page ' || entries.source_page_number || ':' END, entries.raw_text),
          E'\n\n' ORDER BY entries.source_page_number NULLS LAST, entries.source_line_start, entries.id
        ) AS nhg_text
        FROM north_hills_ocr_entries entries
        WHERE EXISTS (
          SELECT 1
          FROM north_hills_ocr_entry_headstone_links links
          WHERE links.entry_id = entries.id
            AND links.headstone_uuid = headstones.id
            AND links.status = 'linked'
        ) OR EXISTS (
          SELECT 1
          FROM north_hills_ocr_entry_gravesite_links links
          WHERE links.entry_id = entries.id
            AND links.gravesite_uuid = gravesites.id
            AND links.status = 'linked'
        )
      ) nhg_evidence ON true
      WHERE headstones.deleted_at IS NULL
        ${scope}
        ${filters.length ? `AND ${filters.join(" AND ")}` : ""}
      ORDER BY cemeteries.name, gravesites.section_id, headstones.headstone_id, person, burials.id
    `,
    values,
  );

  return reportResult({
    definition,
    summary: `${result.rows.length} burial page${result.rows.length === 1 ? "" : "s"} generated.`,
    columns: [],
    rows: result.rows,
    layout: "marker-burial-pages",
    notes: ["Each burial linked to a marker begins on a separate printed page."],
  });
}

async function runBurialDateExtremes(client, definition, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);
  const result = await client.query(
    `
    WITH eligible_burials AS (
      SELECT
        cemeteries.name AS cemetery,
        concat_ws('-', NULLIF(gravesites.section_id, ''), NULLIF(gravesites.grave_id, '')) AS grave,
        gravesites.gravesite_id,
        COALESCE(NULLIF(burials.full_name, ''), concat_ws(' ', NULLIF(burials.first_name, ''), NULLIF(burials.last_name, ''))) AS person,
        burials.burial_date,
        COALESCE(burials.death_date_text, burials.death_date::text) AS death_date,
        burials.death_date AS death_date_sort
      FROM burials
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      WHERE burials.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
        AND burials.burial_date IS NOT NULL
        ${scope}
    )
    (
      SELECT 'Oldest burial' AS result, cemetery, grave, gravesite_id, person, burial_date, death_date
      FROM eligible_burials
      ORDER BY burial_date ASC, death_date_sort ASC NULLS LAST, death_date ASC NULLS LAST, person
      LIMIT 1
    )
    UNION ALL
    (
      SELECT 'Latest burial' AS result, cemetery, grave, gravesite_id, person, burial_date, death_date
      FROM eligible_burials
      ORDER BY burial_date DESC, death_date_sort DESC NULLS LAST, death_date DESC NULLS LAST, person
      LIMIT 1
    )
  `,
    values,
  );

  return reportResult({
    definition,
    summary: result.rows.length ? "Earliest and most recent recorded burial dates." : "No burial dates are recorded.",
    columns: [
      { key: "result", label: "Result" },
      { key: "person", label: "Person" },
      { key: "burial_date", label: "Burial date" },
      { key: "death_date", label: "Death date" },
      { key: "grave", label: "Grave" },
      { key: "cemetery", label: "Cemetery" },
    ],
    rows: result.rows,
    notes: ["Only burials with a recorded burial date are included."],
  });
}

async function runVeteranServiceSummary(client, definition, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);
  const result = await client.query(
    `
    WITH veteran_burials AS (
      SELECT
        burials.id,
        COALESCE(military_branch_types.label, 'Unknown/not recorded') AS branch,
        COALESCE(military_war_service_types.label, 'Unknown/not recorded') AS war_service
      FROM burials
      JOIN gravesites
        ON gravesites.id = burials.gravesite_uuid
      LEFT JOIN military_branch_types
        ON military_branch_types.id = burials.military_branch_type_id
      LEFT JOIN military_war_service_types
        ON military_war_service_types.id = burials.military_war_service_type_id
      WHERE burials.deleted_at IS NULL
        AND gravesites.deleted_at IS NULL
        AND lower(btrim(coalesce(burials.veteran, ''))) IN ('yes', 'y', 'true', '1', 'veteran')
        ${scope}
    )
    SELECT 'Summary' AS group_name, 'Veteran burials' AS label, count(*)::int AS count
    FROM veteran_burials
    UNION ALL
    SELECT 'Military branch' AS group_name, branch AS label, count(*)::int AS count
    FROM veteran_burials
    GROUP BY branch
    UNION ALL
    SELECT 'War service' AS group_name, war_service AS label, count(*)::int AS count
    FROM veteran_burials
    GROUP BY war_service
    ORDER BY group_name, count DESC, label
  `,
    values,
  );
  const total = result.rows.find((row) => row.group_name === "Summary")?.count ?? 0;

  return reportResult({
    definition,
    summary: `${total} veteran burial${total === 1 ? "" : "s"} recorded.`,
    columns: [
      { key: "group_name", label: "Group" },
      { key: "label", label: "Value" },
      { key: "count", label: "Count" },
    ],
    rows: result.rows,
    notes: ["Branch and war service are grouped as Unknown/not recorded when no lookup value is set."],
  });
}

async function runSpatialInventoryCounts(client, definition, parameters, cemeteryIds) {
  const sectionName = optionalTextParameter(parameters, "sectionName", 80);
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const sectionFilters = [];
  if (sectionName) {
    values.push(sectionName);
    sectionFilters.push(`upper(section) = upper($${values.length})`);
  }
  const markerSectionWhere = sectionFilters.length ? `WHERE ${sectionFilters.join(" AND ")}` : "";
  const gravesiteSectionWhere = sectionFilters.length ? `WHERE ${sectionFilters.join(" AND ")}` : "";
  const finalSectionWhere = sectionFilters.length ? `WHERE ${sectionFilters.join(" AND ")}` : "";

  const result = await client.query(
    `
      WITH active_cemeteries AS (
        SELECT cemeteries.id, cemeteries.name, cemeteries.geometry
        FROM cemeteries
        WHERE cemeteries.deleted_at IS NULL
          ${scope}
      ),
      active_sections AS (
        SELECT sections.section_id, sections.cemetery_id, sections.name, sections.geometry
        FROM sections
        JOIN active_cemeteries
          ON active_cemeteries.id = sections.cemetery_id
        WHERE sections.deleted_at IS NULL
      ),
      marker_locations AS (
        SELECT DISTINCT
          headstones.id AS marker_uuid,
          active_cemeteries.name AS cemetery,
          COALESCE(NULLIF(linked_gravesites.section_id, ''), NULLIF(covering_sections.name, ''), 'Unsectioned') AS section
        FROM headstones
        LEFT JOIN gravesites linked_gravesites
          ON linked_gravesites.id = headstones.gravesite_uuid
         AND linked_gravesites.deleted_at IS NULL
        JOIN active_cemeteries
          ON active_cemeteries.id = linked_gravesites.cemetery_id
          OR (
            linked_gravesites.id IS NULL
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_cemeteries.geometry, headstones.geometry)
          )
        LEFT JOIN LATERAL (
          SELECT active_sections.name
          FROM active_sections
          WHERE active_sections.cemetery_id = active_cemeteries.id
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_sections.geometry, headstones.geometry)
          ORDER BY active_sections.name
          LIMIT 1
        ) covering_sections ON true
        WHERE headstones.deleted_at IS NULL
      ),
      filtered_marker_locations AS (
        SELECT cemetery, section, marker_uuid
        FROM marker_locations
        ${markerSectionWhere}
      ),
      marker_counts AS (
        SELECT cemetery, section, count(DISTINCT marker_uuid)::int AS marker_count
        FROM filtered_marker_locations
        GROUP BY cemetery, section
      ),
      gravesite_locations AS (
        SELECT
          active_cemeteries.name AS cemetery,
          COALESCE(NULLIF(gravesites.section_id, ''), 'Unsectioned') AS section,
          gravesites.id AS gravesite_uuid
        FROM gravesites
        JOIN active_cemeteries
          ON active_cemeteries.id = gravesites.cemetery_id
        WHERE gravesites.deleted_at IS NULL
      ),
      filtered_gravesite_locations AS (
        SELECT cemetery, section, gravesite_uuid
        FROM gravesite_locations
        ${gravesiteSectionWhere}
      ),
      gravesite_counts AS (
        SELECT cemetery, section, count(DISTINCT gravesite_uuid)::int AS gravesite_count
        FROM filtered_gravesite_locations
        GROUP BY cemetery, section
      ),
      combined_counts AS (
        SELECT
          COALESCE(marker_counts.cemetery, gravesite_counts.cemetery) AS cemetery,
          COALESCE(marker_counts.section, gravesite_counts.section) AS section,
          COALESCE(marker_counts.marker_count, 0)::int AS marker_count,
          COALESCE(gravesite_counts.gravesite_count, 0)::int AS gravesite_count
        FROM marker_counts
        FULL OUTER JOIN gravesite_counts
          ON marker_counts.cemetery = gravesite_counts.cemetery
         AND marker_counts.section = gravesite_counts.section
      )
      SELECT cemetery, section, marker_count, gravesite_count
      FROM combined_counts
      ${finalSectionWhere}
      ORDER BY cemetery, section
    `,
    values,
  );

  const markerTotal = result.rows.reduce((total, row) => total + Number(row.marker_count ?? 0), 0);
  const gravesiteTotal = result.rows.reduce((total, row) => total + Number(row.gravesite_count ?? 0), 0);
  const scopeText = sectionName ? ` in section ${sectionName}` : "";

  return reportResult({
    definition,
    summary: `${markerTotal} marker${markerTotal === 1 ? "" : "s"} and ${gravesiteTotal} gravesite${gravesiteTotal === 1 ? "" : "s"} counted${scopeText}.`,
    columns: [
      { key: "cemetery", label: "Cemetery" },
      { key: "section", label: "Section" },
      { key: "marker_count", label: "Markers" },
      { key: "gravesite_count", label: "Gravesites" },
    ],
    rows: result.rows,
    notes: ["Markers are counted from linked gravesites when available, otherwise from marker GPS position inside cemetery and section geometry."],
  });
}

async function runMarkerTypeInventory(client, definition, parameters, cemeteryIds) {
  const sectionName = optionalTextParameter(parameters, "sectionName", 80);
  const markerType = optionalTextParameter(parameters, "markerType", 80);
  const values = [];
  const scope = scopedWhere("cemeteries.id", values, cemeteryIds);
  const filters = [];
  if (sectionName) {
    values.push(sectionName);
    filters.push(`upper(section) = upper($${values.length})`);
  }
  if (markerType) {
    values.push(`%${markerType}%`);
    filters.push(`(marker_type ILIKE $${values.length} OR marker_type_code ILIKE $${values.length})`);
  }
  const filteredWhere = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const result = await client.query(
    `
      WITH active_cemeteries AS (
        SELECT cemeteries.id, cemeteries.name, cemeteries.geometry
        FROM cemeteries
        WHERE cemeteries.deleted_at IS NULL
          ${scope}
      ),
      active_sections AS (
        SELECT sections.section_id, sections.cemetery_id, sections.name, sections.geometry
        FROM sections
        JOIN active_cemeteries
          ON active_cemeteries.id = sections.cemetery_id
        WHERE sections.deleted_at IS NULL
      ),
      marker_locations AS (
        SELECT DISTINCT
          headstones.id AS marker_uuid,
          headstones.headstone_id,
          active_cemeteries.name AS cemetery,
          COALESCE(NULLIF(linked_gravesites.section_id, ''), NULLIF(covering_sections.name, ''), 'Unsectioned') AS section,
          COALESCE(NULLIF(marker_types.label, ''), NULLIF(marker_types.code, ''), 'Unknown/not recorded') AS marker_type,
          COALESCE(NULLIF(marker_types.code, ''), 'unknown') AS marker_type_code
        FROM headstones
        LEFT JOIN gravesites linked_gravesites
          ON linked_gravesites.id = headstones.gravesite_uuid
         AND linked_gravesites.deleted_at IS NULL
        JOIN active_cemeteries
          ON active_cemeteries.id = linked_gravesites.cemetery_id
          OR (
            linked_gravesites.id IS NULL
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_cemeteries.geometry, headstones.geometry)
          )
        LEFT JOIN LATERAL (
          SELECT active_sections.name
          FROM active_sections
          WHERE active_sections.cemetery_id = active_cemeteries.id
            AND headstones.geometry IS NOT NULL
            AND ST_Covers(active_sections.geometry, headstones.geometry)
          ORDER BY active_sections.name
          LIMIT 1
        ) covering_sections ON true
        LEFT JOIN marker_types
          ON marker_types.id = headstones.marker_type_id
        WHERE headstones.deleted_at IS NULL
      ),
      filtered_marker_locations AS (
        SELECT cemetery, section, marker_type, marker_type_code, headstone_id, marker_uuid
        FROM marker_locations
        ${filteredWhere}
      )
      SELECT
        cemetery,
        section,
        marker_type,
        count(DISTINCT marker_uuid)::int AS marker_count,
        string_agg(DISTINCT headstone_id, ', ' ORDER BY headstone_id) AS markers
      FROM filtered_marker_locations
      GROUP BY cemetery, section, marker_type
      ORDER BY cemetery, section, marker_type
    `,
    values,
  );

  const markerTotal = result.rows.reduce((total, row) => total + Number(row.marker_count ?? 0), 0);
  const qualifier = [sectionName ? `section ${sectionName}` : "", markerType ? `type matching "${markerType}"` : ""].filter(Boolean).join(", ");
  const suffix = qualifier ? ` for ${qualifier}` : "";

  return reportResult({
    definition,
    summary: `${markerTotal} marker${markerTotal === 1 ? "" : "s"} listed by type${suffix}.`,
    columns: [
      { key: "cemetery", label: "Cemetery" },
      { key: "section", label: "Section" },
      { key: "marker_type", label: "Marker type" },
      { key: "marker_count", label: "Markers" },
      { key: "markers", label: "Marker IDs" },
    ],
    rows: result.rows,
    notes: ["Markers are grouped by the marker type lookup value currently linked to each marker."],
  });
}

async function runOwnerHoldings(client, definition, parameters, cemeteryIds) {
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
          'Ownership events' AS source
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
        WHERE current_ownership_right_owners.display_name ILIKE $1
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
          'Legacy owner records' AS source
        FROM owners
        JOIN gravesites
          ON gravesites.id = owners.gravesite_uuid
        JOIN cemeteries
          ON cemeteries.id = gravesites.cemetery_id
        CROSS JOIN LATERAL (
          SELECT owners.owner AS owner_name WHERE owners.owner ILIKE $1
          UNION ALL
          SELECT owners.co_owner AS owner_name WHERE owners.co_owner ILIKE $1
        ) matched_legacy
        WHERE owners.deleted_at IS NULL
          AND gravesites.deleted_at IS NULL
          ${scope}
      )
      SELECT cemetery, owner_name, target_type, record_label, effective_date, event_type, document_reference, source
      FROM matched_holdings
      ORDER BY target_type, record_label, owner_name
    `,
    values,
  );
  const lotCount = new Set(result.rows.filter((row) => row.target_type === "lot").map((row) => `${row.cemetery}:${row.record_label}`)).size;
  const gravesiteCount = new Set(result.rows.filter((row) => row.target_type === "gravesite").map((row) => `${row.cemetery}:${row.record_label}`)).size;

  return reportResult({
    definition,
    summary: `${lotCount} lot${lotCount === 1 ? "" : "s"} and ${gravesiteCount} gravesite${gravesiteCount === 1 ? "" : "s"} matched "${ownerName}".`,
    columns: [
      { key: "owner_name", label: "Owner" },
      { key: "target_type", label: "Type" },
      { key: "record_label", label: "Record" },
      { key: "effective_date", label: "Date" },
      { key: "event_type", label: "Event" },
      { key: "document_reference", label: "Document" },
      { key: "cemetery", label: "Cemetery" },
      { key: "source", label: "Source" },
    ],
    rows: result.rows,
  });
}

async function runAvailableInventory(client, definition, cemeteryIds) {
  const values = [];
  const scope = scopedWhere("gravesites.cemetery_id", values, cemeteryIds);
  const derivedStatus = derivedGravesiteStatusSql();
  const result = await client.query(
    `
      WITH available_gravesites AS (
        SELECT
          cemeteries.name AS cemetery,
          gravesites.lot_uuid,
          lots.section_id AS lot_section,
          lots.lot_id,
          gravesites.section_id,
          gravesites.grave_id,
          gravesites.gravesite_id,
          gravesites.cost,
          ${derivedStatus} AS status
        FROM gravesites
        JOIN cemeteries
          ON cemeteries.id = gravesites.cemetery_id
        LEFT JOIN lots
          ON lots.id = gravesites.lot_uuid
        LEFT JOIN gravesite_status_types status_type
          ON status_type.id = gravesites.status_type_id
        WHERE gravesites.deleted_at IS NULL
          ${scope}
      ),
      available_lots AS (
        SELECT
          cemetery,
          lot_uuid,
          concat_ws('-', NULLIF(lot_section, ''), NULLIF(lot_id, '')) AS record_label,
          count(*)::int AS gravesite_count,
          sum(coalesce(cost, 0)) AS total_cost
        FROM available_gravesites
        WHERE lot_uuid IS NOT NULL
        GROUP BY cemetery, lot_uuid, lot_section, lot_id
        HAVING bool_and(status = 'available')
      )
      SELECT
        'lot' AS target_type,
        cemetery,
        record_label,
        gravesite_count,
        total_cost,
        NULL::text AS gravesite_id
      FROM available_lots
      UNION ALL
      SELECT
        'gravesite' AS target_type,
        cemetery,
        concat_ws('-', NULLIF(section_id, ''), NULLIF(grave_id, '')) AS record_label,
        1 AS gravesite_count,
        cost AS total_cost,
        gravesite_id
      FROM available_gravesites
      WHERE status = 'available'
      ORDER BY target_type, cemetery, record_label
    `,
    values,
  );

  const lots = result.rows.filter((row) => row.target_type === "lot").length;
  const gravesites = result.rows.filter((row) => row.target_type === "gravesite").length;

  return reportResult({
    definition,
    summary: `${lots} whole lot${lots === 1 ? "" : "s"} and ${gravesites} gravesite${gravesites === 1 ? "" : "s"} appear available.`,
    columns: [
      { key: "target_type", label: "Type" },
      { key: "record_label", label: "Record" },
      { key: "gravesite_count", label: "Gravesites" },
      { key: "total_cost", label: "Cost" },
      { key: "cemetery", label: "Cemetery" },
      { key: "gravesite_id", label: "Gravesite ID" },
    ],
    rows: result.rows,
    notes: ["A whole lot is listed when every active gravesite in that lot appears available."],
  });
}

async function runMaintenanceNeeds(client, definition, parameters, cemeteryIds) {
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

function runDeedClaimTraceGuide(definition, parameters) {
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

function extractOwnerName(text) {
  const byMatch = text.match(/\b(?:by|for|owner|owned by|person)\s+([a-z0-9 .,'-]{2,80})/iu);
  if (!byMatch) return "";
  return compactText(byMatch[1].replace(/\b(?:own|owns|owned|holding|holdings|lots?|gravesites?)\b.*$/iu, "").replace(/[?.!,;:]+$/u, ""), 80);
}

function extractSectionName(text) {
  const match = text.match(/\bsection\s+([a-z0-9-]{1,40})\b/iu);
  if (!match) return "";
  return compactText(match[1].replace(/[?.!,;:]+$/u, ""), 40);
}

function extractMarkerType(text) {
  const typeMatch = text.match(/\b(?:marker\s+type|type)\s+([a-z0-9 .,'-]{2,80})/iu);
  if (typeMatch) {
    return compactText(typeMatch[1].replace(/\b(?:markers?|headstones?|in|for|section|cemetery)\b.*$/iu, "").replace(/[?.!,;:]+$/u, ""), 80);
  }
  const listMatch = text.match(/\blist\s+([a-z0-9 .,'-]{2,80})\s+(?:markers?|headstones?)\b/iu);
  if (!listMatch) return "";
  const candidate = compactText(listMatch[1].replace(/\b(?:all|the)\b/giu, "").replace(/[?.!,;:]+$/u, ""), 80);
  if (!candidate || /\bby\s+type\b/iu.test(candidate)) return "";
  return candidate;
}

export function matchReportQuery(query) {
  const text = compactText(query, 500);
  const lower = text.toLowerCase();
  let reportId = "";
  const parameters = {};

  if (/\b(oldest|latest|earliest|recent)\b/u.test(lower) && /\bburial\b/u.test(lower)) {
    reportId = "burial-date-extremes";
  } else if (/\bveterans?\b/u.test(lower) || /\bmilitary\b/u.test(lower) || /\bwar(?:s)?\b/u.test(lower) || /\bservice branches?\b/u.test(lower)) {
    reportId = "veteran-service-summary";
  } else if (/\b(marker|headstone)\s+burial\s+pages?\b/u.test(lower) || (/\b(print|page|pages)\b/u.test(lower) && /\b(markers?|headstones?)\b/u.test(lower) && /\bburials?\b/u.test(lower))) {
    reportId = "marker-burial-pages";
    const markerMatch = text.match(/\b(?:marker|headstone)\s+(TLC-HS-[A-Z0-9-]+)\b/iu);
    if (markerMatch) parameters.markerId = markerMatch[1];
    parameters.sectionName = extractSectionName(text);
    const personMatch = text.match(/\bfor\s+(?!marker\b|headstone\b|section\b)([a-z][a-z .,'-]{1,119})[?.!]*$/iu);
    if (personMatch) parameters.personName = compactText(personMatch[1].replace(/[?.!,;:]+$/u, ""), 120);
  } else if (/\b(markers?|headstones?)\b/u.test(lower) && /\b(types?|by type|list)\b/u.test(lower)) {
    reportId = "marker-type-inventory";
    parameters.sectionName = extractSectionName(text);
    parameters.markerType = extractMarkerType(text);
  } else if (/\b(how many|count|counts?|number of)\b/u.test(lower) && /\b(markers?|headstones?|gravesites?)\b/u.test(lower) && /\b(section|cemeter(?:y|ies)|here)\b/u.test(lower)) {
    reportId = "spatial-inventory-counts";
    parameters.sectionName = extractSectionName(text);
  } else if (/\b(clean(?:ed|ing)?|illegible|listing|leaning|broken|grass|level(?:ed|ing)?|maintenance|repair|repaired|smooth|sunken)\b/u.test(lower)) {
    reportId = "maintenance-needs";
    if (/\b(markers?|headstones?)\b/u.test(lower)) parameters.targetType = "headstone";
    if (/\bgravesites?\b/u.test(lower)) parameters.targetType = "gravesite";
    if (/\billegible\b/u.test(lower)) parameters.issueCode = "illegible";
    if (/\b(listing|leaning)\b/u.test(lower)) parameters.issueCode = "listing";
    if (/\bbroken\b/u.test(lower)) parameters.issueCode = "broken";
    if (/\bgrass\b/u.test(lower)) parameters.issueCode = "grass_needed";
    if (/\blevel(?:ed|ing)?|smooth\b/u.test(lower)) parameters.issueCode = "needs_leveling";
    if (/\bsunken\b/u.test(lower)) parameters.issueCode = "sunken_soil";
    if (/\bclean(?:ed|ing)?\b/u.test(lower)) parameters.actionCode = "cleaned";
    if (/\bcompleted|done|finished\b/u.test(lower)) parameters.status = "completed";
    if (/\bopen|needs?|needed|not\b/u.test(lower)) parameters.status = "open";
    if (/\bnot\b/u.test(lower) && /\bclean(?:ed)?\b/u.test(lower)) {
      parameters.daysSinceCleaned = /\byear\b/u.test(lower) ? "365" : /\bmonth\b/u.test(lower) ? "30" : "365";
      delete parameters.status;
      delete parameters.actionCode;
    }
  } else if (/\bavailable\b/u.test(lower) && /\b(lots?|gravesites?|purchase)\b/u.test(lower)) {
    reportId = "available-inventory";
  } else if (
    (/\b(deed|paperwork|trace|claim|parents?)\b/u.test(lower) && /\b(lot|gravesite|owned|ownership|rights?)\b/u.test(lower)) ||
    (/\b(deed|claim|trace)\b/u.test(lower) && /\bpaperwork|documents?\b/u.test(lower))
  ) {
    reportId = "deed-claim-trace-guide";
  } else if (/\b(owner|owned|owns|holdings?|lots?|gravesites?)\b/u.test(lower)) {
    reportId = "owner-holdings";
    parameters.ownerName = extractOwnerName(text);
  }

  const definition = definitionById(reportId);
  if (!definition) {
    return {
      matched: false,
      message: "No approved report matched that question.",
      availableReports: reportDefinitions.map(toDefinition),
    };
  }

  const missingParameters = definition.parameters.filter((parameter) => parameter.required && !parameters[parameter.name]);
  return {
    matched: true,
    report: toDefinition(definition),
    parameters,
    missingParameters,
    message: missingParameters.length ? "More information is needed before this report can run." : "Matched an approved report.",
  };
}

export function listReportsForUser(user) {
  return reportDefinitions.filter((definition) => canRun(user?.role, definition.requiredRole)).map(toDefinition);
}

export async function runReport(pool, reportId, parameters = {}, user) {
  const definition = definitionById(reportId);
  if (!definition) {
    const error = new Error(`Unsupported report: ${reportId}.`);
    error.code = "REPORT_NOT_FOUND";
    throw error;
  }
  if (!canRun(user?.role, definition.requiredRole)) {
    const error = new Error("Forbidden");
    error.code = "REPORT_FORBIDDEN";
    throw error;
  }
  const cemeteryIds = selectedReportCemeteryIds(user, parameters);

  const client = await pool.connect();
  try {
    if (reportId === "burial-date-extremes") return await runBurialDateExtremes(client, definition, cemeteryIds);
    if (reportId === "veteran-service-summary") return await runVeteranServiceSummary(client, definition, cemeteryIds);
    if (reportId === "spatial-inventory-counts") return await runSpatialInventoryCounts(client, definition, parameters, cemeteryIds);
    if (reportId === "marker-type-inventory") return await runMarkerTypeInventory(client, definition, parameters, cemeteryIds);
    if (reportId === "marker-burial-pages") return await runMarkerBurialPages(client, definition, parameters, cemeteryIds);
    if (reportId === "owner-holdings") return await runOwnerHoldings(client, definition, parameters, cemeteryIds);
    if (reportId === "available-inventory") return await runAvailableInventory(client, definition, cemeteryIds);
    if (reportId === "maintenance-needs") return await runMaintenanceNeeds(client, definition, parameters, cemeteryIds);
    if (reportId === "deed-claim-trace-guide") return runDeedClaimTraceGuide(definition, parameters);
  } finally {
    client.release();
  }

  const error = new Error(`Unsupported report: ${reportId}.`);
  error.code = "REPORT_NOT_FOUND";
  throw error;
}
