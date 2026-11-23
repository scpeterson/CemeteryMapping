import { withAuditContext } from './auditContext.mjs';
import { auditEventIdForMutation } from './cemeteryAudit.mjs';
import { updateBurial } from './cemeteryBurialMutations.mjs';
import { selectOwnersForGrave } from './cemeteryOwnershipQueries.mjs';
import { beginFieldOperation, completeFieldOperation, fieldRequestHash, fieldTransactionPool } from './fieldOperationReceipts.mjs';
import { assertRecordVersion } from './recordVersions.mjs';
import { ConflictError } from './requestValidation.mjs';
import { splitRecordedDate } from './burialRepository.mjs';

export async function createBurial(pool, cemeteryId, gravesiteId, input, { actorUser, allowedCemeteryIds } = {}) {
  return withAuditContext(pool, { actorUser, reason: input.reason }, async (client, rollback) => {
    if (Array.isArray(allowedCemeteryIds) && !allowedCemeteryIds.includes(cemeteryId)) return rollback(undefined);
    const grave = (await client.query(`SELECT id, xmin::text AS version FROM gravesites
      WHERE cemetery_id=$1 AND gravesite_id=$2 AND deleted_at IS NULL FOR UPDATE`, [cemeteryId, gravesiteId])).rows[0];
    if (!grave) return rollback(undefined);
    const receipt = await beginFieldOperation(client, actorUser, input.operationId, fieldRequestHash({ cemeteryId, gravesiteId, input }));
    if (receipt.replayed) return receipt.response;
    assertRecordVersion(grave.version, input.expectedVersion);
    if (input.sourceOwnerId) {
      const owner = (await selectOwnersForGrave(client, grave.id)).find(row => row.id === input.sourceOwnerId);
      if (!owner || (input.sourceOwnerVersion && owner.version !== input.sourceOwnerVersion)) {
        throw new ConflictError('The selected deed holder changed. Reload the gravesite and review the person before adding the burial.');
      }
    }
    const birth = splitRecordedDate(input.birthDate);
    const duplicate = await client.query(`SELECT id FROM burials WHERE gravesite_uuid=$1
      AND lower(btrim(coalesce(first_name,'')))=lower($2)
      AND lower(btrim(coalesce(last_name,'')))=lower($3)
      AND lower(btrim(coalesce(name_suffix,'')))=lower($4)
      AND lower(btrim(coalesce(display_name,'')))=lower($5)
      AND coalesce(nullif(birth_date_text,''),birth_date::text,'')=$6 LIMIT 1`,
    [grave.id, input.firstName, input.lastName, input.nameSuffix, input.displayName || '', birth.text || birth.date || '']);
    if (duplicate.rows.length) throw new ConflictError('A matching person is already recorded for this gravesite. Edit the existing record, or review deleted-record recovery, instead of adding another.');
    const created = (await client.query(`INSERT INTO burials(gravesite_uuid,interment_type_id,burial_record_status_type_id,source_properties)
      VALUES($1,(SELECT id FROM burial_interment_types WHERE code=$2 AND is_active),
        (SELECT id FROM burial_record_status_types WHERE code=$3 AND is_active),$4::jsonb)
      RETURNING id::text`, [grave.id, input.intermentType, input.recordStatusCode, JSON.stringify({
      AddBurial: { operationId: input.operationId, sourceOwnerId: input.sourceOwnerId || null, sourceOwnerVersion: input.sourceOwnerVersion || null },
    })])).rows[0];
    // Use the established normalization/lookup checks inside this outer transaction.
    const saved = await updateBurial(fieldTransactionPool(client), created.id, { ...input, expectedVersion: undefined }, {
      actorUser, reason: input.reason, allowedCemeteryIds: [cemeteryId],
    });
    const auditEventId = await auditEventIdForMutation(client, { actorUser, action: 'create', targetTable: 'burials', targetRecordId: created.id, newValues: saved, reason: input.reason });
    const response = { ...saved, auditEventId };
    await completeFieldOperation(client, actorUser, input.operationId, response);
    return response;
  });
}
