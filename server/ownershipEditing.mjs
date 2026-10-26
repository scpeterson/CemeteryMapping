import {createHash} from 'node:crypto';
import {BadRequestError} from './requestValidation.mjs';

export async function readOwnershipEditor(client, eventId, allowedCemeteryIds, {lock=false}={}) {
 const {rows:[event]}=await client.query(`SELECT e.*,e.updated_at::text AS revision_updated_at FROM ownership_events e
  WHERE e.id=$1 AND e.deleted_at IS NULL AND ($2::uuid[] IS NULL OR e.cemetery_id=ANY($2::uuid[])) ${lock?'FOR UPDATE':''}`,[eventId,allowedCemeteryIds??null]);
 if(!event)return undefined;
 const {rows:parties}=await client.query(`SELECT p.*,p.updated_at::text AS revision_updated_at,ep.ownership_role,ep.share_numerator,ep.share_denominator
  FROM ownership_event_parties ep JOIN ownership_parties p ON p.id=ep.ownership_party_uuid
  WHERE ep.ownership_event_uuid=$1 ORDER BY ep.ownership_role,p.id ${lock?'FOR UPDATE OF ep,p':''}`,[eventId]);
 const {rows:rights}=await client.query(`SELECT r.*,r.updated_at::text AS revision_updated_at,g.gravesite_id FROM ownership_event_rights r
  LEFT JOIN gravesites g ON g.id=r.gravesite_uuid WHERE r.ownership_event_uuid=$1 AND r.deleted_at IS NULL ORDER BY r.id ${lock?'FOR UPDATE OF r':''}`,[eventId]);
 if(!['deed','sale','gift','church_council_action','correction','release'].includes(event.event_type)
  || parties.some(p=>p.deleted_at || !['owner','grantee','grantor'].includes(p.ownership_role))
  || rights.some(r=>!['lot','gravesite'].includes(r.target_type)||r.right_type!=='burial_right')
  || (rights.some(r=>r.target_type==='lot')&&rights.length!==1))
  throw new BadRequestError('This ownership uses legacy or mixed rights that need administrator review before editing.');
 const partyInput=p=>({ownershipPartyId:p.id,firstName:p.first_name||'',lastName:p.last_name||(p.first_name?'':p.display_name)||'',fullAddress:p.full_address||'',municipality:p.municipality||'',state:p.state||'',zip:p.zip||'',shareNumerator:p.share_numerator==null?'':String(p.share_numerator),shareDenominator:p.share_denominator==null?'':String(p.share_denominator)});
 return {id:event.id,cemeteryId:event.cemetery_id,expectedRevision:createHash('sha256').update(JSON.stringify({event,parties,rights})).digest('hex'),
  eventType:event.event_type,effectiveDate:event.effective_date_text||(event.effective_date instanceof Date?event.effective_date.toISOString().slice(0,10):event.effective_date)||'',
  deedOnFile:event.deed_on_file,deedRegisterOnFile:event.deed_register_on_file,documentReference:event.document_reference||'',notes:event.notes||'',
  owners:parties.filter(p=>p.ownership_role!=='grantor').map(partyInput),previousOwners:parties.filter(p=>p.ownership_role==='grantor').map(partyInput),
  targetScope:rights[0]?.target_type==='lot'?'selected_lot':'listed_gravesites',targetGravesiteIds:rights.filter(r=>r.target_type==='gravesite').map(r=>r.gravesite_id),
  rights,partyRecords:parties};
}

export async function getOwnershipEditor(pool,eventId,{allowedCemeteryIds}={}) {
 const client=await pool.connect();
 try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const data=await readOwnershipEditor(client,eventId,allowedCemeteryIds);
  await client.query('COMMIT');
  if(!data)return undefined;
  const {rights,partyRecords,...editable}=data;
  void rights;void partyRecords;
  return editable;
 } catch(error){await client.query('ROLLBACK');throw error;}
 finally{client.release();}
}
