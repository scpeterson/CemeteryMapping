import { setAuditContext } from "./auditContext.mjs";

const statusMap = new Map([
  ["available", "available"],
  ["reserved", "reserved"],
  ["occupied", "occupied"],
  ["sold", "sold"],
  ["needs_review", "needs_review"],
  ["needs review", "needs_review"],
]);

function normalizeStatus(status) {
  return statusMap.get(String(status ?? "").trim().toLowerCase()) ?? "unknown";
}

function parseGeometry(value) {
  if (!value) return undefined;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function dateOnly(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function compactJoin(values, separator = " | ") {
  return values.filter(Boolean).join(separator) || undefined;
}

function ownerDisplayName(owner) {
  return compactJoin([owner.owner, owner.co_owner], " and ") ?? "Unknown owner";
}

function toOwner(owner) {
  return {
    id: owner.id,
    displayName: ownerDisplayName(owner),
    contactNote: compactJoin([owner.phone, owner.email, owner.full_address, owner.notes]),
  };
}

function toBurial(burial) {
  return {
    id: burial.id,
    person: {
      id: `person-${burial.id}`,
      firstName: burial.first_name ?? "",
      lastName: burial.last_name ?? burial.full_name ?? "Unknown",
      birthDate: dateOnly(burial.birth_date),
      deathDate: dateOnly(burial.death_date),
    },
    burialDate: dateOnly(burial.burial_date),
    notes: compactJoin([burial.funeral_home ? `Funeral home: ${burial.funeral_home}` : undefined, burial.notes]),
  };
}

function toOwnershipEvent(owner) {
  return {
    id: `owner-${owner.id}`,
    ownerIds: [owner.id],
    eventType: "purchase",
    effectiveDate: dateOnly(owner.sale_date ?? owner.created_at) ?? "1900-01-01",
    recordedBy: "Cemetery database",
    notes: owner.notes,
  };
}

function toLookupValue(row, prefix) {
  return {
    id: row[`${prefix}_id`],
    code: row[`${prefix}_code`],
    label: row[`${prefix}_label`],
  };
}

function toHeadstone(row) {
  return {
    id: row.id,
    headstoneId: row.headstone_id,
    markerType: toLookupValue(row, "marker_type"),
    material: toLookupValue(row, "material"),
    condition: toLookupValue(row, "condition"),
    conditionNotes: row.condition_notes ?? "",
    inscription: row.inscription ?? "",
    photoUrl: row.photo_url ?? "",
    lastInspectedAt: dateOnly(row.last_inspected_at),
    relationshipType: row.relationship_type ?? "primary",
    relationshipNotes: row.relationship_notes ?? "",
    burialIds: row.burial_ids ?? [],
  };
}

function toGraveSummary(grave) {
  return {
    id: grave.gravesite_id,
    cemeteryId: grave.cemetery_id,
    cemeteryName: grave.cemetery_name,
    section: grave.section_id ?? "",
    lot: grave.lot_id ?? "",
    space: grave.grave_id,
    status: normalizeStatus(grave.status),
    geometry: parseGeometry(grave.geometry),
  };
}

function ownershipRedactedGrave(grave) {
  return {
    ...grave,
    owners: [],
    currentOwnerIds: [],
    ownershipHistory: [],
  };
}

async function selectTriggeredAuditEventId(client, { action, targetTable, targetRecordId }) {
  const result = await client.query(
    `
      SELECT id::text
      FROM audit_events
      WHERE transaction_id = txid_current()
        AND action = $1
        AND target_table = $2
        AND target_record_id = $3
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 1
    `,
    [action, targetTable, targetRecordId],
  );

  return result.rows[0]?.id;
}

async function insertCompatibilityAuditEvent(client, { actorUser, action, targetTable, targetRecordId, previousValues, newValues, reason }) {
  const result = await client.query(
    `
      INSERT INTO audit_events (
        actor_user_id,
        actor_app_user_id,
        actor_external_subject,
        actor_email,
        actor_role,
        actor_database_user,
        actor_session_user,
        source,
        transaction_id,
        action,
        target_table,
        target_record_id,
        previous_values,
        new_values,
        changed_fields,
        reason,
        occurred_at
      )
      VALUES ($1::uuid, $1::uuid, $2, $3, $4, current_user, session_user, 'api', txid_current(), $5, $6, $7, $8::jsonb, $9::jsonb, '{}'::text[], $10, now())
      RETURNING id::text
    `,
    [
      actorUser?.id ?? null,
      actorUser?.subject ?? null,
      actorUser?.email ?? null,
      actorUser?.role ?? null,
      action,
      targetTable,
      targetRecordId,
      JSON.stringify(previousValues ?? null),
      JSON.stringify(newValues ?? null),
      reason,
    ],
  );

  return result.rows[0].id;
}

async function auditEventIdForMutation(client, event) {
  return (await selectTriggeredAuditEventId(client, event)) ?? (await insertCompatibilityAuditEvent(client, event));
}

async function selectGraveMutationState(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        id::text AS uuid,
        cemetery_id::text,
        gravesite_id,
        deleted_at,
        deleted_by::text,
        delete_reason,
        updated_at
      FROM gravesites
      WHERE cemetery_id = $1
        AND gravesite_id = $2
      FOR UPDATE
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

function groupBy(rows, key) {
  return rows.reduce((groups, row) => {
    const value = row[key];
    if (!value) return groups;
    const existing = groups.get(value) ?? [];
    existing.push(row);
    groups.set(value, existing);
    return groups;
  }, new Map());
}

async function selectActiveCemeteries(client) {
  const result = await client.query(`
    SELECT id::text, name, ST_AsGeoJSON(geometry)::json AS geometry
    FROM cemeteries
    WHERE deleted_at IS NULL
    ORDER BY name, id
  `);

  return result.rows;
}

async function sectionAlternateNamesSelect(client) {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'sections'
        AND column_name = 'alternate_names'
    ) AS exists
  `);

  return result.rows[0]?.exists ? "alternate_names" : "'{}'::text[] AS alternate_names";
}

async function selectSectionsForCemeteries(client, cemeteryIds) {
  const alternateNamesSelect = await sectionAlternateNamesSelect(client);
  const result = await client.query(
    `
      SELECT section_id::text AS uuid, name AS section_id, name, ${alternateNamesSelect}, ST_AsGeoJSON(geometry)::json AS geometry
      FROM sections
      WHERE cemetery_id = ANY($1::uuid[])
        AND deleted_at IS NULL
        AND geometry IS NOT NULL
      ORDER BY name, section_id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectLotsForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT
        id::text,
        lot_id,
        section_id,
        block_id,
        COALESCE(name, lot_id) AS name,
        ST_AsGeoJSON(geometry)::json AS geometry
      FROM lots
      WHERE cemetery_id = ANY($1::uuid[])
        AND deleted_at IS NULL
      ORDER BY section_id, block_id, lot_id, name
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectGravesForCemeteries(client, cemeteryIds, { includeCost = false } = {}) {
  const result = await client.query(
    `
      SELECT
        ${includeCost ? "gravesites.id::text AS uuid," : ""}
        gravesites.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        gravesites.section_id,
        gravesites.lot_id,
        gravesites.grave_id,
        gravesites.gravesite_id,
        gravesites.status,
        ${includeCost ? "gravesites.cost," : ""}
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      WHERE gravesites.cemetery_id = ANY($1::uuid[])
        AND gravesites.deleted_at IS NULL
      ORDER BY cemeteries.name, gravesites.section_id, gravesites.lot_id, gravesites.grave_id, gravesites.gravesite_id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId) {
  const result = await client.query(
    `
      SELECT
        gravesites.id::text AS uuid,
        gravesites.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        gravesites.section_id,
        gravesites.lot_id,
        gravesites.grave_id,
        gravesites.gravesite_id,
        gravesites.status,
        gravesites.cost,
        ST_AsGeoJSON(gravesites.geometry)::json AS geometry
      FROM gravesites
      JOIN cemeteries
        ON cemeteries.id = gravesites.cemetery_id
      WHERE gravesites.cemetery_id = $1
        AND gravesites.gravesite_id = $2
        AND gravesites.deleted_at IS NULL
        AND cemeteries.deleted_at IS NULL
      LIMIT 1
    `,
    [cemeteryId, gravesiteId],
  );

  return result.rows[0];
}

async function selectOwnersForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT id::text, gravesite_uuid::text, owner, co_owner, full_address, phone, email, sale_date, notes, created_at
      FROM owners
      WHERE deleted_at IS NULL
        AND gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
      ORDER BY sale_date DESC NULLS LAST, created_at DESC, id
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectBurialsForCemeteries(client, cemeteryIds) {
  const result = await client.query(
    `
      SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, funeral_home, notes
      FROM burials
      WHERE deleted_at IS NULL
        AND gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
      ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name
    `,
    [cemeteryIds],
  );

  return result.rows;
}

async function selectOwnersForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT id::text, gravesite_uuid::text, owner, co_owner, full_address, phone, email, sale_date, notes, created_at
      FROM owners
      WHERE gravesite_uuid = $1
        AND deleted_at IS NULL
      ORDER BY sale_date DESC NULLS LAST, created_at DESC, id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectBurialsForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, funeral_home, notes
      FROM burials
      WHERE gravesite_uuid = $1
        AND deleted_at IS NULL
      ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectHeadstonesForGrave(client, graveUuid) {
  const result = await client.query(
    `
      SELECT
        headstones.id::text,
        headstones.headstone_id,
        marker_types.id::text AS marker_type_id,
        marker_types.code AS marker_type_code,
        marker_types.label AS marker_type_label,
        marker_material_types.id::text AS material_id,
        marker_material_types.code AS material_code,
        marker_material_types.label AS material_label,
        headstone_condition_types.id::text AS condition_id,
        headstone_condition_types.code AS condition_code,
        headstone_condition_types.label AS condition_label,
        headstones.condition_notes,
        headstones.inscription,
        headstones.photo_url,
        headstones.last_inspected_at,
        COALESCE(headstone_gravesites.relationship_type, 'primary') AS relationship_type,
        headstone_gravesites.notes AS relationship_notes,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids
      FROM headstones
      LEFT JOIN headstone_gravesites
        ON headstone_gravesites.headstone_uuid = headstones.id
       AND headstone_gravesites.deleted_at IS NULL
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN marker_material_types
        ON marker_material_types.id = headstones.material_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      WHERE headstones.deleted_at IS NULL
        AND (
          headstones.gravesite_uuid = $1
          OR headstone_gravesites.gravesite_uuid = $1
        )
      GROUP BY
        headstones.id,
        marker_types.id,
        marker_types.code,
        marker_types.label,
        marker_material_types.id,
        marker_material_types.code,
        marker_material_types.label,
        headstone_condition_types.id,
        headstone_condition_types.code,
        headstone_condition_types.label,
        headstone_gravesites.relationship_type,
        headstone_gravesites.notes
      ORDER BY headstones.headstone_id, headstones.id
    `,
    [graveUuid],
  );

  return result.rows;
}

async function selectHeadstoneById(client, id) {
  const result = await client.query(
    `
      SELECT
        headstones.id::text,
        headstones.headstone_id,
        marker_types.id::text AS marker_type_id,
        marker_types.code AS marker_type_code,
        marker_types.label AS marker_type_label,
        marker_material_types.id::text AS material_id,
        marker_material_types.code AS material_code,
        marker_material_types.label AS material_label,
        headstone_condition_types.id::text AS condition_id,
        headstone_condition_types.code AS condition_code,
        headstone_condition_types.label AS condition_label,
        headstones.condition_notes,
        headstones.inscription,
        headstones.photo_url,
        headstones.last_inspected_at,
        'primary' AS relationship_type,
        NULL AS relationship_notes,
        array_remove(array_agg(DISTINCT headstone_burials.burial_uuid::text), NULL) AS burial_ids
      FROM headstones
      LEFT JOIN headstone_burials
        ON headstone_burials.headstone_uuid = headstones.id
       AND headstone_burials.deleted_at IS NULL
      JOIN marker_types
        ON marker_types.id = headstones.marker_type_id
      JOIN marker_material_types
        ON marker_material_types.id = headstones.material_type_id
      JOIN headstone_condition_types
        ON headstone_condition_types.id = headstones.condition_type_id
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
      GROUP BY
        headstones.id,
        marker_types.id,
        marker_types.code,
        marker_types.label,
        marker_material_types.id,
        marker_material_types.code,
        marker_material_types.label,
        headstone_condition_types.id,
        headstone_condition_types.code,
        headstone_condition_types.label
      LIMIT 1
    `,
    [id],
  );

  return result.rows[0];
}

async function selectHeadstoneMutationState(client, id) {
  const result = await client.query(
    `
      SELECT
        id::text,
        headstone_id,
        marker_type_id::text,
        marker_type_code,
        material_type_id::text,
        material_type_code,
        condition_type_id::text,
        condition,
        condition_notes,
        inscription,
        photo_url,
        last_inspected_at,
        updated_at
      FROM headstones
      WHERE id = $1
        AND deleted_at IS NULL
      FOR UPDATE
    `,
    [id],
  );

  return result.rows[0];
}

export async function listHeadstoneLookupOptions(pool) {
  const client = await pool.connect();
  try {
    const markerTypes = await client.query("SELECT id::text, code, label FROM marker_types WHERE is_active ORDER BY sort_order, label");
    const materials = await client.query("SELECT id::text, code, label FROM marker_material_types WHERE is_active ORDER BY sort_order, label");
    const conditions = await client.query("SELECT id::text, code, label FROM headstone_condition_types WHERE is_active ORDER BY sort_order, label");

    return {
      markerTypes: markerTypes.rows,
      materials: materials.rows,
      conditions: conditions.rows,
    };
  } finally {
    client.release();
  }
}

function toBoundaryFeature(cemetery) {
  return {
    type: "Feature",
    properties: { name: cemetery.name },
    geometry: parseGeometry(cemetery.geometry),
  };
}

function toSection(section) {
  return {
    id: section.section_id,
    name: section.name,
    alternateNames: section.alternate_names ?? [],
    geometry: parseGeometry(section.geometry),
  };
}

function toLot(lot) {
  return {
    id: lot.lot_id,
    name: lot.name,
    section: lot.section_id ?? "",
    block: lot.block_id ?? undefined,
    geometry: parseGeometry(lot.geometry),
  };
}

function toDetailedGrave(grave, graveOwners, graveBurials, graveHeadstones, includeOwnership) {
  const detailedGrave = {
    ...toGraveSummary(grave),
    owners: graveOwners.map(toOwner),
    currentOwnerIds: graveOwners.map((owner) => owner.id),
    burials: graveBurials.map(toBurial),
    headstones: graveHeadstones.map(toHeadstone),
    ownershipHistory: graveOwners.map(toOwnershipEvent),
    notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
  };

  return includeOwnership ? detailedGrave : ownershipRedactedGrave(detailedGrave);
}

export async function getCemeteryData(pool) {
  const client = await pool.connect();
  try {
    const cemeteries = await selectActiveCemeteries(client);
    const cemeteryIds = cemeteries.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [] };

    const sections = await selectSectionsForCemeteries(client, cemeteryIds);
    const lots = await selectLotsForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds);

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      graves: graves.map(toGraveSummary),
    };
  } finally {
    client.release();
  }
}

export async function getDetailedCemeteryData(pool, { includeOwnership = true } = {}) {
  const client = await pool.connect();
  try {
    const cemeteries = await selectActiveCemeteries(client);
    const cemeteryIds = cemeteries.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [], owners: [] };

    const sections = await selectSectionsForCemeteries(client, cemeteryIds);
    const lots = await selectLotsForCemeteries(client, cemeteryIds);
    const graves = await selectGravesForCemeteries(client, cemeteryIds, { includeCost: true });
    const owners = includeOwnership ? await selectOwnersForCemeteries(client, cemeteryIds) : [];
    const burials = await selectBurialsForCemeteries(client, cemeteryIds);

    const ownersByGrave = groupBy(owners, "gravesite_uuid");
    const burialsByGrave = groupBy(burials, "gravesite_uuid");

    return {
      boundaries: cemeteries.map(toBoundaryFeature),
      boundary: {
        type: "Feature",
        properties: { name: cemeteries[0].name },
        geometry: parseGeometry(cemeteries[0].geometry),
      },
      sections: sections.map(toSection),
      lots: lots.map(toLot),
      graves: graves.map((grave) => toDetailedGrave(grave, ownersByGrave.get(grave.uuid) ?? [], burialsByGrave.get(grave.uuid) ?? [], [], includeOwnership)),
      owners: owners.map(toOwner),
    };
  } finally {
    client.release();
  }
}

export async function getGraveSpace(pool, cemeteryId, gravesiteId, { includeOwnership = true } = {}) {
  const client = await pool.connect();
  try {
    const grave = await selectGraveByCemeteryAndId(client, cemeteryId, gravesiteId);
    if (!grave) return undefined;

    const owners = includeOwnership ? await selectOwnersForGrave(client, grave.uuid) : [];
    const burials = await selectBurialsForGrave(client, grave.uuid);
    const headstones = await selectHeadstonesForGrave(client, grave.uuid);

    return toDetailedGrave(grave, owners, burials, headstones, includeOwnership);
  } finally {
    client.release();
  }
}

export async function updateHeadstone(pool, id, headstone, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectHeadstoneMutationState(client, id);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const updateResult = await client.query(
      `
        UPDATE headstones
        SET marker_type_id = $2::uuid,
            material_type_id = $3::uuid,
            condition_type_id = $4::uuid,
            condition_notes = $5,
            inscription = $6,
            photo_url = $7,
            last_inspected_at = $8::date
        WHERE id = $1
        RETURNING
          id::text,
          headstone_id,
          marker_type_id::text,
          marker_type_code,
          material_type_id::text,
          material_type_code,
          condition_type_id::text,
          condition,
          condition_notes,
          inscription,
          photo_url,
          last_inspected_at,
          updated_at
      `,
      [
        id,
        headstone.markerTypeId,
        headstone.materialId,
        headstone.conditionId,
        headstone.conditionNotes || null,
        headstone.inscription || null,
        headstone.photoUrl || null,
        headstone.lastInspectedAt || null,
      ],
    );
    const updatedState = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "update",
      targetTable: "headstones",
      targetRecordId: id,
      previousValues: existing,
      newValues: updatedState,
      reason,
    });
    const updated = await selectHeadstoneById(client, id);

    await client.query("COMMIT");
    return { ...toHeadstone(updated), auditEventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function softDeleteGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (existing.deleted_at) {
      await client.query("COMMIT");
      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        deletedAt: existing.deleted_at,
        alreadyDeleted: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = now(),
            deleted_by = $3::uuid,
            delete_reason = $2
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid, reason, actorUser?.id ?? null],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "soft_delete",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    await client.query("COMMIT");
    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      deletedAt: updated.deleted_at,
      auditEventId,
      alreadyDeleted: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function restoreGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason });
    const existing = await selectGraveMutationState(client, cemeteryId, gravesiteId);
    if (!existing) {
      await client.query("ROLLBACK");
      return undefined;
    }

    if (!existing.deleted_at) {
      await client.query("COMMIT");
      return {
        graveSpaceId: existing.gravesite_id,
        cemeteryId: existing.cemetery_id,
        restored: true,
        alreadyActive: true,
      };
    }

    const updateResult = await client.query(
      `
        UPDATE gravesites
        SET deleted_at = NULL,
            deleted_by = NULL,
            delete_reason = NULL
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await auditEventIdForMutation(client, {
      actorUser,
      action: "restore",
      targetTable: "gravesites",
      targetRecordId: existing.uuid,
      previousValues: existing,
      newValues: updated,
      reason,
    });

    await client.query("COMMIT");
    return {
      graveSpaceId: updated.gravesite_id,
      cemeteryId: existing.cemetery_id,
      restored: true,
      auditEventId,
      alreadyActive: false,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
