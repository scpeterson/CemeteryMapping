import { withAuditContext } from "./auditContext.mjs";

const lookupDefinitions = {
  marker_types: {
    table: "marker_types",
    label: "Marker types",
    hasSourceFields: true,
    usageTable: "headstones",
    usageColumn: "marker_type_id",
    usageLabel: "headstones",
  },
  marker_material_types: {
    table: "marker_material_types",
    label: "Marker materials",
    hasSourceFields: true,
    usageTable: "headstones",
    usageColumn: "material_type_id",
    usageLabel: "headstones",
  },
  headstone_condition_types: {
    table: "headstone_condition_types",
    label: "Headstone conditions",
    hasSourceFields: false,
    usageTable: "headstones",
    usageColumn: "condition_type_id",
    usageLabel: "headstones",
  },
  headstone_vase_types: {
    table: "headstone_vase_types",
    label: "Headstone vase types",
    hasSourceFields: false,
    usageTable: "headstones",
    usageColumn: "vase_type_id",
    usageLabel: "headstones",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  headstone_vase_material_types: {
    table: "headstone_vase_material_types",
    label: "Headstone vase materials",
    hasSourceFields: false,
    usageTable: "headstones",
    usageColumn: "vase_material_type_id",
    usageLabel: "headstones",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  headstone_vase_placement_types: {
    table: "headstone_vase_placement_types",
    label: "Headstone vase placements",
    hasSourceFields: false,
    usageTable: "headstones",
    usageColumn: "vase_placement_type_id",
    usageLabel: "headstones",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  gravesite_status_types: {
    table: "gravesite_status_types",
    label: "Gravesite statuses",
    hasSourceFields: false,
    usageTable: "gravesites",
    usageColumn: "status_type_id",
    usageLabel: "gravesites",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  burial_interment_types: {
    table: "burial_interment_types",
    label: "Burial interment types",
    hasSourceFields: false,
    usageTable: "burials",
    usageColumn: "interment_type_id",
    usageLabel: "burials",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  lot_ownership_event_types: {
    table: "lot_ownership_event_types",
    label: "Lot ownership event types",
    hasSourceFields: false,
    usageTable: "lot_ownership_events",
    usageColumn: "event_type_id",
    usageLabel: "lot ownership events",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  military_branch_types: {
    table: "military_branch_types",
    label: "Military branches",
    hasSourceFields: false,
    usageTable: "burials",
    usageColumn: "military_branch_type_id",
    usageLabel: "burials",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  military_war_service_types: {
    table: "military_war_service_types",
    label: "Military war service",
    hasSourceFields: false,
    usageTable: "burials",
    usageColumn: "military_war_service_type_id",
    usageLabel: "burials",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
};

function lookupDefinition(table) {
  const definition = lookupDefinitions[table];
  if (!definition) throw new Error(`Unsupported lookup table: ${table}.`);
  return definition;
}

function toLookupRow(row, definition) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    description: row.description,
    sortOrder: Number(row.sort_order),
    isActive: row.is_active,
    usageCount: Number(row.usage_count ?? 0),
    usageLabel: definition.usageLabel,
    sourceNotes: definition.hasSourceFields ? (row.source_notes ?? "") : undefined,
    sourceUrl: definition.hasSourceFields ? (row.source_url ?? "") : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function lookupTables() {
  return Object.entries(lookupDefinitions).map(([table, definition]) => ({
    table,
    label: definition.label,
    hasSourceFields: definition.hasSourceFields,
  }));
}

export async function listLookupRecords(pool) {
  const client = await pool.connect();
  try {
    const tables = lookupTables();
    const lookups = {};

    for (const table of tables) {
      const definition = lookupDefinition(table.table);
      const sourceFields = definition.hasSourceFields ? ", source_notes, source_url" : "";
      const usageWhere = definition.usageWhere ? ` AND ${definition.usageWhere}` : "";
      const result = await client.query(`
        SELECT
          id::text,
          code,
          label,
          description,
          sort_order,
          is_active,
          created_at,
          updated_at,
          (
            SELECT count(*)
            FROM ${definition.usageTable} usage_records
            WHERE usage_records.${definition.usageColumn} = ${definition.table}.id${usageWhere}
          ) AS usage_count${sourceFields}
        FROM ${definition.table}
        ORDER BY sort_order, label, code
      `);
      lookups[table.table] = result.rows.map((row) => toLookupRow(row, definition));
    }

    return { tables, lookups };
  } finally {
    client.release();
  }
}

export async function updateLookupRecord(pool, table, id, record, { actorUser } = {}) {
  const definition = lookupDefinition(table);

  return withAuditContext(pool, { actorUser }, async (client) => {
    const sourceAssignments = definition.hasSourceFields
      ? `,
            source_notes = NULLIF($5, ''),
            source_url = NULLIF($6, ''),
            is_active = $7`
      : `,
            is_active = $5`;
    const returningSourceFields = definition.hasSourceFields ? ", source_notes, source_url" : "";
    const usageWhere = definition.usageWhere ? ` AND ${definition.usageWhere}` : "";
    const usageCountSelect = `(SELECT count(*) FROM ${definition.usageTable} usage_records WHERE usage_records.${definition.usageColumn} = ${definition.table}.id${usageWhere})`;
    const values = definition.hasSourceFields
      ? [id, record.label, record.description, record.sortOrder, record.sourceNotes ?? "", record.sourceUrl ?? "", record.isActive]
      : [id, record.label, record.description, record.sortOrder, record.isActive];

    const result = await client.query(
      `
        UPDATE ${definition.table}
        SET label = $2,
            description = $3,
            sort_order = $4${sourceAssignments}
        WHERE id = $1::uuid
        RETURNING id::text, code, label, description, sort_order, is_active, created_at, updated_at, ${usageCountSelect} AS usage_count${returningSourceFields}
      `,
      values,
    );

    return result.rows[0] ? toLookupRow(result.rows[0], definition) : undefined;
  });
}

export async function createLookupRecord(pool, table, record, { actorUser } = {}) {
  const definition = lookupDefinition(table);

  return withAuditContext(pool, { actorUser }, async (client) => {
    const sourceColumns = definition.hasSourceFields ? ", source_notes, source_url" : "";
    const sourceValues = definition.hasSourceFields ? ", NULLIF($5, ''), NULLIF($6, '')" : "";
    const activeIndex = definition.hasSourceFields ? 7 : 5;
    const returningSourceFields = definition.hasSourceFields ? ", source_notes, source_url" : "";
    const usageWhere = definition.usageWhere ? ` AND ${definition.usageWhere}` : "";
    const usageCountSelect = `(SELECT count(*) FROM ${definition.usageTable} usage_records WHERE usage_records.${definition.usageColumn} = ${definition.table}.id${usageWhere})`;
    const values = definition.hasSourceFields
      ? [record.code, record.label, record.description, record.sortOrder, record.sourceNotes ?? "", record.sourceUrl ?? "", record.isActive]
      : [record.code, record.label, record.description, record.sortOrder, record.isActive];

    const result = await client.query(
      `
        INSERT INTO ${definition.table} (code, label, description, sort_order${sourceColumns}, is_active)
        VALUES ($1, $2, $3, $4${sourceValues}, $${activeIndex})
        RETURNING id::text, code, label, description, sort_order, is_active, created_at, updated_at, ${usageCountSelect} AS usage_count${returningSourceFields}
      `,
      values,
    );

    return toLookupRow(result.rows[0], definition);
  });
}
