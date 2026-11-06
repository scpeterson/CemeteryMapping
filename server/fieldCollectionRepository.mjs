import { withAuditContext } from "./auditContext.mjs";
import { canEditCemetery } from "./auth.mjs";
import { BadRequestError } from "./requestValidation.mjs";
import { validateUuid } from "./inputValidation.mjs";
import { validateExpectedVersion } from "./recordVersions.mjs";
import { beginFieldOperation, completeFieldOperation, fieldRequestHash, fieldTransactionPool } from "./fieldOperationReceipts.mjs";
import { getHeadstone, listHeadstoneLookupOptions, updateBurial, updateHeadstone, createHeadstoneGravesiteRelationship } from "./cemeteryRepository.mjs";
import { getBurial } from "./cemeteryBurialMutations.mjs";
import { headstoneCemeteryIdSql, headstoneCemeteryJoinsSql } from "./headstoneCemeterySql.mjs";
import { validateBurialPayload, validateHeadstonePayload, validateHeadstoneGravesiteRelationshipPayload } from "./routes/cemeteryRouteValidation.mjs";
import { validateHeadstoneBusinessRules } from "./routes/routeBusinessRules.mjs";

export async function listFieldMarkers(pool,cemeteryId,{query="",limit=51,offset=0}={}){
  const pattern=`%${query.replace(/[\\%_]/gu,"\\$&")}%`;
  const {rows}=await pool.query(`WITH matching_graves AS MATERIALIZED (
    SELECT id FROM gravesites WHERE cemetery_id=$1 AND deleted_at IS NULL AND $2<>'%%'
      AND concat_ws(' ',gravesite_id,display_label,section_id,grave_id,name) ILIKE $2
  ), matching_people AS MATERIALIZED (
    SELECT b.id,b.gravesite_uuid FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid
    WHERE g.cemetery_id=$1 AND g.deleted_at IS NULL AND b.deleted_at IS NULL AND $2<>'%%'
      AND coalesce(b.full_name,concat_ws(' ',b.first_name,b.last_name)) ILIKE $2
  ), matching_markers AS (
    SELECT id FROM headstones WHERE deleted_at IS NULL AND headstone_id ILIKE $2
    UNION SELECT h.id FROM headstones h WHERE h.deleted_at IS NULL AND h.gravesite_uuid IN(SELECT id FROM matching_graves UNION SELECT gravesite_uuid FROM matching_people)
    UNION SELECT hg.headstone_uuid FROM headstone_gravesites hg WHERE hg.deleted_at IS NULL AND hg.gravesite_uuid IN(SELECT id FROM matching_graves UNION SELECT gravesite_uuid FROM matching_people)
    UNION SELECT hb.headstone_uuid FROM headstone_burials hb WHERE hb.deleted_at IS NULL AND hb.burial_uuid IN(SELECT id FROM matching_people)
  ) SELECT headstones.id::text,headstones.headstone_id AS code,headstones.headstone_id AS label
    FROM headstones ${headstoneCemeteryJoinsSql} WHERE headstones.id IN(SELECT id FROM matching_markers)
      AND headstones.deleted_at IS NULL AND ${headstoneCemeteryIdSql}=$1
    ORDER BY headstones.headstone_id,headstones.id LIMIT $3 OFFSET $4`,[cemeteryId,pattern,limit,offset]);
  return rows;
}

export function validateFieldOperation(body) {
  const id=validateUuid(body?.id,"Queued action"),cemeteryId=validateUuid(body?.cemeteryId,"Cemetery"),targetId=validateUuid(body?.targetId,"Record");
  const kind=body?.kind;
  if(!["marker","burial","inspection","link"].includes(kind))throw new BadRequestError("Unsupported field action.");
  let payload;
  if(kind==="burial")payload={...validateBurialPayload(body.payload),expectedVersion:validateExpectedVersion(body.payload?.expectedVersion)};
  else if(kind==="link"){
    payload=validateHeadstoneGravesiteRelationshipPayload(body.payload);
    if(payload.relationshipType==="primary")throw new BadRequestError("Use the main application to change a marker's primary gravesite.");
  }
  else{
    payload=validateHeadstonePayload(body.payload);
    if(kind==="marker"){
      if(payload.inspectionChangesOnly||payload.newInspections?.length||payload.updatedInspections?.length||payload.deletedInspections?.length)throw new BadRequestError("Save an observation separately from marker details.");
      payload.expectedVersion=validateExpectedVersion(body.payload?.expectedVersion);
    }else{
      if(!payload.inspectionChangesOnly||payload.newInspections?.length!==1||payload.updatedInspections?.length||payload.deletedInspections?.length)throw new BadRequestError("Field observations must contain one new inspection.");
    }
  }
  return {id,cemeteryId,targetId,kind,payload};
}

async function targetInCemetery(client,operation){
  const {rows}=operation.kind==="burial"
    ?await client.query(`SELECT b.id FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid
      WHERE b.id=$1 AND b.deleted_at IS NULL AND g.deleted_at IS NULL AND g.cemetery_id=$2`,[operation.targetId,operation.cemeteryId])
    :await client.query(`SELECT headstones.id FROM headstones ${headstoneCemeteryJoinsSql}
      WHERE headstones.id=$1 AND headstones.deleted_at IS NULL AND ${headstoneCemeteryIdSql}=$2`,[operation.targetId,operation.cemeteryId]);
  return rows.length>0;
}

export async function synchronizeFieldOperation(pool,operation,actorUser){
  if(!canEditCemetery(actorUser,operation.cemeteryId))return {forbidden:true};
  return withAuditContext(pool,{actorUser,reason:operation.payload.reason??"Field collection synchronization"},async(client,rollback)=>{
    if(!await targetInCemetery(client,operation))return rollback(undefined);
    const receipt=await beginFieldOperation(client,actorUser,operation.id,fieldRequestHash(operation));
    if(receipt.replayed)return {...receipt.response,replayed:true};
    const borrowed=fieldTransactionPool(client),options={actorUser,reason:operation.payload.reason??"Field collection synchronization",allowedCemeteryIds:[operation.cemeteryId]};
    if(["marker","inspection"].includes(operation.kind))await validateHeadstoneBusinessRules(client,operation.targetId,operation.payload);
    const result=operation.kind==="burial"?await updateBurial(borrowed,operation.targetId,operation.payload,options)
      :operation.kind==="link"?await createHeadstoneGravesiteRelationship(borrowed,operation.targetId,operation.payload,options)
      :await updateHeadstone(borrowed,operation.targetId,operation.payload,options);
    if(!result)return rollback(undefined);
    if(result.forbidden)return rollback({forbidden:true});
    const response={id:result.id??operation.targetId,version:result.version??null,received:true};
    await completeFieldOperation(client,actorUser,operation.id,response);
    return {...response,replayed:false};
  });
}

export async function getFieldSnapshot(pool,cemeteryId,markerId){
  const client=await pool.connect();
  try{
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    if(!await targetInCemetery(client,{kind:"marker",targetId:markerId,cemeteryId})){await client.query("ROLLBACK");return undefined;}
    const cemetery=(await client.query("SELECT name FROM cemeteries WHERE id=$1 AND deleted_at IS NULL",[cemeteryId])).rows[0];
    if(!cemetery){await client.query("ROLLBACK");return undefined;}
    const headstone=await getHeadstone(client,markerId);
    const ids=(await client.query(`WITH marker_graves AS (
      SELECT gravesite_uuid FROM headstones WHERE id=$1 UNION
      SELECT gravesite_uuid FROM headstone_gravesites WHERE headstone_uuid=$1 AND deleted_at IS NULL)
      SELECT b.id FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid
      WHERE b.deleted_at IS NULL AND g.deleted_at IS NULL AND g.cemetery_id=$2
        AND (b.gravesite_uuid IN(SELECT gravesite_uuid FROM marker_graves) OR EXISTS(
          SELECT 1 FROM headstone_burials hb WHERE hb.headstone_uuid=$1 AND hb.burial_uuid=b.id AND hb.deleted_at IS NULL))
      ORDER BY b.id LIMIT 101`,[markerId,cemeteryId])).rows;
    if(ids.length>100)throw new BadRequestError("This marker has too many associated people for one field workspace. Use the main application to review it.");
    const burials=[];for(const {id}of ids)burials.push(await getBurial(client,id));
    const lookups=await listHeadstoneLookupOptions(fieldTransactionPool(client),{includeEntities:false});
    const nearbyGraves=(await client.query(`SELECT id::text,gravesite_id AS code,coalesce(nullif(display_label,''),gravesite_id) AS label
      FROM gravesites WHERE cemetery_id=$2 AND deleted_at IS NULL
      ORDER BY geometry <-> (SELECT geometry FROM headstones WHERE id=$1) NULLS LAST,gravesite_id,id LIMIT 100`,[markerId,cemeteryId])).rows;
    await client.query("COMMIT");
    return {cemeteryId,cemeteryName:cemetery.name,headstone,burials,lookups,nearbyGraves,downloadedAt:new Date().toISOString()};
  }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error;}
  finally{client.release();}
}
