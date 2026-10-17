import { withAuditContext } from "./auditContext.mjs";

import { BadRequestError } from "./requestValidation.mjs";

const lookupDefinitions = {
  marker_types: {
    table: "marker_types",
    label: "Marker types",
    hasSourceFields: true,
    usageTable: "headstones",
    usageColumn: "marker_type_id",
    usageLabel: "headstones",
  },
  marker_scope_types: {
    table: "marker_scope_types",
    label: "Marker scopes",
    hasSourceFields: false,
    usageTable: "headstones",
    usageColumn: "marker_scope_type_id",
    usageLabel: "headstones",
    usageWhere: "usage_records.deleted_at IS NULL",
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
  burial_record_status_types: {
    table: "burial_record_status_types",
    label: "Burial record statuses",
    hasSourceFields: false,
    usageTable: "burials",
    usageColumn: "burial_record_status_type_id",
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
  maintenance_issue_types: {
    table: "maintenance_issue_types",
    label: "Maintenance issue types",
    hasSourceFields: false,
    usageTable: "maintenance_records",
    usageColumn: "issue_type_id",
    usageLabel: "maintenance records",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  maintenance_action_types: {
    table: "maintenance_action_types",
    label: "Maintenance action types",
    hasSourceFields: false,
    usageTable: "maintenance_records",
    usageColumn: "action_type_id",
    usageLabel: "maintenance records",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  maintenance_priority_types: {
    table: "maintenance_priority_types",
    label: "Maintenance priorities",
    hasSourceFields: false,
    usageTable: "maintenance_records",
    usageColumn: "priority_type_id",
    usageLabel: "maintenance records",
    usageWhere: "usage_records.deleted_at IS NULL",
  },
  military_rank_types: {
    table: "military_rank_types", label: "Military ranks", hasSourceFields: false, hasRankFields: true,
    usageTable: "burials", usageColumn: "military_rank_type_id", usageLabel: "burials",
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
    isActive: row.is_active,
    usageCount: Number(row.usage_count ?? 0),
    usageLabel: definition.usageLabel,
    sourceNotes: definition.hasSourceFields ? (row.source_notes ?? "") : undefined,
    sourceUrl: definition.hasSourceFields ? (row.source_url ?? "") : undefined,
    ...(definition.hasRankFields ? {
      militaryBranchId: row.military_branch_type_id,
      abbreviation: row.abbreviation, payGrade: row.pay_grade ?? "", rankGroup: row.rank_group,
    } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function lookupTables() {
  return Object.entries(lookupDefinitions).map(([table, definition]) => ({
    table,
    label: definition.label,
    hasSourceFields: definition.hasSourceFields,
    ...(definition.hasRankFields ? { hasRankFields: true } : {}),
  }));
}

export async function listLookupRecords(pool) {
  const client = await pool.connect();
  try {
    const tables = lookupTables();
    const lookups = {};

    for (const table of tables) {
      const definition = lookupDefinition(table.table);
      const sourceFields = definition.hasSourceFields ? ", source_notes, source_url" : definition.hasRankFields ? ", military_branch_type_id::text, abbreviation, pay_grade, rank_group" : "";
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
        ORDER BY lower(label), label, code
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
  if (definition.hasRankFields) return saveMilitaryRank(pool, id, record, actorUser);

  return withAuditContext(pool, { actorUser }, async (client) => {
    const sourceAssignments = definition.hasSourceFields
      ? `,
            source_notes = NULLIF($4, ''),
            source_url = NULLIF($5, ''),
            is_active = $6`
      : `,
            is_active = $4`;
    const returningSourceFields = definition.hasSourceFields ? ", source_notes, source_url" : "";
    const usageWhere = definition.usageWhere ? ` AND ${definition.usageWhere}` : "";
    const usageCountSelect = `(SELECT count(*) FROM ${definition.usageTable} usage_records WHERE usage_records.${definition.usageColumn} = ${definition.table}.id${usageWhere})`;
    const values = definition.hasSourceFields
      ? [id, record.label, record.description, record.sourceNotes ?? "", record.sourceUrl ?? "", record.isActive]
      : [id, record.label, record.description, record.isActive];

    const result = await client.query(
      `
        UPDATE ${definition.table}
        SET label = $2,
            description = $3${sourceAssignments}
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
  if (definition.hasRankFields) return saveMilitaryRank(pool, undefined, record, actorUser);

  return withAuditContext(pool, { actorUser }, async (client) => {
    const sourceColumns = definition.hasSourceFields ? ", source_notes, source_url" : "";
    const sourceValues = definition.hasSourceFields ? ", NULLIF($4, ''), NULLIF($5, '')" : "";
    const activeIndex = definition.hasSourceFields ? 6 : 4;
    const returningSourceFields = definition.hasSourceFields ? ", source_notes, source_url" : "";
    const usageWhere = definition.usageWhere ? ` AND ${definition.usageWhere}` : "";
    const usageCountSelect = `(SELECT count(*) FROM ${definition.usageTable} usage_records WHERE usage_records.${definition.usageColumn} = ${definition.table}.id${usageWhere})`;
    const values = definition.hasSourceFields
      ? [record.code, record.label, record.description, record.sourceNotes ?? "", record.sourceUrl ?? "", record.isActive]
      : [record.code, record.label, record.description, record.isActive];

    const result = await client.query(
      `
        INSERT INTO ${definition.table} (code, label, description, sort_order${sourceColumns}, is_active)
        VALUES ($1, $2, $3, 100${sourceValues}, $${activeIndex})
        RETURNING id::text, code, label, description, sort_order, is_active, created_at, updated_at, ${usageCountSelect} AS usage_count${returningSourceFields}
      `,
      values,
    );

    return toLookupRow(result.rows[0], definition);
  });
}

async function saveMilitaryRank(pool, id, record, actorUser) {
  const definition = lookupDefinitions.military_rank_types;
  return withAuditContext(pool, { actorUser }, async client => {
    if (id) {
      const current = await client.query("SELECT military_branch_type_id::text FROM military_rank_types WHERE id=$1::uuid FOR UPDATE", [id]);
      if (!current.rows.length) return undefined;
      if (current.rows[0].military_branch_type_id !== record.militaryBranchId) {
        throw new BadRequestError("A rank's military branch cannot be changed. Create a new rank for the other branch.");
      }
    } else {
      const branch = await client.query("SELECT id FROM military_branch_types WHERE id=$1::uuid AND is_active", [record.militaryBranchId]);
      if (!branch.rows.length) throw new BadRequestError("Choose an active military branch.");
    }
    const values = [record.label, record.description, record.isActive, record.abbreviation, record.payGrade || null, record.rankGroup];
    const usage = `(SELECT count(*) FROM burials WHERE burials.military_rank_type_id=military_rank_types.id AND burials.deleted_at IS NULL)`;
    const returning = `RETURNING id::text,code,label,description,is_active,created_at,updated_at,military_branch_type_id::text,abbreviation,pay_grade,rank_group,${usage} AS usage_count`;
    const sql = id
      ? `UPDATE military_rank_types SET label=$1,description=$2,is_active=$3,abbreviation=$4,pay_grade=$5,rank_group=$6 WHERE id=$7::uuid ${returning}`
      : `INSERT INTO military_rank_types(label,description,is_active,abbreviation,pay_grade,rank_group,code,military_branch_type_id,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8::uuid,100) ${returning}`;
    values.push(...(id ? [id] : [record.code, record.militaryBranchId]));
    let result;
    try { result = await client.query(sql, values); }
    catch (error) {
      if (error.code === "23505") throw new BadRequestError("A rank with this code already exists in this branch. Refresh the list and edit the existing rank.");
      throw error;
    }
    return toLookupRow(result.rows[0], definition);
  });
}
