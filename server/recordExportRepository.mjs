import {BadRequestError} from './requestValidation.mjs';
import {canViewOwnershipForCemetery,canEditCemetery} from './auth.mjs';
import {headstoneCemeteryIdSql,headstoneCemeteryJoinsSql} from './headstoneCemeterySql.mjs';
import {derivedGravesiteStatusSql} from './gravesiteStatusSql.mjs';

export function canExportCemetery(user,id){return user?.role==='admin'||user?.cemeteryAccess?.some(entry=>entry.cemeteryId===id)===true;}
export const exportDatasets=['gravesites','people','markers','maintenance','ownership'];
export function validateExportOptions({dataset,format,q='',limit='5000'}={}){
 if(!exportDatasets.includes(dataset))throw new BadRequestError('Choose gravesites, people, markers, maintenance or ownership.');
 if(!['csv','geojson'].includes(format)||(format==='geojson'&&!['gravesites','markers'].includes(dataset)))throw new BadRequestError('GeoJSON is available for gravesites and markers; choose CSV for other records.');
 if(typeof q!=='string'||q.length>120)throw new BadRequestError('Export search must be at most 120 characters.');
 if(typeof limit!=='string'||!/^\d+$/u.test(limit)||Number(limit)<1||Number(limit)>5000)throw new BadRequestError('Export limit must be between 1 and 5000.');
 return {dataset,format,q:q.trim(),limit:Number(limit)};
}
export function csvCell(value){
 if(value===undefined||value===null)return '""';
 let text=String(value);if(typeof value!=='number'&&/^[\s\uFEFF]*[=+\-@]|^[\t\r\n]/u.test(text))text="'"+text;
 return `"${text.replaceAll('"','""')}"`;
}
export function recordsCsv(rows,columns){return '\uFEFF'+[columns.map(csvCell).join(','),...rows.map(row=>columns.map(column=>csvCell(row[column])).join(','))].join('\r\n')+'\r\n';}
const fields={
 gravesites:['id','gravesite_id','display_label','section','lot','grave_number','name','status','geometry_type','geometry_source','geometry_confidence'],
 people:['id','gravesite_id','first_name','last_name','maiden_name','birth_date','death_date','burial_date','record_status','interment_type','veteran','military_branch','military_rank','military_unit'],
 markers:['id','marker_id','marker_type','marker_scope','material','condition','inscription'],
 maintenance:['id','gravesite_id','marker_id','action','priority','status','observed_at','completed_at','performed_by','assigned_to','due_date','remind_on','notes'],
 ownership:['event_id','event_type','effective_date','document_reference','party_name','ownership_role','contact_name','full_address','municipality','state','zip','phone','email'],
};
export async function exportRecords(pool,cemeteryId,options,user){
 if(!canExportCemetery(user,cemeteryId))return {forbidden:true};
 if(options.dataset==='ownership'&&!canViewOwnershipForCemetery(user,cemeteryId))return {forbidden:true};
 if(options.dataset==='maintenance'&&!canEditCemetery(user,cemeteryId))return {forbidden:true};
 const pattern=`%${options.q.replace(/[\\%_]/gu,'\\$&')}%`;
 let sql;
 if(options.dataset==='gravesites')sql=`SELECT gravesites.id::text,gravesites.gravesite_id,gravesites.display_label,gravesites.section_id AS section,coalesce(l.lot_id,gravesites.lot_id) AS lot,gravesites.grave_id AS grave_number,gravesites.name,${derivedGravesiteStatusSql()} AS status,gravesites.geometry_type,gravesites.geometry_source,gravesites.geometry_confidence${options.format==='geojson' ? ",ST_AsGeoJSON(gravesites.geometry)::json AS geometry" : ""}
 FROM gravesites JOIN cemeteries c ON c.id=gravesites.cemetery_id AND c.deleted_at IS NULL LEFT JOIN gravesite_status_types status_type ON status_type.id=gravesites.status_type_id LEFT JOIN lots l ON l.id=gravesites.lot_uuid AND l.deleted_at IS NULL
 WHERE gravesites.cemetery_id=$1 AND gravesites.deleted_at IS NULL AND concat_ws(' ',gravesites.gravesite_id,gravesites.display_label,gravesites.name,gravesites.section_id) ILIKE $2 ORDER BY gravesites.gravesite_id,gravesites.id LIMIT $3`;
 else if(options.dataset==='people')sql=`SELECT b.id::text,g.gravesite_id,b.first_name,b.last_name,b.maiden_name,coalesce(nullif(b.birth_date_text,''),b.birth_date::text,'') AS birth_date,coalesce(nullif(b.death_date_text,''),b.death_date::text,'') AS death_date,b.burial_date::text,s.label AS record_status,it.label AS interment_type,b.veteran,mb.label AS military_branch,mr.label AS military_rank,b.military_unit
 FROM burials b JOIN gravesites g ON g.id=b.gravesite_uuid AND g.deleted_at IS NULL JOIN cemeteries c ON c.id=g.cemetery_id AND c.deleted_at IS NULL
 LEFT JOIN burial_record_status_types s ON s.id=b.burial_record_status_type_id LEFT JOIN burial_interment_types it ON it.id=b.interment_type_id LEFT JOIN military_branch_types mb ON mb.id=b.military_branch_type_id LEFT JOIN military_rank_types mr ON mr.id=b.military_rank_type_id
 WHERE g.cemetery_id=$1 AND b.deleted_at IS NULL AND concat_ws(' ',b.full_name,b.first_name,b.last_name,g.gravesite_id) ILIKE $2 ORDER BY g.gravesite_id,b.last_name,b.first_name,b.id LIMIT $3`;
 else if(options.dataset==='markers')sql=`SELECT headstones.id::text,headstones.headstone_id AS marker_id,mt.label AS marker_type,ms.label AS marker_scope,hm.label AS material,hc.label AS condition,headstones.inscription${options.format==='geojson' ? ",ST_AsGeoJSON(headstones.geometry)::json AS geometry" : ""}
 FROM headstones ${headstoneCemeteryJoinsSql} LEFT JOIN marker_types mt ON mt.id=headstones.marker_type_id LEFT JOIN marker_scope_types ms ON ms.id=headstones.marker_scope_type_id LEFT JOIN marker_material_types hm ON hm.id=headstones.material_type_id LEFT JOIN headstone_condition_types hc ON hc.id=headstones.condition_type_id
 WHERE headstones.deleted_at IS NULL AND ${headstoneCemeteryIdSql}=$1 AND concat_ws(' ',headstones.headstone_id,headstones.inscription) ILIKE $2 ORDER BY headstones.headstone_id,headstones.id LIMIT $3`;
 else if(options.dataset==='maintenance')sql=`SELECT m.id::text,g.gravesite_id,h.headstone_id AS marker_id,a.label AS action,p.label AS priority,m.status,m.observed_at::text,m.completed_at::text,m.performed_by,coalesce(nullif(assigned.display_name,''),assigned.email,'') AS assigned_to,m.due_date::text,m.remind_on::text,m.notes FROM maintenance_records m JOIN cemeteries c ON c.id=m.cemetery_id AND c.deleted_at IS NULL LEFT JOIN gravesites g ON g.id=m.gravesite_uuid LEFT JOIN headstones h ON h.id=m.headstone_uuid LEFT JOIN maintenance_action_types a ON a.id=m.action_type_id LEFT JOIN maintenance_priority_types p ON p.id=m.priority_type_id LEFT JOIN app_users assigned ON assigned.id=m.assigned_to_app_user_id
 WHERE m.cemetery_id=$1 AND m.deleted_at IS NULL AND (m.gravesite_uuid IS NULL OR(g.deleted_at IS NULL AND g.cemetery_id=$1)) AND(m.headstone_uuid IS NULL OR(h.deleted_at IS NULL AND (SELECT ${headstoneCemeteryIdSql} FROM headstones ${headstoneCemeteryJoinsSql} WHERE headstones.id=h.id)=$1)) AND concat_ws(' ',g.gravesite_id,h.headstone_id,a.label,m.status,m.notes) ILIKE $2 ORDER BY m.observed_at DESC NULLS LAST,m.id LIMIT $3`;
 else sql=`SELECT e.id::text AS event_id,e.event_type,e.effective_date::text,e.document_reference,p.display_name AS party_name,ep.ownership_role,p.contact_name,p.full_address,p.municipality,p.state,p.zip,p.phone,p.email FROM ownership_events e JOIN cemeteries c ON c.id=e.cemetery_id AND c.deleted_at IS NULL JOIN ownership_event_parties ep ON ep.ownership_event_uuid=e.id JOIN ownership_parties p ON p.id=ep.ownership_party_uuid AND p.deleted_at IS NULL
 WHERE e.cemetery_id=$1 AND e.deleted_at IS NULL AND concat_ws(' ',p.display_name,e.document_reference) ILIKE $2 ORDER BY e.effective_date NULLS LAST,e.id,p.id LIMIT $3`;
 const client=await pool.connect();let rows;
 try{
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  // Size/count before transferring rows: avoid large inscriptions or source
  // notes exhausting API memory, and never quietly truncate a matching dataset.
  const size=(await client.query(`WITH limited_rows AS MATERIALIZED(${sql}) SELECT count(*)::int AS count,coalesce(sum(octet_length(to_jsonb(r)::text)),0)::bigint AS bytes FROM limited_rows r`,[cemeteryId,pattern,options.limit+1])).rows[0];
  if(size.count>options.limit)throw new BadRequestError(`More than ${options.limit} records match. Narrow the search or raise the limit (maximum 5000); no partial export was downloaded.`);
  if(Number(size.bytes)>10*1024*1024)throw new BadRequestError('This export exceeds 10 MB. Narrow the search; no partial export was downloaded.');
  rows=(await client.query(sql,[cemeteryId,pattern,options.limit+1])).rows;
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
 const columns=fields[options.dataset];
 const content=options.format==='csv'?recordsCsv(rows,columns):JSON.stringify({type:'FeatureCollection',name:options.dataset,generatedAt:new Date().toISOString(),cemeteryId,features:rows.map(row=>({type:'Feature',id:row.id,geometry:row.geometry??null,properties:Object.fromEntries(columns.map(column=>[column,row[column]??null]))}))});
 if(Buffer.byteLength(content)>10*1024*1024)throw new BadRequestError('This export exceeds 10 MB. Narrow the search; no partial export was downloaded.');
 return {content,count:rows.length};
}
