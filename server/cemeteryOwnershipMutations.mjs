import {readOwnershipEditor} from "./ownershipEditing.mjs";
import {BadRequestError, ConflictError} from "./requestValidation.mjs";
import { withAuditContext } from "./auditContext.mjs";
import { splitRecordedDate } from "./burialRepository.mjs";
import { ownershipRightNotes, selectOwnershipTargets } from "./cemeteryOwnershipQueries.mjs";

export async function createOwnershipEvent(
  pool,
  cemeteryId,
  selectedGravesiteId,
  { owners, previousOwners = [], eventType, targetScope, targetGravesiteIds = [], effectiveDate, deedOnFile = false, deedRegisterOnFile = false, documentReference, notes },
  { actorUser, reason, allowedCemeteryIds, editingEventId, expectedRevision } = {},
) {
  return withAuditContext(pool, { actorUser, reason: reason ?? "Ownership event update" }, async (client, rollback) => {
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) {
      return rollback(undefined);
    }

    let editing;
    if (editingEventId) {
      if (!actorUser || !["admin", "cemetery-admin"].includes(actorUser.role)) {
        const error = new Error("A cemetery or system admin is required to edit ownership assignments."); error.statusCode=403; throw error;
      }
      if (!/^[a-f0-9]{64}$/.test(expectedRevision || "")) throw new BadRequestError("Ownership version is required. Reopen the ownership editor.");
      editing=await readOwnershipEditor(client,editingEventId,allowedCemeteryIds,{lock:true});
      if (!editing || editing.cemeteryId!==cemeteryId) return rollback(undefined);
      if (editing.expectedRevision!==expectedRevision) throw new ConflictError("This ownership changed since you opened it. Reopen the editor before saving.");
      await client.query(`UPDATE ownership_event_rights SET deleted_at=clock_timestamp(),deleted_by=$2,delete_reason=$3,updated_at=clock_timestamp()
        WHERE ownership_event_uuid=$1 AND deleted_at IS NULL`,[editingEventId,actorUser.id??null,reason||"Ownership assignments updated"]);
    }

    const targets = await selectOwnershipTargets(client, cemeteryId, selectedGravesiteId, targetScope, targetGravesiteIds);
    if (!targets) {
      return rollback(undefined);
    }

    if (targetScope === "selected_lot") {
      const directOwners = await client.query(
        `SELECT DISTINCT party.display_name
         FROM current_ownership_right_owners current_owner
         JOIN gravesites gravesite
           ON current_owner.target_type = 'gravesite'
          AND current_owner.gravesite_uuid = gravesite.id
         JOIN ownership_parties party ON party.id = current_owner.ownership_party_uuid
         WHERE gravesite.lot_uuid = $1
         ORDER BY party.display_name`,
        [targets.selectedGrave.lot_uuid],
      );
      const normalizeOwnerName = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/gu, "");
      const existingNames = new Set(directOwners.rows.map((row) => normalizeOwnerName(row.display_name)).filter(Boolean));
      const submittedNames = new Set(owners.map((owner) => normalizeOwnerName([owner.firstName, owner.lastName].filter(Boolean).join(" "))).filter(Boolean));
      const sameOwners = existingNames.size === submittedNames.size && [...existingNames].every((name) => submittedNames.has(name));
      if (existingNames.size && !sameOwners) {
        const labels = directOwners.rows.map((row) => row.display_name).join(", ");
        throw new Error(`Whole-lot ownership conflicts with direct gravesite ownership by ${labels}. Select specific gravesites instead.`);
      }
    }

    const recordedEffectiveDate = splitRecordedDate(effectiveDate);
    let eventId;
    if (editing) {
      await client.query(`UPDATE ownership_events SET event_type=$2::text,event_type_id=(SELECT id FROM lot_ownership_event_types WHERE code=$2::text),effective_date=$3::date,effective_date_text=$4,
        deed_on_file=$5,deed_register_on_file=$6,document_reference=NULLIF($7,''),notes=NULLIF($8,''),updated_at=clock_timestamp() WHERE id=$1`,
        [editingEventId,eventType,recordedEffectiveDate.date,recordedEffectiveDate.text,deedOnFile,deedRegisterOnFile,documentReference||'',notes||'']);
      await client.query('DELETE FROM ownership_event_parties WHERE ownership_event_uuid=$1',[editingEventId]);
      eventId=editingEventId;
    } else {
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
      eventId = eventResult.rows[0].id;

    }

    const insertParty = async (party, role) => {
      const displayName = [party.firstName, party.lastName].filter(Boolean).join(" ");
      const original=editing && party.ownershipPartyId ? editing.partyRecords.find(p=>p.id===party.ownershipPartyId) : undefined;
      if (editing && party.ownershipPartyId && !original) throw new BadRequestError("An owner does not belong to this ownership record.");
      const partyResult = original ? await client.query(`
        INSERT INTO ownership_parties(display_name,first_name,last_name,full_address,municipality,state,zip,contact_name,phone,email,notes)
        VALUES($1,NULLIF($2,''),NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),$8,$9,$10,$11) RETURNING id::text`,
        [displayName,party.firstName,party.lastName,party.fullAddress,party.municipality,party.state,party.zip,original.contact_name,original.phone,original.email,original.notes]) : await client.query(
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
      const previous=editing?.rights.find(old=>old.target_type===right.targetType && (right.targetType==="lot" ? old.lot_uuid===right.lotUuid : old.gravesite_uuid===right.gravesiteUuid));
      if(previous) {
        await client.query(`UPDATE ownership_event_rights SET deleted_at=NULL,deleted_by=NULL,delete_reason=NULL,updated_at=clock_timestamp() WHERE id=$1`,[previous.id]);
        continue;
      }
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

    return { id: eventId };

  });
}

export async function updateOwnershipParty(pool, partyId, eventId, update, { actorUser, reason, allowedCemeteryIds } = {}) {
  return withAuditContext(pool, { actorUser, reason: reason ?? "Owner information update" }, async (client, rollback) => {
    const scope = await client.query(
      `SELECT 1 FROM ownership_event_parties ep
       JOIN ownership_events oe ON oe.id = ep.ownership_event_uuid
       WHERE ep.ownership_party_uuid = $1 AND ep.ownership_event_uuid = $2
         AND oe.deleted_at IS NULL
         AND ($3::uuid[] IS NULL OR oe.cemetery_id = ANY($3::uuid[]))`,
      [partyId, eventId, allowedCemeteryIds ?? null],
    );
    if (!scope.rowCount) {
      return rollback(undefined);
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

    return { id: partyId };

  });
}

export async function removeGravesiteOwnershipRight(pool, rightId, { actorUser, reason, allowedCemeteryIds } = {}) {
  return withAuditContext(pool, { actorUser, reason: reason ?? "Remove incorrect gravesite ownership connection" }, async (client, rollback) => {
    const result = await client.query(
      `UPDATE ownership_event_rights right_record
       SET deleted_at = now(), deleted_by = $2, delete_reason = $3, updated_at = now()
       WHERE right_record.id = $1
         AND right_record.target_type = 'gravesite'
         AND right_record.deleted_at IS NULL
         AND ($4::uuid[] IS NULL OR right_record.cemetery_id = ANY($4::uuid[]))
       RETURNING right_record.id::text`,
      [rightId, actorUser?.email ?? "Cemetery database", reason ?? "Incorrect gravesite ownership connection", allowedCemeteryIds ?? null],
    );
    if (!result.rowCount) {
      return rollback(undefined);
    }

    return result.rows[0];

  });
}
