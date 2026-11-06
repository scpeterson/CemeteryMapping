import {BadRequestError,ConflictError} from './requestValidation.mjs';
import {requiredText,validateUuid} from './inputValidation.mjs';
import {fieldRequestHash} from './fieldOperationReceipts.mjs';
import {withAuditContext} from './auditContext.mjs';
import {auditEventIdForMutation} from './cemeteryAudit.mjs';
import {recoveryMarkerScope} from './recordRecoveryRepository.mjs';
import {getBurial} from './cemeteryBurialMutations.mjs';

const references={headstone_burials:'burial_uuid',burial_military_decorations:'burial_uuid',memorials:'burial_uuid',north_hills_ocr_source_facts:'promoted_burial_uuid',source_person_record_links:'burial_uuid',burial_place_evidence:'burial_uuid'};
export function replaceFaceBurialIds(faces,sourceId,targetId){return faces.map(face=>Array.isArray(face.burialIds)&&face.burialIds.includes(sourceId)?{...face,burialIds:[...new Set(face.burialIds.map(id=>id===sourceId?targetId:id))]}:face);}
export async function findMergePeople(pool,cemeteryId,query){
 const pattern=`%${query.replace(/[\\%_]/gu,'\\$&')}%`;
 return (await pool.query(`SELECT b.id::text,concat_ws(' ',coalesce(b.full_name,concat_ws(' ',b.first_name,b.last_name)),g.gravesite_id) AS label FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid
 WHERE g.cemetery_id=$1 AND g.deleted_at IS NULL AND b.deleted_at IS NULL AND concat_ws(' ',b.full_name,b.first_name,b.last_name,g.gravesite_id) ILIKE $2 ORDER BY lower(b.last_name),lower(b.first_name),b.id LIMIT 50`,[cemeteryId,pattern])).rows;
}
async function captureMerge(client,cemeteryId,sourceId,targetId){
 await client.query('SELECT id FROM gravesites WHERE id IN(SELECT gravesite_uuid FROM burials WHERE id=ANY($1::uuid[])) AND cemetery_id=$2 AND deleted_at IS NULL ORDER BY id FOR SHARE',[[sourceId,targetId],cemeteryId]);
 if(sourceId===targetId)throw new BadRequestError('Choose two different people.');
 const authorized=(await client.query('SELECT b.id FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid WHERE b.id=ANY($1::uuid[]) AND g.cemetery_id=$2 AND b.deleted_at IS NULL AND g.deleted_at IS NULL',[[sourceId,targetId],cemeteryId])).rows;
 if(authorized.length!==2)return undefined;
 // Connected face editors lock a marker before its referenced people. Keep the
 // same order here so merges and those editors do not wait on each other cyclically.
 await client.query(`SELECT t.id FROM headstones t WHERE ${recoveryMarkerScope('t.id')}=$2 AND t.id IN(
  SELECT headstone_uuid FROM headstone_burials WHERE burial_uuid=ANY($1::uuid[])
  UNION SELECT id FROM headstones WHERE faces @> $3::jsonb
  UNION SELECT headstone_uuid FROM monument_inspections WHERE faces @> $3::jsonb)
  ORDER BY t.id FOR UPDATE OF t`,[[sourceId,targetId],cemeteryId,JSON.stringify([{burialIds:[sourceId]}])]);
 const roots=(await client.query(`SELECT b.id::text,b.xmin::text AS version,to_jsonb(b) AS record,g.gravesite_id AS "gravesiteId" FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid WHERE b.id=ANY($1::uuid[]) AND g.cemetery_id=$2 AND g.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY b.id FOR UPDATE OF b`,[[sourceId,targetId],cemeteryId])).rows;
 if(roots.length!==2)return undefined;
 const source=roots.find(r=>r.id===sourceId),target=roots.find(r=>r.id===targetId),blockers=[];
 if(source.record.gravesite_uuid!==target.record.gravesite_uuid)blockers.push('Both records must refer to the same gravesite. Resolve burial identity and location before merging.');
 if((await client.query('SELECT 1 FROM burial_record_merges WHERE source_id=ANY($1::uuid[]) OR target_id=$2 LIMIT 1',[[sourceId,targetId],sourceId])).rowCount)blockers.push('A selected record participates in an earlier merge. Review its merge history with a system administrator.');
 const foreignKeys=(await client.query(`SELECT n.nspname AS schema,c.relname AS table,a.attname AS column FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ANY(k.conkey) WHERE k.contype='f' AND k.confrelid='burials'::regclass`)).rows;
 for(const fk of foreignKeys)if(fk.schema!=='public'||references[fk.table]!==fk.column)blockers.push('The database contains a person relationship requiring an updated merge handler. Ask a system administrator to review it.');
 const children={};let total=0;
 for(const [table,column]of Object.entries(references)){
  const rows=(await client.query(`SELECT xmin::text AS version,to_jsonb(r) AS record FROM ${table} r WHERE ${column}=ANY($1::uuid[]) ORDER BY to_jsonb(r)::text LIMIT 1001 FOR UPDATE`,[[sourceId,targetId]])).rows;
  total+=rows.length;if(rows.length>1000||total>5000)throw new BadRequestError('This merge has too much evidence for interactive review. Ask a system administrator to prepare it.');children[table]=rows;
 }
 const facePattern=JSON.stringify([{burialIds:[sourceId]}]);
 for(const table of ['headstones','monument_inspections']){
  const rows=(await client.query(`SELECT r.id::text,r.xmin::text AS version,to_jsonb(r) AS record FROM ${table} r WHERE faces @> $1::jsonb ORDER BY r.id LIMIT 1001 FOR UPDATE`,[facePattern])).rows;
  if(rows.length>1000)throw new BadRequestError('Too many marker face references for one interactive merge.');children[table]=rows;
 }
 const markerIds=[...new Set([...children.headstone_burials.map(r=>r.record.headstone_uuid),...children.headstones.map(r=>r.record.id),...children.monument_inspections.map(r=>r.record.headstone_uuid)])];
 if(markerIds.length&&(await client.query(`SELECT 1 FROM headstones t WHERE t.id=ANY($1::uuid[]) AND ${recoveryMarkerScope('t.id')} IS DISTINCT FROM $2::uuid LIMIT 1`,[markerIds,cemeteryId])).rowCount)blockers.push('Linked marker evidence belongs to another cemetery or has unresolved ownership.');
 if((await client.query(`SELECT 1 FROM source_person_record_links l JOIN source_person_records s ON s.id=l.source_person_record_id WHERE l.burial_uuid=ANY($1::uuid[]) AND s.cemetery_id IS DISTINCT FROM $2::uuid LIMIT 1`,[[sourceId,targetId],cemeteryId])).rowCount)blockers.push('Person source evidence belongs to another cemetery.');
 if((await client.query(`SELECT 1 FROM north_hills_ocr_source_facts f JOIN north_hills_ocr_entries e ON e.id=f.entry_id WHERE f.promoted_burial_uuid=ANY($1::uuid[]) AND e.cemetery_id IS DISTINCT FROM $2::uuid LIMIT 1`,[[sourceId,targetId],cemeteryId])).rowCount)blockers.push('OCR source evidence belongs to another cemetery.');
 const snapshot={source,target,children};
 if(Buffer.byteLength(JSON.stringify(snapshot))>10*1024*1024)throw new BadRequestError('Too much source evidence for an interactive merge. Ask a system administrator to review it.');
 return {snapshot,blockers,hash:fieldRequestHash(snapshot)};
}
async function transferReferences(client,sourceId,targetId,snapshot){
 // Preserve original pure links on the archived donor. Copy active marker links
 // and decoration facts to the survivor; shared facts are retained once there.
 for(const row of snapshot.children.headstone_burials.filter(r=>r.record.burial_uuid===sourceId&&r.record.deleted_at===null)){
  const target=snapshot.children.headstone_burials.find(r=>r.record.burial_uuid===targetId&&r.record.headstone_uuid===row.record.headstone_uuid);
  if(target?.record.deleted_at)throw new ConflictError('A corresponding survivor marker link is deleted. Review that link before merging.');
  if(!target)await client.query('INSERT INTO headstone_burials SELECT (jsonb_populate_record(NULL::headstone_burials,$1::jsonb)).*',[JSON.stringify({...row.record,burial_uuid:targetId})]);
 }
 for(const row of snapshot.children.burial_military_decorations.filter(r=>r.record.burial_uuid===sourceId))await client.query('INSERT INTO burial_military_decorations SELECT (jsonb_populate_record(NULL::burial_military_decorations,$1::jsonb)).* ON CONFLICT DO NOTHING',[JSON.stringify({...row.record,burial_uuid:targetId})]);
 for(const [table,column]of Object.entries(references))if(!['headstone_burials','burial_military_decorations'].includes(table))await client.query(`UPDATE ${table} SET ${column}=$2 WHERE ${column}=$1`,[sourceId,targetId]);
 for(const table of ['headstones','monument_inspections'])for(const row of snapshot.children[table])await client.query(`UPDATE ${table} SET faces=$2::jsonb WHERE id=$1`,[row.id,JSON.stringify(replaceFaceBurialIds(row.record.faces,sourceId,targetId))]);
}
const detailFields=[['Name','person','firstName'],['Last name','person','lastName'],['Birth date','person','birthDate'],['Death date','person','deathDate'],['Maiden name','person','maidenName'],['Burial date',null,'burialDate'],['Military unit / organization',null,'militaryUnit'],['Notes',null,'notes']];
async function previewResult(client,captured){
 const {source,target,children}=captured.snapshot,sourcePerson=await getBurial(client,source.id),targetPerson=await getBurial(client,target.id);
 const details=detailFields.map(([label,parent,key])=>({label,source:(parent?sourcePerson[parent]?.[key]:sourcePerson[key])??'',target:(parent?targetPerson[parent]?.[key]:targetPerson[key])??''}));
 return {sourceId:source.id,targetId:target.id,sourceName:sourcePerson.person.fullName||[sourcePerson.person.firstName,sourcePerson.person.lastName].join(' '),targetName:targetPerson.person.fullName||[targetPerson.person.firstName,targetPerson.person.lastName].join(' '),gravesiteId:target.gravesiteId,details,referenceCounts:Object.fromEntries(Object.entries(children).map(([table,rows])=>[table,rows.length])),previewHash:captured.hash,blockers:captured.blockers};
}
export async function previewBurialMerge(pool,cemeteryId,sourceId,targetId,actorUser){
 return withAuditContext(pool,{actorUser,reason:'Preview duplicate person merge'},async(client,rollback)=>{
  const captured=await captureMerge(client,cemeteryId,sourceId,targetId);if(!captured)return rollback(undefined);
  if(!captured.blockers.length){await client.query('SAVEPOINT merge_preview');try{await transferReferences(client,sourceId,targetId,captured.snapshot);}catch(error){if(['23505','23514'].includes(error.code)||error instanceof ConflictError)captured.blockers.push(error instanceof ConflictError?error.message:'Source relationships conflict with survivor evidence. Review both records before merging.');else throw error;}finally{await client.query('ROLLBACK TO SAVEPOINT merge_preview');await client.query('RELEASE SAVEPOINT merge_preview');}}
  return previewResult(client,captured);
 });
}
export async function mergeBurials(pool,cemeteryId,input,actorUser){
 const sourceId=validateUuid(input?.sourceId,'Donor person'),targetId=validateUuid(input.targetId,'Surviving person'),reason=requiredText(input.reason,'Merge reason',500);
 if(input.acknowledge!==true||typeof input.previewHash!=='string'||!/^[a-f0-9]{64}$/u.test(input.previewHash))throw new BadRequestError('Review the merge preview and confirm the surviving person first.');
 return withAuditContext(pool,{actorUser,reason},async(client,rollback)=>{
  const captured=await captureMerge(client,cemeteryId,sourceId,targetId);if(!captured)return rollback(undefined);
  if(captured.hash!==input.previewHash)throw new ConflictError('A person or linked evidence changed since preview. Keep your reason, reload the preview and review it again.');
  if(captured.blockers.length)throw new ConflictError(captured.blockers.join(' '));
  try{await transferReferences(client,sourceId,targetId,captured.snapshot);}catch(error){if(['23505','23514'].includes(error.code))throw new ConflictError('Evidence relationships conflict. Review both records before merging.');throw error;}
  await client.query(`INSERT INTO burial_record_merges(source_id,target_id,cemetery_id,preview_hash,source_snapshot,target_snapshot,relationship_snapshot,reason,actor_subject,actor_app_user_id) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,$9,$10)`,[sourceId,targetId,cemeteryId,captured.hash,JSON.stringify(captured.snapshot.source),JSON.stringify(captured.snapshot.target),JSON.stringify(captured.snapshot.children),reason,requiredText(actorUser.subject,'Signed-in account',300),actorUser.id??null]);
  await client.query('UPDATE burials SET deleted_at=now(),deleted_by=$2,delete_reason=$3 WHERE id=$1',[sourceId,actorUser.id??null,`Merged into ${targetId}: ${reason}`]);
  await auditEventIdForMutation(client,{actorUser,action:'soft_delete',targetTable:'burials',targetRecordId:sourceId,previousValues:captured.snapshot.source.record,newValues:{mergedInto:targetId},reason});
  await auditEventIdForMutation(client,{actorUser,action:'create',targetTable:'burial_record_merges',targetRecordId:sourceId,newValues:{targetId,previewHash:captured.hash},reason});return {sourceId,targetId,merged:true};
 });
}
