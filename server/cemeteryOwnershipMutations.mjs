import { setAuditContext } from "./auditContext.mjs";
import { ownershipRightNotes, selectOwnershipTargets } from "./cemeteryOwnershipQueries.mjs";

export async function createOwnershipEvent(
  pool,
  cemeteryId,
  selectedGravesiteId,
  { ownerDisplayName, eventType, targetScope, targetGravesiteIds = [], effectiveDate, documentReference, notes },
  { actorUser, reason, allowedCemeteryIds } = {},
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason: reason ?? "Ownership event update" });

    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const targets = await selectOwnershipTargets(client, cemeteryId, selectedGravesiteId, targetScope, targetGravesiteIds);
    if (!targets) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const partyResult = await client.query(
      `
        INSERT INTO ownership_parties (display_name)
        SELECT $1
        WHERE NOT EXISTS (
          SELECT 1
          FROM ownership_parties
          WHERE display_name = $1
            AND deleted_at IS NULL
        )
        RETURNING id::text
      `,
      [ownerDisplayName],
    );
    const partyId =
      partyResult.rows[0]?.id ??
      (
        await client.query(
          `
            SELECT id::text
            FROM ownership_parties
            WHERE display_name = $1
              AND deleted_at IS NULL
            ORDER BY created_at, id
            LIMIT 1
          `,
          [ownerDisplayName],
        )
      ).rows[0]?.id;

    const eventResult = await client.query(
      `
        INSERT INTO ownership_events (
          cemetery_id,
          event_type,
          effective_date,
          recorded_by,
          document_reference,
          notes,
          source_table
        )
        VALUES ($1, $2, NULLIF($3, '')::date, $4, NULLIF($5, ''), NULLIF($6, ''), 'manual_ownership_workflow')
        RETURNING id::text
      `,
      [cemeteryId, eventType, effectiveDate ?? "", actorUser?.email ?? "Cemetery database", documentReference ?? "", notes ?? ""],
    );
    const eventId = eventResult.rows[0].id;

    await client.query(
      `
        INSERT INTO ownership_event_parties (ownership_event_uuid, ownership_party_uuid, ownership_role)
        VALUES ($1, $2, 'owner')
      `,
      [eventId, partyId],
    );

    for (const right of targets.rights) {
      await client.query(
        `
          INSERT INTO ownership_event_rights (
            ownership_event_uuid,
            target_type,
            lot_uuid,
            gravesite_uuid,
            right_type,
            notes
          )
          VALUES ($1, $2, $3::uuid, $4::uuid, 'burial_right', $5)
        `,
        [
          eventId,
          right.targetType,
          right.lotUuid ?? null,
          right.gravesiteUuid ?? null,
          ownershipRightNotes({ right_type: "burial_right", target_type: right.targetType, notes: `Manual ownership workflow target: ${right.label}.` }),
        ],
      );
    }

    await client.query("COMMIT");
    return { id: eventId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
