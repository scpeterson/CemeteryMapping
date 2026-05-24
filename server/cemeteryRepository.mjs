const statusMap = new Map([
  ["available", "available"],
  ["reserved", "reserved"],
  ["occupied", "occupied"],
  ["sold", "sold"],
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

function toMutationActor(user) {
  if (!user) return {};
  return {
    actorExternalSubject: user.subject,
    actorEmail: user.email,
    actorRole: user.role,
  };
}

async function insertAuditEvent(client, { actor, action, targetTable, targetRecordId, previousValues, newValues, reason }) {
  const result = await client.query(
    `
      INSERT INTO audit_events (
        actor_external_subject,
        actor_email,
        actor_role,
        action,
        target_table,
        target_record_id,
        previous_values,
        new_values,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
      RETURNING id::text
    `,
    [
      actor.actorExternalSubject,
      actor.actorEmail,
      actor.actorRole,
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

export async function getCemeteryData(pool) {
  const client = await pool.connect();
  try {
    const cemeteryResult = await client.query(`
      SELECT id::text, name, ST_AsGeoJSON(geometry)::json AS geometry
      FROM cemeteries
      WHERE deleted_at IS NULL
      ORDER BY name, id
    `);

    const cemeteryIds = cemeteryResult.rows.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [] };

    const sectionsResult = await client.query(
      `
        SELECT id::text, section_id, COALESCE(name, section_id) AS name, ST_AsGeoJSON(geometry)::json AS geometry
        FROM sections
        WHERE cemetery_id = ANY($1::uuid[])
          AND deleted_at IS NULL
        ORDER BY section_id, name
      `,
      [cemeteryIds],
    );
    const lotsResult = await client.query(
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
    const gravesitesResult = await client.query(
      `
        SELECT
          gravesites.cemetery_id::text,
          cemeteries.name AS cemetery_name,
          gravesites.section_id,
          gravesites.lot_id,
          gravesites.grave_id,
          gravesites.gravesite_id,
          gravesites.status,
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

    return {
      boundaries: cemeteryResult.rows.map((cemetery) => ({
        type: "Feature",
        properties: { name: cemetery.name },
        geometry: parseGeometry(cemetery.geometry),
      })),
      boundary: {
        type: "Feature",
        properties: { name: cemeteryResult.rows[0].name },
        geometry: parseGeometry(cemeteryResult.rows[0].geometry),
      },
      sections: sectionsResult.rows.map((section) => ({
        id: section.section_id,
        name: section.name,
        geometry: parseGeometry(section.geometry),
      })),
      lots: lotsResult.rows.map((lot) => ({
        id: lot.lot_id,
        name: lot.name,
        section: lot.section_id ?? "",
        block: lot.block_id ?? undefined,
        geometry: parseGeometry(lot.geometry),
      })),
      graves: gravesitesResult.rows.map(toGraveSummary),
    };
  } finally {
    client.release();
  }
}

export async function getDetailedCemeteryData(pool) {
  const client = await pool.connect();
  try {
    const cemeteryResult = await client.query(`
      SELECT id::text, name, ST_AsGeoJSON(geometry)::json AS geometry
      FROM cemeteries
      WHERE deleted_at IS NULL
      ORDER BY name, id
    `);

    const cemeteryIds = cemeteryResult.rows.map((cemetery) => cemetery.id);
    if (cemeteryIds.length === 0) return { sections: [], lots: [], graves: [], owners: [] };

    const sectionsResult = await client.query(
      `
        SELECT id::text, section_id, COALESCE(name, section_id) AS name, ST_AsGeoJSON(geometry)::json AS geometry
        FROM sections
        WHERE cemetery_id = ANY($1::uuid[])
          AND deleted_at IS NULL
        ORDER BY section_id, name
      `,
      [cemeteryIds],
    );
    const lotsResult = await client.query(
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
    const gravesitesResult = await client.query(
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
        WHERE gravesites.cemetery_id = ANY($1::uuid[])
          AND gravesites.deleted_at IS NULL
        ORDER BY cemeteries.name, gravesites.section_id, gravesites.lot_id, gravesites.grave_id, gravesites.gravesite_id
      `,
      [cemeteryIds],
    );
    const ownersResult = await client.query(
      `
        SELECT id::text, gravesite_uuid::text, owner, co_owner, full_address, phone, email, sale_date, notes, created_at
        FROM owners
        WHERE deleted_at IS NULL
          AND gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
        ORDER BY sale_date DESC NULLS LAST, created_at DESC, id
      `,
      [cemeteryIds],
    );
    const burialsResult = await client.query(
      `
        SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, funeral_home, notes
        FROM burials
        WHERE deleted_at IS NULL
          AND gravesite_uuid IN (SELECT id FROM gravesites WHERE cemetery_id = ANY($1::uuid[]) AND deleted_at IS NULL)
        ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name
      `,
      [cemeteryIds],
    );

    const ownersByGrave = groupBy(ownersResult.rows, "gravesite_uuid");
    const burialsByGrave = groupBy(burialsResult.rows, "gravesite_uuid");

    return {
      boundaries: cemeteryResult.rows.map((cemetery) => ({
        type: "Feature",
        properties: { name: cemetery.name },
        geometry: parseGeometry(cemetery.geometry),
      })),
      boundary: {
        type: "Feature",
        properties: { name: cemeteryResult.rows[0].name },
        geometry: parseGeometry(cemeteryResult.rows[0].geometry),
      },
      sections: sectionsResult.rows.map((section) => ({
        id: section.section_id,
        name: section.name,
        geometry: parseGeometry(section.geometry),
      })),
      lots: lotsResult.rows.map((lot) => ({
        id: lot.lot_id,
        name: lot.name,
        section: lot.section_id ?? "",
        block: lot.block_id ?? undefined,
        geometry: parseGeometry(lot.geometry),
      })),
      graves: gravesitesResult.rows.map((grave) => {
        const graveOwners = ownersByGrave.get(grave.uuid) ?? [];

        return {
          ...toGraveSummary(grave),
          owners: graveOwners.map(toOwner),
          currentOwnerIds: graveOwners.map((owner) => owner.id),
          burials: (burialsByGrave.get(grave.uuid) ?? []).map(toBurial),
          ownershipHistory: graveOwners.map(toOwnershipEvent),
          notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
        };
      }),
      owners: ownersResult.rows.map(toOwner),
    };
  } finally {
    client.release();
  }
}

export async function getGraveSpace(pool, cemeteryId, gravesiteId) {
  const client = await pool.connect();
  try {
    const graveResult = await client.query(
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

    const grave = graveResult.rows[0];
    if (!grave) return undefined;

    const ownersResult = await client.query(
      `
        SELECT id::text, gravesite_uuid::text, owner, co_owner, full_address, phone, email, sale_date, notes, created_at
        FROM owners
        WHERE gravesite_uuid = $1
          AND deleted_at IS NULL
        ORDER BY sale_date DESC NULLS LAST, created_at DESC, id
      `,
      [grave.uuid],
    );
    const burialsResult = await client.query(
      `
        SELECT id::text, gravesite_uuid::text, first_name, last_name, full_name, birth_date, death_date, burial_date, funeral_home, notes
        FROM burials
        WHERE gravesite_uuid = $1
          AND deleted_at IS NULL
        ORDER BY burial_date DESC NULLS LAST, death_date DESC NULLS LAST, last_name, first_name
      `,
      [grave.uuid],
    );

    return {
      ...toGraveSummary(grave),
      owners: ownersResult.rows.map(toOwner),
      currentOwnerIds: ownersResult.rows.map((owner) => owner.id),
      burials: burialsResult.rows.map(toBurial),
      ownershipHistory: ownersResult.rows.map(toOwnershipEvent),
      notes: grave.cost ? `Recorded cost: $${grave.cost}` : undefined,
    };
  } finally {
    client.release();
  }
}

export async function softDeleteGraveSpace(pool, cemeteryId, gravesiteId, { actorUser, reason } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
            deleted_by = NULL,
            delete_reason = $2,
            updated_at = now()
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid, reason],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await insertAuditEvent(client, {
      actor: toMutationActor(actorUser),
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
            delete_reason = NULL,
            updated_at = now()
        WHERE id = $1
        RETURNING id::text AS uuid, gravesite_id, deleted_at, deleted_by::text, delete_reason, updated_at
      `,
      [existing.uuid],
    );
    const updated = updateResult.rows[0];
    const auditEventId = await insertAuditEvent(client, {
      actor: toMutationActor(actorUser),
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
