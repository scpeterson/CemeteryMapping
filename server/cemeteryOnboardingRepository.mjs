import {createHash} from 'node:crypto';
import {requiredText,optionalText} from './inputValidation.mjs';
import {validateGraveSpaceId,BadRequestError,ConflictError} from './requestValidation.mjs';
import {validateExpectedVersion,assertRecordVersion} from './recordVersions.mjs';
import {withAuditContext} from './auditContext.mjs';
import {auditEventIdForMutation} from './cemeteryAudit.mjs';
import {validateBurialPayload} from './routes/cemeteryRouteValidation.mjs';
import {updateBurial} from './cemeteryBurialMutations.mjs';
import {fieldTransactionPool} from './fieldOperationReceipts.mjs';

// RFC4180-style quoted cells, including embedded newlines and escaped quotes.
export function parseImportCsv(text){
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
  if(c==='"'){if(cell||closed)throw new BadRequestError('Unexpected CSV quote.');quoted=true;}
  else if(c===','||c==='\n'||c==='\r'){row.push(cell);cell='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}}
  else {if(closed)throw new BadRequestError('Unexpected text after CSV quote.');cell+=c;}
  if(rows.length>501)throw new BadRequestError('Import at most 500 records per batch.');
 }
 if(quoted)throw new BadRequestError('Unclosed CSV quote.');
 row.push(cell);if(row.some(v=>v!==''))rows.push(row);
 const headers=rows.shift()?.map(v=>v.replace(/^\uFEFF/u,'').trim())??[];
 const allowed=['gravesiteId','firstName','lastName','birthDate','deathDate','burialDate','notes'];
 if(!headers.includes('gravesiteId')||!headers.includes('lastName')||headers.some(h=>!allowed.includes(h))||new Set(headers).size!==headers.length)throw new BadRequestError(`CSV columns: ${allowed.join(', ')}. gravesiteId and lastName are required.`);
 return rows.map((values,i)=>{if(values.length!==headers.length)throw new BadRequestError(`CSV record ${i+1} has the wrong number of columns.`);return Object.fromEntries(headers.map((h,j)=>[h,values[j]]));});
}
export function parseImportSource(kind,text){
 if(typeof text!=='string'||Buffer.byteLength(text)>2*1024*1024)throw new BadRequestError('Source must be text up to 2 MB.');
 let records;
 if(kind==='burials')records=parseImportCsv(text);
 else if(kind==='gravesites'){
  let source;try{source=JSON.parse(text);}catch{throw new BadRequestError('Choose valid GeoJSON.');}
  if(source?.type!=='FeatureCollection'||!Array.isArray(source.features))throw new BadRequestError('Choose a GeoJSON FeatureCollection.');
  records=source.features.map(f=>({properties:f?.properties??{},geometry:f?.geometry}));
 }else throw new BadRequestError('Choose gravesites or burials.');
 if(!records.length||records.length>500)throw new BadRequestError('Import between 1 and 500 records per batch.');
 return records;
}
export async function validateImportGeometry(client,geometry,cemeteryId){
 if(!geometry||!['Polygon','MultiPolygon'].includes(geometry.type)||!Array.isArray(geometry.coordinates))throw new BadRequestError('Geometry must be a Polygon or MultiPolygon in longitude/latitude (WGS84).');
 const points=geometry.coordinates.flat(geometry.type==='Polygon'?1:2);
 if(!points.length||points.length>20000||points.some(p=>!Array.isArray(p)||p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1])||p[0]<-180||p[0]>180||p[1]<-90||p[1]>90))throw new BadRequestError('Geometry contains invalid WGS84 coordinates or too many vertices.');
 let rows;
 await client.query("SAVEPOINT import_geometry");
 try{({rows}=await client.query(`WITH shape AS(SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) AS g)
 SELECT ST_IsValid(g) AND NOT ST_IsEmpty(g) AND ST_Area(g)>0 AS valid,
 CASE WHEN $2::uuid IS NULL THEN true WHEN ST_IsValid(g) THEN ST_CoveredBy(g,(SELECT geometry FROM cemeteries WHERE id=$2 AND deleted_at IS NULL)) ELSE false END AS inside FROM shape`,[JSON.stringify(geometry),cemeteryId??null]));await client.query("RELEASE SAVEPOINT import_geometry");}
 catch(error){await client.query("ROLLBACK TO SAVEPOINT import_geometry");await client.query("RELEASE SAVEPOINT import_geometry");if(['22023','XX000','22P02'].includes(error.code))throw new BadRequestError('Invalid GeoJSON geometry. Correct the original source before importing.');throw error;}
 if(!rows[0]?.valid)throw new BadRequestError('Geometry is empty, invalid or has no area. Correct the source; no automatic repair is applied.');
 if(!rows[0].inside)throw new BadRequestError('Geometry extends outside the selected cemetery boundary.');
}
export async function reviewImport(client,cemeteryId,kind,records){
 const reviewed=[],seen=new Set();
 for(const [index,raw] of records.entries()){
  const item={row:index+1,errors:[],warnings:[],record:null};
  try{
   const p=kind==='gravesites'?raw.properties:raw;
   const gravesiteId=validateGraveSpaceId(p.gravesiteId);
   if(kind==='gravesites'){
    const graveId=requiredText(p.graveId,'Grave number',5),section=optionalText(p.section,'Section',5),name=optionalText(p.name,'Name',255);
    const key=gravesiteId.toLowerCase();if(seen.has(key))item.errors.push('Duplicate gravesite ID in source.');seen.add(key);
    if((await client.query('SELECT 1 FROM gravesites WHERE cemetery_id=$1 AND lower(gravesite_id)=lower($2) LIMIT 1',[cemeteryId,gravesiteId])).rowCount)item.errors.push('Gravesite ID already exists, including deleted records.');
    let sectionUuid=null;
    if(section){const found=(await client.query('SELECT section_id FROM sections WHERE cemetery_id=$1 AND lower(name)=lower($2) AND deleted_at IS NULL LIMIT 2',[cemeteryId,section])).rows;if(found.length!==1)item.errors.push('Section must match exactly one existing section.');else sectionUuid=found[0].section_id;}
    await validateImportGeometry(client,raw.geometry,cemeteryId);
    const overlaps=(await client.query(`SELECT gravesite_id FROM gravesites WHERE cemetery_id=$1 AND deleted_at IS NULL AND ST_Intersects(geometry,ST_GeomFromGeoJSON($2)) AND ST_Area(ST_Intersection(geometry,ST_GeomFromGeoJSON($2)))>0 ORDER BY gravesite_id LIMIT 5`,[cemeteryId,JSON.stringify(raw.geometry)])).rows;
    if(overlaps.length)item.errors.push(`Geometry overlaps existing gravesites: ${overlaps.map(r=>r.gravesite_id).join(', ')}.`);
    item.record={gravesiteId,graveId,section,sectionUuid,name,geometry:raw.geometry};
   }else{
    const grave=(await client.query('SELECT id FROM gravesites WHERE cemetery_id=$1 AND gravesite_id=$2 AND deleted_at IS NULL',[cemeteryId,gravesiteId])).rows[0];
    if(!grave)item.errors.push('No active gravesite matches this cemetery and ID.');
    const burial=validateBurialPayload({...raw,givenNameStatus:raw.firstName?'recorded':'unknown',reason:'Approved onboarding import'});
    if(!burial.lastName&&!burial.firstName)item.errors.push('A recorded person name is required.');
    const key=JSON.stringify([gravesiteId,burial.firstName.toLowerCase(),burial.lastName.toLowerCase(),burial.birthDate,burial.deathDate]);
    if(seen.has(key))item.errors.push('Duplicate person in source.');seen.add(key);
    if(grave&&(await client.query(`SELECT 1 FROM burials WHERE gravesite_uuid=$1 AND lower(coalesce(first_name,''))=lower($2) AND lower(coalesce(last_name,''))=lower($3) LIMIT 1`,[grave.id,burial.firstName,burial.lastName])).rowCount)item.errors.push('A person with the same name already exists on this gravesite, including deleted records. Review duplicates before import.');
    item.record={gravesiteId,graveUuid:grave?.id,burial};
   }
  }catch(error){if(error instanceof BadRequestError)item.errors.push(error.message);else throw error;}
  reviewed.push(item);
 }
 // Check overlap within the source, independently of existing cemetery records.
 if(kind==='gravesites'){
  const shapes=reviewed.filter(r=>r.record).map(r=>({row:r.row,geometry:r.record.geometry}));
  const overlaps=(await client.query(`WITH shapes AS MATERIALIZED(SELECT x.row,ST_GeomFromGeoJSON(x.geometry) AS g FROM jsonb_to_recordset($1::jsonb) AS x(row int,geometry jsonb))
   SELECT a.row,min(b.row) AS earlier FROM shapes a JOIN shapes b ON a.row>b.row AND a.g && b.g AND ST_Area(ST_Intersection(a.g,b.g))>0 GROUP BY a.row`,[JSON.stringify(shapes)])).rows;
  for(const overlap of overlaps)reviewed[overlap.row-1].errors.push(`Geometry overlaps source record ${overlap.earlier}.`);
 }
 return {rows:reviewed,errorCount:reviewed.filter(r=>r.errors.length).length,recordCount:reviewed.length};
}
const batchProjection='id::text,cemetery_id::text AS "cemeteryId",kind,source_name AS "sourceName",source_sha256 AS "sourceSha256",status,review,created_records AS "createdRecords",created_at AS "createdAt",reviewed_at AS "reviewedAt",xmin::text AS version';
export async function listImportBatches(pool,cemeteryId,{limit=51,offset=0}={}){return (await pool.query(`SELECT id::text,cemetery_id::text AS "cemeteryId",kind,source_name AS "sourceName",source_sha256 AS "sourceSha256",status,xmin::text AS version,created_at AS "createdAt",jsonb_build_object('recordCount',review->'recordCount','errorCount',review->'errorCount','rows','[]'::jsonb) AS review FROM cemetery_import_batches WHERE cemetery_id=$1 ORDER BY created_at DESC,id LIMIT $2 OFFSET $3`,[cemeteryId,limit,offset])).rows;}
export async function getImportBatch(pool,cemeteryId,id){return (await pool.query(`SELECT ${batchProjection} FROM cemetery_import_batches WHERE cemetery_id=$1 AND id=$2`,[cemeteryId,id])).rows[0];}
export async function stageImport(pool,cemeteryId,input,actorUser){
 const sourceName=requiredText(input.sourceName,'Source filename',250),records=parseImportSource(input.kind,input.sourceText);
 return withAuditContext(pool,{actorUser,reason:'Stage cemetery import'},async client=>{
  if(!(await client.query('SELECT id FROM cemeteries WHERE id=$1 AND deleted_at IS NULL FOR SHARE',[cemeteryId])).rowCount)throw new BadRequestError('Choose an active cemetery.');
  const review=await reviewImport(client,cemeteryId,input.kind,records),hash=createHash('sha256').update(input.sourceText).digest('hex');
  const row=(await client.query(`INSERT INTO cemetery_import_batches(cemetery_id,kind,source_name,source_sha256,source_text,records,review,created_by_subject) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8) RETURNING ${batchProjection}`,[cemeteryId,input.kind,sourceName,hash,input.sourceText,JSON.stringify(records),JSON.stringify(review),requiredText(actorUser.subject,'Signed-in account',300)])).rows[0];
  await auditEventIdForMutation(client,{actorUser,action:'create',targetTable:'cemetery_import_batches',targetRecordId:row.id,newValues:{kind:row.kind,sourceSha256:hash,recordCount:records.length},reason:'Stage cemetery import'});return row;
 });
}
export async function decideImport(pool,cemeteryId,id,input,actorUser){
 const expectedVersion=validateExpectedVersion(input.expectedVersion),reason=requiredText(input.reason,'Review reason',500);
 if(!['approve','reject'].includes(input.decision))throw new BadRequestError('Choose approve or reject.');
 return withAuditContext(pool,{actorUser,reason},async(client,rollback)=>{
  // The cemetery lock serializes approvals and new cemetery setup decisions.
  if(!(await client.query('SELECT id FROM cemeteries WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[cemeteryId])).rowCount)return rollback(undefined);
  const row=(await client.query(`SELECT *,xmin::text AS version FROM cemetery_import_batches WHERE id=$1 AND cemetery_id=$2 FOR UPDATE`,[id,cemeteryId])).rows[0];if(!row)return rollback(undefined);
  assertRecordVersion(row.version,expectedVersion);if(row.status!=='staged')throw new ConflictError('This batch was already reviewed. Reload its status.');
  const review=await reviewImport(client,cemeteryId,row.kind,row.records);
  if(input.decision==='approve'&&review.errorCount)throw new ConflictError('Source validation changed or contains errors. Reject this batch and stage a corrected source.');
  const created=[];
  if(input.decision==='approve')for(const item of review.rows){const r=item.record;let record;
   if(row.kind==='gravesites')record=(await client.query(`INSERT INTO gravesites(cemetery_id,gravesite_id,grave_id,section_id,section_uuid,name,status_type_id,geometry,geometry_type,geometry_source,geometry_confidence,geometry_notes)
    VALUES($1,$2,$3,NULLIF($4,''),$5,NULLIF($6,''),(SELECT id FROM gravesite_status_types WHERE code='needs_review'),ST_Multi(ST_GeomFromGeoJSON($7)),'operational','import','draft',$8) RETURNING id::text`,[cemeteryId,r.gravesiteId,r.graveId,r.section,r.sectionUuid,r.name,JSON.stringify(r.geometry),`Approved source ${row.source_name}; batch ${id}. Review geometry against survey evidence.`])).rows[0];
   else{
    record=(await client.query(`INSERT INTO burials(gravesite_uuid,interment_type_id,burial_record_status_type_id) VALUES($1,(SELECT id FROM burial_interment_types WHERE code='unknown'),(SELECT id FROM burial_record_status_types WHERE code='interred')) RETURNING id::text`,[r.graveUuid])).rows[0];
    await updateBurial(fieldTransactionPool(client),record.id,r.burial,{actorUser,reason,allowedCemeteryIds:[cemeteryId]});
   }
   created.push({id:record.id,gravesiteId:r.gravesiteId});
   await auditEventIdForMutation(client,{actorUser,action:'create',targetTable:row.kind,targetRecordId:record.id,newValues:{importBatchId:id,sourceSha256:row.source_sha256},reason});
  }
  const result=(await client.query(`UPDATE cemetery_import_batches SET status=$3,review=$4::jsonb,reviewed_by_subject=$5,review_reason=$6,reviewed_at=now(),created_records=$7::jsonb WHERE id=$1 AND cemetery_id=$2 RETURNING ${batchProjection}`,[id,cemeteryId,input.decision==='approve'?'approved':'rejected',JSON.stringify(review),actorUser.subject,reason,JSON.stringify(created)])).rows[0];
  await auditEventIdForMutation(client,{actorUser,action:'update',targetTable:'cemetery_import_batches',targetRecordId:id,previousValues:{status:row.status},newValues:{status:result.status,createdRecords:created},reason});return result;
 });
}
export async function createOnboardingCemetery(pool,input,actorUser){
 if(actorUser.role!=='admin')throw new BadRequestError('A system administrator creates new cemeteries.');
 const name=requiredText(input.name,'Cemetery name',255),municipality=optionalText(input.municipality,'Municipality',150),reason=requiredText(input.reason,'Setup reason',500);
 return withAuditContext(pool,{actorUser,reason},async client=>{
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('cemetery-name:'||lower($1),0))",[name]);
  if((await client.query('SELECT 1 FROM cemeteries WHERE lower(name)=lower($1) LIMIT 1',[name])).rowCount)throw new ConflictError('A cemetery with this name already exists, including deleted records.');
  await validateImportGeometry(client,input.geometry);
  const row=(await client.query('INSERT INTO cemeteries(name,municipality,geometry,notes) VALUES($1,$2,ST_Multi(ST_GeomFromGeoJSON($3)),$4) RETURNING id::text,name',[name,municipality,JSON.stringify(input.geometry),reason])).rows[0];
  await auditEventIdForMutation(client,{actorUser,action:'create',targetTable:'cemeteries',targetRecordId:row.id,newValues:row,reason});return row;
 });
}
