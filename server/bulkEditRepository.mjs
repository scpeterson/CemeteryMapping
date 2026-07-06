import { withAuditContext } from "./auditContext.mjs";

function normalizeIdentifiers(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function scopedCemeterySql(alias, allowedCemeteryIds, values) {
  if (!Array.isArray(allowedCemeteryIds)) return "";
  values.push(allowedCemeteryIds);
  return `AND ${alias}.cemetery_id = ANY($${values.length}::uuid[])`;
}

function summary(requestedIds, rows, key = "lookup_id") {
  const matched = new Set(rows.map((row) => String(row[key] ?? "").trim()).filter(Boolean));
  return {
    requestedCount: requestedIds.length,
    matchedCount: matched.size,
    updatedCount: rows.length,
    notFound: requestedIds.filter((id) => !matched.has(id)),
  };
}

export async function bulkUpdateHeadstones(pool, update, { actorUser, reason, allowedCemeteryIds } = {}) {
  const identifiers = normalizeIdentifiers(update.identifiers);
  const assignments = [
    update.markerTypeId ? "marker_type_id = $2::uuid" : "",
    update.materialId ? "material_type_id = $3::uuid" : "",
    update.conditionId ? "condition_type_id = $4::uuid" : "",
  ].filter(Boolean);
  if (identifiers.length === 0 || assignments.length === 0) return { requestedCount: identifiers.length, matchedCount: 0, updatedCount: 0, notFound: identifiers };

  return withAuditContext(pool, { actorUser, reason }, async (client) => {
    const values = [identifiers, update.markerTypeId || null, update.materialId || null, update.conditionId || null];
    const cemeteryFilter = scopedCemeterySql("headstones", allowedCemeteryIds, values);
    const result = await client.query(
      `
        WITH matched AS (
          SELECT
            headstones.id,
            input.identifier AS lookup_id,
            input.ordinal
          FROM unnest($1::text[]) WITH ORDINALITY AS input(identifier, ordinal)
          JOIN headstones
            ON (
              headstones.id::text = input.identifier
              OR headstones.headstone_id = input.identifier
            )
           AND headstones.deleted_at IS NULL
          WHERE 1 = 1
            ${cemeteryFilter}
        ),
        selected AS (
          SELECT DISTINCT ON (id) id, lookup_id
          FROM matched
          ORDER BY id, ordinal
        ),
        updated AS (
          UPDATE headstones
          SET ${assignments.join(", ")},
              updated_at = now()
          FROM selected
          WHERE headstones.id = selected.id
          RETURNING selected.lookup_id
        )
        SELECT lookup_id
        FROM updated
      `,
      values,
    );

    return summary(identifiers, result.rows);
  });
}

export async function bulkAssignGravesitesToLot(pool, update, { actorUser, reason, allowedCemeteryIds } = {}) {
  const identifiers = normalizeIdentifiers(update.identifiers);
  if (identifiers.length === 0) return { requestedCount: 0, matchedCount: 0, updatedCount: 0, notFound: [] };

  return withAuditContext(pool, { actorUser, reason }, async (client) => {
    const lotResult = await client.query(
      `
        SELECT id, cemetery_id, section_id, lot_id
        FROM lots
        WHERE id = $1
          AND deleted_at IS NULL
      `,
      [update.lotId],
    );
    const lot = lotResult.rows[0];
    if (!lot) return { requestedCount: identifiers.length, matchedCount: 0, updatedCount: 0, notFound: identifiers, invalid: "lot_not_found" };
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(String(lot.cemetery_id))) {
      return { requestedCount: identifiers.length, matchedCount: 0, updatedCount: 0, notFound: identifiers, forbidden: true };
    }

    const values = [identifiers, lot.id, lot.cemetery_id, lot.section_id, lot.lot_id];
    const result = await client.query(
      `
        WITH matched AS (
          SELECT
            gravesites.id,
            input.identifier AS lookup_id,
            input.ordinal
          FROM unnest($1::text[]) WITH ORDINALITY AS input(identifier, ordinal)
          JOIN gravesites
            ON (
              gravesites.id::text = input.identifier
              OR gravesites.gravesite_id = input.identifier
            )
           AND gravesites.deleted_at IS NULL
           AND gravesites.cemetery_id = $3
        ),
        selected AS (
          SELECT DISTINCT ON (id) id, lookup_id
          FROM matched
          ORDER BY id, ordinal
        ),
        updated AS (
          UPDATE gravesites
          SET lot_uuid = $2::uuid,
              section_id = COALESCE($4, section_id),
              lot_id = $5,
              updated_at = now()
          FROM selected
          WHERE gravesites.id = selected.id
          RETURNING selected.lookup_id
        )
        SELECT lookup_id
        FROM updated
      `,
      values,
    );

    return summary(identifiers, result.rows);
  });
}

export async function bulkMarkNorthHillsReviewed(pool, update, { actorUser, reason, allowedCemeteryIds } = {}) {
  const identifiers = normalizeIdentifiers(update.entryIds);
  if (identifiers.length === 0) return { requestedCount: 0, matchedCount: 0, updatedCount: 0, notFound: [] };

  return withAuditContext(pool, { actorUser, reason }, async (client) => {
    const values = [identifiers];
    const cemeteryFilter = scopedCemeterySql("entry", allowedCemeteryIds, values);
    const result = await client.query(
      `
        WITH selected AS (
          SELECT entry.id, entry.id::text AS lookup_id
          FROM north_hills_ocr_entries entry
          WHERE entry.id::text = ANY($1::text[])
            ${cemeteryFilter}
        ),
        updated AS (
          UPDATE north_hills_ocr_entries entry
          SET status = 'reviewed',
              updated_at = now()
          FROM selected
          WHERE entry.id = selected.id
          RETURNING selected.lookup_id
        )
        SELECT lookup_id
        FROM updated
      `,
      values,
    );

    return summary(identifiers, result.rows);
  });
}

export async function bulkAddNorthHillsEntryNote(pool, update, { actorUser, reason, allowedCemeteryIds } = {}) {
  const identifiers = normalizeIdentifiers(update.entryIds);
  const note = String(update.note ?? "").trim();
  if (identifiers.length === 0 || !note) return { requestedCount: identifiers.length, matchedCount: 0, updatedCount: 0, notFound: identifiers };

  return withAuditContext(pool, { actorUser, reason }, async (client) => {
    const values = [identifiers, note];
    const cemeteryFilter = scopedCemeterySql("entry", allowedCemeteryIds, values);
    const result = await client.query(
      `
        WITH selected AS (
          SELECT entry.id, entry.id::text AS lookup_id
          FROM north_hills_ocr_entries entry
          WHERE entry.id::text = ANY($1::text[])
            ${cemeteryFilter}
        ),
        inserted AS (
          INSERT INTO north_hills_ocr_entry_observations (entry_id, observation_type, observation_text, status)
          SELECT selected.id, 'entry_note', $2, 'staged'
          FROM selected
          ON CONFLICT (entry_id, observation_type, observation_text)
          DO UPDATE SET status = EXCLUDED.status,
                        updated_at = now()
          RETURNING entry_id::text AS lookup_id
        )
        SELECT lookup_id
        FROM inserted
      `,
      values,
    );

    return summary(identifiers, result.rows);
  });
}
