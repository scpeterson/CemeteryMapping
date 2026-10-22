import { withAuditContext } from './auditContext.mjs';
import { selectHeadstoneMutationState } from './cemeteryMutationTargets.mjs';
import { assertInspectionEditor } from './monumentInspections.mjs';
import { BadRequestError } from './requestValidation.mjs';
import { validateUuid, optionalText } from './inputValidation.mjs';

export function validatePhotoContext(value) {
 const inspectionId=value?.inspectionId ? validateUuid(value.inspectionId,'Inspection') : null;
 const maintenanceRecordId=value?.maintenanceRecordId ? validateUuid(value.maintenanceRecordId,'Maintenance action') : null;
 if(Boolean(inspectionId)===Boolean(maintenanceRecordId)) throw new BadRequestError('Choose one inspection or maintenance action.');
 const phase=optionalText(value?.phase,'Photo phase',20)||'unspecified';
 if(!['unspecified','before','during','after'].includes(phase)) throw new BadRequestError('Photo phase is invalid.');
 return {inspectionId,maintenanceRecordId,phase,faceId:value?.faceId ? validateUuid(value.faceId,"Photo face").toLowerCase() : null};
}

export async function validatePhotoContextTarget(client,markerId,context,actorUser) {
 if(!context.inspectionId&&!context.maintenanceRecordId) return;
 if(context.inspectionId) assertInspectionEditor(actorUser);
 const result=context.inspectionId
  ? await client.query('SELECT id,faces FROM monument_inspections WHERE id=$1 AND headstone_uuid=$2 FOR UPDATE',[context.inspectionId,markerId])
  : await client.query('SELECT id,(SELECT faces FROM headstones WHERE id=$2) AS faces FROM maintenance_records WHERE id=$1 AND headstone_uuid=$2 AND deleted_at IS NULL FOR UPDATE',[context.maintenanceRecordId,markerId]);
 if(!result.rows.length) throw new BadRequestError('The inspection or maintenance action does not belong to this monument.');
 if(context.faceId && !(result.rows[0].faces??[]).some(face=>face.id===context.faceId)) throw new BadRequestError('The face does not belong to this inspection or monument.');
}

export async function upsertPhotoContext(client,markerId,mediaId,context) {
 const existing=await client.query(`SELECT id FROM monument_photo_contexts WHERE headstone_uuid=$1 AND media_asset_id=$2
 AND inspection_id IS NOT DISTINCT FROM $3::uuid AND maintenance_record_id IS NOT DISTINCT FROM $4::uuid AND deleted_at IS NULL FOR UPDATE`,[markerId,mediaId,context.inspectionId,context.maintenanceRecordId]);
 if(existing.rows.length) await client.query('UPDATE monument_photo_contexts SET phase=$2,face_id=$3,updated_at=clock_timestamp() WHERE id=$1',[existing.rows[0].id,context.phase||'unspecified',context.faceId||null]);
 else await client.query('INSERT INTO monument_photo_contexts(headstone_uuid,media_asset_id,inspection_id,maintenance_record_id,phase,face_id) VALUES($1,$2,$3,$4,$5,$6)',[markerId,mediaId,context.inspectionId,context.maintenanceRecordId,context.phase||'unspecified',context.faceId||null]);
}

export async function listPhotoContexts(pool,markerId) {
 return (await pool.query(`SELECT c.id,c.media_asset_id AS "mediaAssetId",c.inspection_id AS "inspectionId",c.maintenance_record_id AS "maintenanceRecordId",c.phase,c.face_id AS "faceId"
 FROM monument_photo_contexts c JOIN headstones h ON h.id=c.headstone_uuid
 JOIN media_assets m ON m.id=c.media_asset_id
 JOIN headstone_media_assets l ON l.headstone_uuid=c.headstone_uuid AND l.media_asset_id=c.media_asset_id
 WHERE c.headstone_uuid=$1 AND c.deleted_at IS NULL AND h.deleted_at IS NULL AND m.deleted_at IS NULL AND m.status='linked'
 AND l.deleted_at IS NULL AND l.status='linked'
 AND (c.maintenance_record_id IS NULL OR EXISTS(SELECT 1 FROM maintenance_records r WHERE r.id=c.maintenance_record_id AND r.deleted_at IS NULL))
 ORDER BY c.created_at,c.id`,[markerId])).rows;
}

export async function savePhotoContext(pool,markerId,mediaId,context,{actorUser,allowedCemeteryIds,remove=false}={}) {
 return withAuditContext(pool,{actorUser,reason:remove?'Unlinked photo from observation':'Linked photo to observation'},async(client,rollback)=>{
  const marker=await selectHeadstoneMutationState(client,markerId);
  if(!marker||Array.isArray(allowedCemeteryIds)&&!allowedCemeteryIds.includes(marker.cemetery_id)) return rollback(undefined);
  await validatePhotoContextTarget(client,markerId,context,actorUser);
  const photo=await client.query(`SELECT l.id FROM headstone_media_assets l JOIN media_assets m ON m.id=l.media_asset_id
   WHERE l.headstone_uuid=$1 AND l.media_asset_id=$2 AND l.deleted_at IS NULL AND l.status='linked'
   AND m.deleted_at IS NULL AND m.status='linked' AND m.asset_type='photo' FOR UPDATE OF l`,[markerId,mediaId]);
  if(!photo.rows.length) throw new BadRequestError('Choose an active photo from this monument.');
  if(remove) await client.query(`UPDATE monument_photo_contexts SET deleted_at=clock_timestamp(),updated_at=clock_timestamp() WHERE headstone_uuid=$1 AND media_asset_id=$2
   AND inspection_id IS NOT DISTINCT FROM $3::uuid AND maintenance_record_id IS NOT DISTINCT FROM $4::uuid AND deleted_at IS NULL`,[markerId,mediaId,context.inspectionId,context.maintenanceRecordId]);
  else await upsertPhotoContext(client,markerId,mediaId,context);
  return {saved:true};
 });
}
