import { setAuditContext } from "./auditContext.mjs";
import { splitRecordedDate } from "./burialRepository.mjs";
import { ownershipRightNotes, selectOwnershipTargets } from "./cemeteryOwnershipQueries.mjs";

export async function createOwnershipEvent(
  pool,
  cemeteryId,
  selectedGravesiteId,
  { owners, previousOwners = [], eventType, targetScope, targetGravesiteIds = [], effectiveDate, deedOnFile = false, deedRegisterOnFile = false, documentReference, notes },
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

    const recordedEffectiveDate = splitRecordedDate(effectiveDate);
    const eventResult = await client.query(
      `
        INSERT INTO ownership_events (
          cemetery_id,
          event_type,
          effective_date,
          effective_date_text,
          deed_on_file,
          deed_register_on_file,
          recorded_by,
          document_reference,
          notes,
          source_table
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7, NULLIF($8, ''), NULLIF($9, ''), 'manual_ownership_workflow')
        RETURNING id::text
      `,
      [
        cemeteryId,
        eventType,
        recordedEffectiveDate.date,
        recordedEffectiveDate.text,
        deedOnFile,
        deedRegisterOnFile,
        actorUser?.email ?? "Cemetery database",
        documentReference ?? "",
        notes ?? "",
      ],
    );
    const eventId = eventResult.rows[0].id;

    const insertParty = async (party, role) => {
      const displayName = [party.firstName, party.lastName].filter(Boolean).join(" ");
      const partyResult = await client.query(
        `
          INSERT INTO ownership_parties (display_name, first_name, last_name, full_address, municipality, state, zip)
          VALUES ($1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''))
          RETURNING id::text
        `,
        [displayName, party.firstName, party.lastName, party.fullAddress, party.municipality, party.state, party.zip],
      );
      await client.query(
        `
          INSERT INTO ownership_event_parties (
            ownership_event_uuid, ownership_party_uuid, ownership_role, share_numerator, share_denominator
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [eventId, partyResult.rows[0].id, role, party.shareNumerator, party.shareDenominator],
      );
    };

    const recipientRole = ["sale", "gift"].includes(eventType) ? "grantee" : "owner";
    for (const party of previousOwners) await insertParty(party, "grantor");
    for (const party of owners) await insertParty(party, recipientRole);

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

export async function updateOwnershipParty(pool, partyId, eventId, update, { actorUser, reason, allowedCemeteryIds } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setAuditContext(client, { actorUser, reason: reason ?? "Owner information update" });
    const scope = await client.query(
      `SELECT 1 FROM ownership_event_parties ep
       JOIN ownership_events oe ON oe.id = ep.ownership_event_uuid
       WHERE ep.ownership_party_uuid = $1 AND ep.ownership_event_uuid = $2
         AND oe.deleted_at IS NULL
         AND ($3::uuid[] IS NULL OR oe.cemetery_id = ANY($3::uuid[]))`,
      [partyId, eventId, allowedCemeteryIds ?? null],
    );
    if (!scope.rowCount) {
      await client.query("ROLLBACK");
      return undefined;
    }
    const recordedEffectiveDate = splitRecordedDate(update.effectiveDate);
    await client.query(
      `UPDATE ownership_parties SET display_name=$2, first_name=NULLIF($3, ''), last_name=NULLIF($4, ''),
         full_address=NULLIF($5, ''), municipality=NULLIF($6, ''), state=NULLIF($7, ''), zip=NULLIF($8, ''), updated_at=now()
       WHERE id=$1`,
      [partyId, [update.firstName, update.lastName].filter(Boolean).join(" "), update.firstName, update.lastName, update.fullAddress, update.municipality, update.state, update.zip],
    );
    await client.query(
      `UPDATE ownership_events SET effective_date=$2::date, effective_date_text=$3, deed_on_file=$4, deed_register_on_file=$5, updated_at=now()
       WHERE id=$1`,
      [eventId, recordedEffectiveDate.date, recordedEffectiveDate.text, update.deedOnFile, update.deedRegisterOnFile],
    );
    await client.query("COMMIT");
    return { id: partyId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
