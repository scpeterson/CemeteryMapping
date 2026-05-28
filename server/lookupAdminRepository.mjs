import { withAuditContext } from "./auditContext.mjs";

const lookupDefinitions = {
  marker_types: {
    table: "marker_types",
    label: "Marker types",
    hasSourceFields: true,
  },
  marker_material_types: {
    table: "marker_material_types",
    label: "Marker materials",
    hasSourceFields: true,
  },
  headstone_condition_types: {
    table: "headstone_condition_types",
    label: "Headstone conditions",
    hasSourceFields: false,
  },
  gravesite_status_types: {
    table: "gravesite_status_types",
    label: "Gravesite statuses",
    hasSourceFields: false,
  },
  lot_ownership_event_types: {
    table: "lot_ownership_event_types",
    label: "Lot ownership event types",
    hasSourceFields: false,
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
      const result = await client.query(`
        SELECT id::text, code, label, description, sort_order, is_active, created_at, updated_at${sourceFields}
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
        RETURNING id::text, code, label, description, sort_order, is_active, created_at, updated_at${returningSourceFields}
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
    const values = definition.hasSourceFields
      ? [record.code, record.label, record.description, record.sortOrder, record.sourceNotes ?? "", record.sourceUrl ?? "", record.isActive]
      : [record.code, record.label, record.description, record.sortOrder, record.isActive];

    const result = await client.query(
      `
        INSERT INTO ${definition.table} (code, label, description, sort_order${sourceColumns}, is_active)
        VALUES ($1, $2, $3, $4${sourceValues}, $${activeIndex})
        RETURNING id::text, code, label, description, sort_order, is_active, created_at, updated_at${returningSourceFields}
      `,
      values,
    );

    return toLookupRow(result.rows[0], definition);
  });
}
