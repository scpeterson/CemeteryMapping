import {createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {canManageCemeteryMembers} from "./cemeteryMembershipRepository.mjs";
import {BadRequestError,ConflictError} from "./requestValidation.mjs";
import {validateUuid,requiredText} from "./inputValidation.mjs";
export const policyCatalog=[
 ["no_gravesites","Prohibit gravesites"], ["no_interactive_creation","Prohibit Add gravesite"],
 ["flat_markers_only","Flat markers only"], ["single_primary_marker","One primary or spanning flat marker"],
 ["casket_or_two_urns","One casket or two urns, without mixing"],
].map(([key,label])=>({key,label}));
const secret=process.env.POLICY_PREVIEW_SECRET || randomBytes(32);
if(Buffer.byteLength(secret)<32)throw new Error('POLICY_PREVIEW_SECRET must have at least 32 bytes.');
export function validatePolicyChange(body){
 const allowed=['cemeteryId','sectionId','blockId','rule','value','reason','revision','previewToken'];
 if(!body || typeof body!=='object' || Object.keys(body).some(k=>!allowed.includes(k)))throw new BadRequestError('Only policy fields may be changed.');
 const input={};
 for(const key of ['cemeteryId','sectionId','blockId'])input[key]=body[key]===undefined||body[key]===null||body[key]===''?null:validateUuid(body[key],key);
 if((input.sectionId&&!input.cemeteryId)||(input.blockId&&!input.sectionId))throw new BadRequestError('Select the complete location hierarchy.');
 if(!policyCatalog.some(r=>r.key===body.rule))throw new BadRequestError('Choose a supported policy.');
 if(![true,false,null].includes(body.value))throw new BadRequestError('Choose Inherit, Enabled or Disabled.');
 if(typeof body.revision!=='string'||!/^\d{1,18}$/u.test(body.revision))throw new BadRequestError('Reload policies before editing.');
 return {...input,rule:body.rule,value:body.value,revision:body.revision,reason:requiredText(body.reason,'Reason',500)};
}
export const canManagePolicy=(user,input)=>user?.role==='admin'||Boolean(input.cemeteryId&&canManageCemeteryMembers(user,input.cemeteryId));
function signature(input,actor,time){return createHmac('sha256',secret).update(JSON.stringify([input,actor,time])).digest('hex');}
export function previewToken(input,actor,time=Date.now()){return `${time}.${signature(input,actor,time)}`;}
export function verifyPreview(token,input,actor,now=Date.now()){
 if(typeof token!=='string'||!/^\d{13}\.[a-f0-9]{64}$/u.test(token))return false;
 const [time,digest]=token.split('.');const age=now-Number(time);
 return age>=0&&age<=300000&&timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(signature(input,actor,Number(time)),'hex'));
}
export async function policySnapshot(pool,user,before=null){
 const ids=user.role==='admin'?null:(user.cemeteryAccess??[]).filter(a=>canManageCemeteryMembers(user,a.cemeteryId)).map(a=>a.cemeteryId);
 const queries=[
  ["SELECT revision::text FROM location_policy_revision WHERE singleton",[]],
  ['SELECT id::text,name FROM cemeteries WHERE deleted_at IS NULL AND ($1::uuid[] IS NULL OR id=ANY($1)) ORDER BY name',[ids]],
  ['SELECT section_id::text AS id,cemetery_id::text AS "cemeteryId",name FROM sections WHERE deleted_at IS NULL AND ($1::uuid[] IS NULL OR cemetery_id=ANY($1)) ORDER BY name',[ids]],
  ['SELECT id::text,cemetery_id::text AS "cemeteryId",section_uuid::text AS "sectionId",block_id AS name FROM blocks WHERE deleted_at IS NULL AND ($1::uuid[] IS NULL OR cemetery_id=ANY($1)) ORDER BY block_id',[ids]],
  ['SELECT * FROM location_policies WHERE $1::uuid[] IS NULL OR cemetery_id IS NULL OR cemetery_id=ANY($1)',[ids]],
  [`SELECT h.* FROM location_policy_history h WHERE ($1::uuid[] IS NULL OR h.cemetery_id=ANY($1))
   AND ($2::uuid IS NULL OR (h.created_at,h.id)<(SELECT created_at,id FROM location_policy_history
     WHERE id=$2 AND ($1::uuid[] IS NULL OR cemetery_id=ANY($1)))) ORDER BY h.created_at DESC,h.id DESC LIMIT 101`,[ids,before]],
 ];
 const results=await Promise.all(queries.map(([sql,args])=>pool.query(sql,args)));
 return {revision:results[0].rows[0].revision,catalog:policyCatalog,cemeteries:results[1].rows,sections:results[2].rows,blocks:results[3].rows,policies:results[4].rows,history:results[5].rows.slice(0,100),historyCursor:results[5].rows.length>100?results[5].rows[99].id:null};
}
export async function changePolicy(pool,input,user,{preview=false}={}){
 const c=await pool.connect();
 let releaseError;
 try{
  await c.query('BEGIN');await c.query("SET LOCAL lock_timeout='3s'");await c.query("SET LOCAL statement_timeout='15s'");
  const result=await c.query('SELECT change_location_policy($1,$2,$3,$4,$5,$6,$7,$8) AS change',
   [user.id,input.cemeteryId,input.sectionId,input.blockId,input.rule,input.value,input.reason,input.revision]);
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  const impact=await c.query(`WITH changed AS (SELECT id FROM jsonb_to_recordset($1::jsonb) b(id uuid,enabled boolean)
   WHERE enabled IS DISTINCT FROM gravesite_location_policy(id,$2)), markers AS (
    SELECT id FROM headstones WHERE deleted_at IS NULL AND gravesite_uuid IN (SELECT id FROM changed)
    UNION SELECT h.id FROM headstones h JOIN headstone_gravesites l ON l.headstone_uuid=h.id
      WHERE h.deleted_at IS NULL AND l.deleted_at IS NULL AND l.gravesite_uuid IN (SELECT id FROM changed))
   SELECT (SELECT count(*)::int FROM changed) AS graves,(SELECT count(*)::int FROM markers) AS markers,
    (SELECT count(*)::int FROM burials WHERE deleted_at IS NULL AND gravesite_uuid IN (SELECT id FROM changed)) AS burials`,[JSON.stringify(result.rows[0].change.baseline),input.rule]);
  await c.query(preview?'ROLLBACK':'COMMIT');
  return {revision:result.rows[0].change.revision,impact:impact.rows[0],...(preview?{previewToken:previewToken(input,user.id)}:{})};
 }catch(error){try{await c.query('ROLLBACK');}catch(rollbackError){releaseError=rollbackError;}
  if(['40001','40P01','55P03','57014'].includes(error.code))throw new ConflictError('Policies or cemetery records changed or are busy. Reload and preview again.');
  throw error;
 }finally{c.release(releaseError);}
}
