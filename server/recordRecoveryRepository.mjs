import {stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {BadRequestError,ConflictError} from './requestValidation.mjs';
import {requiredText} from './inputValidation.mjs';
import {validateExpectedVersion,assertRecordVersion} from './recordVersions.mjs';
import {withAuditContext} from './auditContext.mjs';
import {auditEventIdForMutation} from './cemeteryAudit.mjs';
import {headstoneCemeteryIdSql,headstoneCemeteryJoinsSql} from './headstoneCemeterySql.mjs';
import {mediaUploadRoot} from './media/mediaMapping.mjs';

export const recoveryMarkerScope=(id)=>`COALESCE((SELECT g.cemetery_id FROM headstones h JOIN gravesites g ON g.id=h.gravesite_uuid WHERE h.id=${id}),
 (SELECT ${headstoneCemeteryIdSql} FROM headstones ${headstoneCemeteryJoinsSql} WHERE headstones.id=${id}))`;
const markerParent={table:'headstones',field:'headstone_uuid'};
const graveParent={table:'gravesites',field:'gravesite_uuid'};
const mediaParent={table:'media_assets',field:'media_asset_id'};
const definitions={
 ownership_events:{scope:'t.cemetery_id',label:"'Ownership event · '||t.event_type",parents:[]},
 owners:{scope:'(SELECT cemetery_id FROM gravesites WHERE id=t.gravesite_uuid)',label:"coalesce(t.owner,t.co_owner,'Owner')",parents:[graveParent]},
 headstone_relationships:{scope:recoveryMarkerScope('t.from_headstone_uuid'),label:"'Marker relationship · '||t.relationship_type",parents:[{table:'headstones',field:'from_headstone_uuid'},{table:'headstones',field:'to_headstone_uuid'}]},
 sections:{pk:'section_id',scope:'t.cemetery_id',label:'t.name',parents:[]},
 lots:{scope:'t.cemetery_id',label:"concat_ws(' ',t.lot_id,t.name)",parents:[]},
 ownership_event_rights:{scope:'coalesce(t.cemetery_id,(SELECT cemetery_id FROM ownership_events WHERE id=t.ownership_event_uuid))',label:"'Ownership right · '||t.target_type",parents:[{table:'ownership_events',field:'ownership_event_uuid'},{...graveParent,optional:true},{table:'lots',field:'lot_uuid',optional:true},{table:'sections',field:'section_uuid',pk:'section_id',optional:true}]},
 monument_photo_contexts:{scope:recoveryMarkerScope('t.headstone_uuid'),label:"'Observation photo link · '||t.phase",parents:[markerParent,mediaParent,{table:'monument_inspections',field:'inspection_id',optional:true},{table:'maintenance_records',field:'maintenance_record_id',optional:true}]},
 source_person_record_links:{scope:'(SELECT cemetery_id FROM source_person_records WHERE id=t.source_person_record_id)',label:"'Person source link · '||t.link_type",parents:[{table:'source_person_records',field:'source_person_record_id'},{table:'burials',field:'burial_uuid',optional:true},{...graveParent,optional:true},{...markerParent,optional:true}]},
 gravesites:{scope:'t.cemetery_id',label:'coalesce(t.display_label,t.gravesite_id)',parents:[{table:'sections',field:'section_uuid',pk:'section_id',optional:true},{table:'lots',field:'lot_uuid',optional:true}]},
 headstones:{scope:recoveryMarkerScope('t.id'),label:'t.headstone_id',parents:[{...graveParent,optional:true}]},
 burials:{scope:'(SELECT cemetery_id FROM gravesites WHERE id=t.gravesite_uuid)',label:"coalesce(t.full_name,concat_ws(' ',t.first_name,t.last_name),t.id::text)",parents:[graveParent]},
 grave_features:{scope:'t.cemetery_id',label:"coalesce(t.symbol_text,t.notes,'Feature')",parents:[{...graveParent,optional:true},{...markerParent,optional:true}]},
 maintenance_records:{scope:'t.cemetery_id',label:"coalesce(t.notes,'Maintenance action')",parents:[{...graveParent,optional:true},{...markerParent,optional:true}]},
 monument_inspections:{scope:recoveryMarkerScope('t.headstone_uuid'),label:"t.source||' · '||t.inspection_year::text",parents:[markerParent]},
 media_assets:{scope:'t.cemetery_id',label:"coalesce(t.original_filename,t.id::text)",parents:[]},
 headstone_media_assets:{scope:recoveryMarkerScope('t.headstone_uuid'),label:"'Marker photo link '||t.id::text",parents:[markerParent,mediaParent]},
 gravesite_media_assets:{scope:'(SELECT cemetery_id FROM gravesites WHERE id=t.gravesite_uuid)',label:"'Gravesite photo link '||t.id::text",parents:[graveParent,mediaParent]},
 headstone_gravesites:{scope:recoveryMarkerScope('t.headstone_uuid'),label:"'Gravesite link '||t.relationship_type",parents:[markerParent,graveParent]},
 source_person_records:{scope:'t.cemetery_id',label:'t.full_name',parents:[]},
};
export const recoveryKinds=Object.keys(definitions);
function definition(kind){if(!Object.hasOwn(definitions,kind))throw new BadRequestError('Choose a supported recovery record type.');return definitions[kind];}
export async function listDeletedRecords(pool,cemeteryId,kind,{query='',limit=51,offset=0}={}){
 const d=definition(kind),pattern=`%${query.replace(/[\\%_]/gu,'\\$&')}%`;
 return (await pool.query(`SELECT t.${d.pk??'id'}::text AS id,left(${d.label},250) AS label,t.deleted_at AS "deletedAt",(to_jsonb(t)->>'delete_reason') AS "deleteReason",t.xmin::text AS version,
 ${kind==='burials'?'(SELECT target_id::text FROM burial_record_merges WHERE source_id=t.id)':'NULL::text'} AS "mergedInto"
 FROM ${kind} t WHERE t.deleted_at IS NOT NULL AND ${d.scope}=$1 AND concat_ws(' ',${d.label},t.${d.pk??'id'}::text,(to_jsonb(t)->>'delete_reason')) ILIKE $2 ORDER BY t.deleted_at DESC,t.${d.pk??'id'} LIMIT $3 OFFSET $4`,[cemeteryId,pattern,limit,offset])).rows;
}
export async function restoreDeletedRecord(pool,cemeteryId,kind,id,input,actorUser,{uploadRoot=mediaUploadRoot()}={}){
 const d=definition(kind),expectedVersion=validateExpectedVersion(input?.expectedVersion),reason=requiredText(input.reason,'Restore reason',500);
 return withAuditContext(pool,{actorUser,reason},async(client,rollback)=>{
  const row=(await client.query(`SELECT t.*,t.xmin::text AS version FROM ${kind} t WHERE t.${d.pk??'id'}=$1 AND ${d.scope}=$2 FOR UPDATE OF t`,[id,cemeteryId])).rows[0];if(!row)return rollback(undefined);
  assertRecordVersion(row.version,expectedVersion);if(!row.deleted_at)throw new ConflictError('This record was already restored. Reload the recovery list.');
  if(kind==='burials'&&(await client.query('SELECT 1 FROM burial_record_merges WHERE source_id=$1',[id])).rowCount)throw new ConflictError('This person was merged. Review the surviving record and merge evidence; restoring the donor would duplicate its transferred evidence.');
  if(!(await client.query('SELECT id FROM cemeteries WHERE id=$1 AND deleted_at IS NULL FOR SHARE',[cemeteryId])).rowCount)throw new ConflictError('Restore the cemetery before its records.');
  for(const parent of d.parents){
   const value=row[parent.field];if(!value&&parent.optional)continue;
   if(!value)throw new ConflictError('This record has a missing parent. Review its provenance before restoration.');
   const found=(await client.query(`SELECT p.${parent.pk??'id'} FROM ${parent.table} p WHERE p.${parent.pk??'id'}=$1 AND p.deleted_at IS NULL AND ${parent.table==='headstones'?recoveryMarkerScope('p.id'):parent.table==='monument_inspections'?recoveryMarkerScope('p.headstone_uuid'):parent.table==='burials'?'(SELECT cemetery_id FROM gravesites WHERE id=p.gravesite_uuid)':'p.cemetery_id'}=$2 FOR SHARE OF p`,[value,cemeteryId])).rowCount;
   if(!found)throw new ConflictError('Restore the parent record first and verify that it belongs to this cemetery.');
  }
  if(kind==='lots'&&row.section_id&&!(await client.query('SELECT section_id FROM sections WHERE cemetery_id=$1 AND name=$2 AND deleted_at IS NULL FOR SHARE',[cemeteryId,row.section_id])).rowCount)throw new ConflictError('Restore the parent section before this lot or passageway.');
  if(kind==='media_assets'&&String(row.file_url??'').startsWith('/media/')){
   const root=resolve(uploadRoot),path=resolve(root,row.storage_key??'');
   if(!path.startsWith(root+sep))throw new ConflictError('The original photo storage key needs administrative review.');
   const exists=await stat(path).then(s=>s.isFile()).catch(()=>false);if(!exists)throw new ConflictError('The original photo file is missing. Restore it from backup before restoring this record.');
  }
  try{await client.query(`UPDATE ${kind} SET deleted_at=NULL,updated_at=clock_timestamp()${['monument_inspections','monument_photo_contexts'].includes(kind)?'':',deleted_by=NULL,delete_reason=NULL'} WHERE ${d.pk??'id'}=$1`,[id]);}
  catch(error){if(['23505','23514','P0001'].includes(error.code))throw new ConflictError('Restoration conflicts with an active record or relationship. Review the current records first.');throw error;}
  await auditEventIdForMutation(client,{actorUser,action:'restore',targetTable:kind,targetRecordId:id,previousValues:row,newValues:{id,restored:true},reason});return {id,restored:true};
 });
}
