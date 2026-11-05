import {BadRequestError} from './requestValidation.mjs';
import {requiredText,optionalText,validateUuid} from './inputValidation.mjs';
import {optionalDate} from './routes/routeValidationHelpers.mjs';
import {assignedEditableCemeteryIds,canEditCemetery} from './auth.mjs';
import {validateExpectedVersion,assertRecordVersion} from './recordVersions.mjs';
import {withAuditContext} from './auditContext.mjs';
import {beginFieldOperation,completeFieldOperation,fieldRequestHash,fieldTransactionPool} from './fieldOperationReceipts.mjs';
import {createMaintenanceRecord} from './cemeteryMaintenanceMutations.mjs';
import {headstoneCemeteryIdSql,headstoneCemeteryJoinsSql} from './headstoneCemeterySql.mjs';
import {maintenanceRecordSelectSql,maintenanceRecordJoinSql} from './cemeteryMaintenanceQueries.mjs';
import {toMaintenanceRecord} from './cemeteryMappers.mjs';

const markerScope=`(SELECT ${headstoneCemeteryIdSql} FROM headstones ${headstoneCemeteryJoinsSql} WHERE headstones.id=m.headstone_uuid)`;
const activeParents=`(m.gravesite_uuid IS NULL OR EXISTS(SELECT 1 FROM gravesites g WHERE g.id=m.gravesite_uuid AND g.deleted_at IS NULL AND g.cemetery_id=m.cemetery_id)) AND(m.headstone_uuid IS NULL OR EXISTS(SELECT 1 FROM headstones h WHERE h.id=m.headstone_uuid AND h.deleted_at IS NULL AND ${markerScope}=m.cemetery_id))`;
const active=`m.status NOT IN('completed','not_needed')`;
export function validateTaskSchedule(input){
 const assignedToId=input?.assignedToId?validateUuid(input.assignedToId,'Assigned member'):null;
 const dueDate=optionalDate(input?.dueDate,'Due date')||null,remindOn=optionalDate(input?.remindOn,'Reminder date')||null;
 if(remindOn&&(!dueDate||remindOn>dueDate))throw new BadRequestError('A reminder needs a due date and must fall on or before it.');
 return {assignedToId,dueDate,remindOn};
}
export function validateTaskEdit(input){
 const expectedVersion=validateExpectedVersion(input?.expectedVersion),reason=requiredText(input?.reason,'Task change reason',500);
 if(input.dismissReminder===true){if(Object.keys(input).some(k=>!['expectedVersion','reason','dismissReminder'].includes(k)))throw new BadRequestError('Dismiss a reminder separately from task edits.');return {expectedVersion,reason,dismissReminder:true};}
 if(Object.keys(input).some(k=>!['expectedVersion','reason','assignedToId','dueDate','remindOn','status','completedAt','performedBy','notes'].includes(k)))throw new BadRequestError('Only task scheduling, status and notes may be changed here.');
 if(!['open','scheduled','completed','deferred','not_needed'].includes(input.status))throw new BadRequestError('Choose a maintenance status.');
 const completedAt=optionalDate(input.completedAt,'Completed date')||null;
 if(input.status==='completed'&&!completedAt)throw new BadRequestError('Record a completion date before completing this task.');
 if(input.status!=='completed'&&completedAt)throw new BadRequestError('Only completed tasks can have a completion date.');
 return {...validateTaskSchedule(input),expectedVersion,reason,status:input.status,completedAt,performedBy:optionalText(input.performedBy,'Performed by',200),notes:optionalText(input.notes,'Task notes',4000)};
}
export function validateTaskFilters(input={}){
 const view=input.view??'mine',state=input.state??'open',attention=input.attention??'all';
 if(!['mine','all','unassigned'].includes(view)||!['open','all','completed'].includes(state)||!['all','overdue','soon','reminder'].includes(attention))throw new BadRequestError('Choose valid task filters.');
 return {view,state,attention,today:optionalDate(input.today,'Calendar date')||new Date().toISOString().slice(0,10)};
}
const taskColumns=`m.id::text,m.xmin::text AS version,m.cemetery_id::text AS "cemeteryId",c.name AS "cemeteryName",m.gravesite_uuid::text AS "gravesiteUuid",m.headstone_uuid::text AS "headstoneUuid",g.gravesite_id AS "gravesiteId",h.headstone_id AS "markerId",concat_ws(' / ',i.label,a.label) AS title,p.label AS priority,m.status,m.observed_at::text AS "observedAt",m.completed_at::text AS "completedAt",coalesce(m.performed_by,'') AS "performedBy",coalesce(m.notes,'') AS notes,m.assigned_to_app_user_id::text AS "assignedToId",coalesce(nullif(u.display_name,''),u.email,'Unassigned') AS "assignedToName",coalesce(u.is_active AND(u.role_name='admin' OR EXISTS(SELECT 1 FROM app_user_cemetery_access eligible WHERE eligible.app_user_id=u.id AND eligible.cemetery_id=m.cemetery_id AND eligible.can_edit AND eligible.role_name IN('power-user','cemetery-admin'))),false) AS "assigneeActive",m.due_date::text AS "dueDate",m.remind_on::text AS "remindOn",m.reminder_dismissed_at::text AS "reminderDismissedAt"`;
const taskJoins=`JOIN cemeteries c ON c.id=m.cemetery_id AND c.deleted_at IS NULL LEFT JOIN gravesites g ON g.id=m.gravesite_uuid LEFT JOIN headstones h ON h.id=m.headstone_uuid LEFT JOIN maintenance_issue_types i ON i.id=m.issue_type_id LEFT JOIN maintenance_action_types a ON a.id=m.action_type_id LEFT JOIN maintenance_priority_types p ON p.id=m.priority_type_id LEFT JOIN app_users u ON u.id=m.assigned_to_app_user_id`;
export async function listMaintenanceTasks(pool,user,{cemeteryId,query='',limit=51,offset=0,...filters}){
 const {view,state,attention,today}=filters;
 if(cemeteryId&&!canEditCemetery(user,cemeteryId))return {forbidden:true};
 if(view==='mine'&&!user.id)throw new BadRequestError('A registered account is required for My tasks. Use the cemetery queue in local development.');
 const scope=cemeteryId?[cemeteryId]:user.role==='admin'?null:assignedEditableCemeteryIds(user);
 const pattern=`%${query.replace(/[\\%_]/gu,'\\$&')}%`;
 const result=await pool.query(`WITH tasks AS (
 SELECT ${taskColumns},coalesce((${active} AND m.due_date<$4::date),false) AS overdue,coalesce((${active} AND m.due_date BETWEEN $4::date AND $4::date+7),false) AS "dueSoon",coalesce((${active} AND m.remind_on<=$4::date AND m.reminder_dismissed_at IS NULL),false) AS "reminderDue"
 FROM maintenance_records m ${taskJoins} WHERE m.deleted_at IS NULL AND ${activeParents} AND($1::uuid[] IS NULL OR m.cemetery_id=ANY($1::uuid[]))
 AND($2='all' OR($2='mine' AND m.assigned_to_app_user_id=$3::uuid) OR($2='unassigned' AND m.assigned_to_app_user_id IS NULL))
 AND($5='all' OR($5='open' AND ${active}) OR($5='completed' AND m.status='completed'))
 AND concat_ws(' ',g.gravesite_id,h.headstone_id,i.label,a.label,m.notes,u.display_name) ILIKE $6
 ), filtered AS(SELECT * FROM tasks WHERE $7='all' OR($7='overdue' AND overdue) OR($7='soon' AND "dueSoon") OR($7='reminder' AND "reminderDue"))
 SELECT *,count(*) OVER()::int AS total,count(*) FILTER(WHERE overdue) OVER()::int AS overdues,count(*) FILTER(WHERE "reminderDue") OVER()::int AS reminders
 FROM filtered ORDER BY overdue DESC,"dueDate" NULLS LAST,"cemeteryName",id LIMIT $8 OFFSET $9`,[scope,view,user.id??null,today,state,pattern,attention,limit,offset]);
 const first=result.rows[0];return {rows:result.rows.map(row=>{const copy={...row};delete copy.total;delete copy.overdues;delete copy.reminders;return copy;}),summary:{total:first?.total??0,overdue:first?.overdues??0,reminders:first?.reminders??0},today};
}
export async function taskReminderSummary(pool,user,today){
 if(!user.id)return {attention:0,overdue:0,reminders:0,registered:false};
 const ids=user.role==='admin'?null:assignedEditableCemeteryIds(user);
 const {rows}=await pool.query(`SELECT count(*) FILTER(WHERE m.due_date<$3::date OR(m.remind_on<=$3::date AND m.reminder_dismissed_at IS NULL))::int AS attention,count(*) FILTER(WHERE m.due_date<$3::date)::int AS overdue,count(*) FILTER(WHERE m.remind_on<=$3::date AND m.reminder_dismissed_at IS NULL)::int AS reminders FROM maintenance_records m JOIN cemeteries c ON c.id=m.cemetery_id AND c.deleted_at IS NULL WHERE m.assigned_to_app_user_id=$1 AND ($2::uuid[] IS NULL OR m.cemetery_id=ANY($2::uuid[])) AND m.deleted_at IS NULL AND ${active} AND ${activeParents}`,[user.id,ids,today]);return {...rows[0],registered:true};
}
export async function listTaskAssignees(pool,cemeteryId,user,{query='',selectedId}={}){
 const pattern=`%${query.replace(/[\\%_]/gu,'\\$&')}%`;
 const {rows}=await pool.query(`SELECT u.id::text,coalesce(nullif(u.display_name,''),u.email) AS label FROM app_users u WHERE u.is_active AND(u.role_name='admin' AND u.id=$2::uuid OR(EXISTS(SELECT 1 FROM app_user_cemetery_access a WHERE a.app_user_id=u.id AND a.cemetery_id=$1 AND a.can_edit AND a.role_name IN('power-user','cemetery-admin')))) AND(concat_ws(' ',u.display_name,u.email) ILIKE $3 OR u.id=$4::uuid) ORDER BY(u.id=$4::uuid) DESC NULLS LAST,lower(coalesce(u.display_name,u.email)),u.id LIMIT 50`,[cemeteryId,user.id??null,pattern,selectedId??null]);return rows;
}
async function validateAssignee(client,cemeteryId,id,user,existingId){
 if(!id||id===existingId)return;
 const account=(await client.query('SELECT id,role_name,is_active FROM app_users WHERE id=$1 FOR SHARE',[id])).rows[0];
 const membership=(await client.query('SELECT role_name,can_edit FROM app_user_cemetery_access WHERE app_user_id=$1 AND cemetery_id=$2 FOR SHARE',[id,cemeteryId])).rows[0];
 if(!account?.is_active||!(account.role_name==='admin'&&id===user.id||membership?.can_edit&&['cemetery-admin','power-user'].includes(membership.role_name)))throw new BadRequestError('Choose an active editor assigned to this cemetery.');
}
export async function getMaintenanceTask(pool,id,user){
 const scope=user.role==='admin'?null:assignedEditableCemeteryIds(user);
 return (await pool.query(`SELECT ${taskColumns} FROM maintenance_records m ${taskJoins} WHERE m.id=$1 AND m.deleted_at IS NULL AND ${activeParents} AND($2::uuid[] IS NULL OR m.cemetery_id=ANY($2::uuid[]))`,[id,scope])).rows[0];
}
export async function createMaintenanceTask(pool,cemeteryId,record,schedule,user,{operationId}={}){
 if(!canEditCemetery(user,cemeteryId))return {forbidden:true};
 return withAuditContext(pool,{actorUser:user,reason:record.reason},async(client,rollback)=>{
  if(operationId){const receipt=await beginFieldOperation(client,user,operationId,fieldRequestHash({kind:'maintenance-task',cemeteryId,record,schedule}));if(receipt.replayed)return {...await getMaintenanceTask(client,receipt.response.id,user),id:receipt.response.id,replayed:true};}
  if(!(await client.query('SELECT id FROM cemeteries WHERE id=$1 AND deleted_at IS NULL FOR SHARE',[cemeteryId])).rowCount)return rollback(undefined);
  const choices=(await client.query(`SELECT EXISTS(SELECT 1 FROM maintenance_priority_types WHERE id=$1 AND is_active) AND($2::uuid IS NULL OR EXISTS(SELECT 1 FROM maintenance_issue_types WHERE id=$2 AND is_active)) AND($3::uuid IS NULL OR EXISTS(SELECT 1 FROM maintenance_action_types WHERE id=$3 AND is_active)) AS valid`,[record.priorityTypeId,record.issueTypeId||null,record.actionTypeId||null])).rows[0];
  if(!choices?.valid)throw new BadRequestError('A maintenance choice is no longer active. Reload the current choices.');
  await validateAssignee(client,cemeteryId,schedule.assignedToId,user);
  const created=await createMaintenanceRecord(fieldTransactionPool(client),cemeteryId,record,{actorUser:user,reason:record.reason,allowedCemeteryIds:[cemeteryId]});if(!created)return rollback(undefined);
  for(const [table,value]of [['gravesites',created.gravesiteUuid],['headstones',created.headstoneUuid]])if(value&&!(await client.query(`SELECT id FROM ${table} WHERE id=$1 AND deleted_at IS NULL FOR SHARE`,[value])).rowCount)return rollback(undefined);
  await client.query('UPDATE maintenance_records SET assigned_to_app_user_id=$2,due_date=$3,remind_on=$4 WHERE id=$1',[created.id,schedule.assignedToId,schedule.dueDate,schedule.remindOn]);const result=await getMaintenanceTask(client,created.id,user);if(!result)return rollback(undefined);if(operationId)await completeFieldOperation(client,user,operationId,{id:created.id});return {...result,replayed:false};
 });
}
export async function editMaintenanceTask(pool,id,input,user){
 return withAuditContext(pool,{actorUser:user,reason:input.reason},async(client,rollback)=>{
  const scope=user.role==='admin'?null:assignedEditableCemeteryIds(user);
  const existing=(await client.query(`SELECT m.*,m.xmin::text AS version FROM maintenance_records m JOIN cemeteries c ON c.id=m.cemetery_id AND c.deleted_at IS NULL WHERE m.id=$1 AND m.deleted_at IS NULL AND ${activeParents} AND($2::uuid[] IS NULL OR m.cemetery_id=ANY($2::uuid[])) FOR UPDATE OF m`,[id,scope])).rows[0];if(!existing)return rollback(undefined);
  assertRecordVersion(existing.version,input.expectedVersion);
  if(input.dismissReminder){if(!user.id||existing.assigned_to_app_user_id!==user.id)return rollback({forbidden:true});await client.query('UPDATE maintenance_records SET reminder_dismissed_at=clock_timestamp() WHERE id=$1',[id]);}
  else{
   await validateAssignee(client,existing.cemetery_id,input.assignedToId,user,existing.assigned_to_app_user_id);
   await client.query(`UPDATE maintenance_records SET assigned_to_app_user_id=$2,due_date=$3,remind_on=$4,status=$5,completed_at=$6,performed_by=NULLIF($7,''),notes=NULLIF($8,'') WHERE id=$1`,[id,input.assignedToId,input.dueDate,input.remindOn,input.status,input.completedAt,input.performedBy,input.notes]);
  }
  const result=await getMaintenanceTask(client,id,user);if(!result)return rollback(undefined);return result;
 });
}
export async function readMaintenanceRecord(pool,id,user){
 const scope=user.role==='admin'?null:assignedEditableCemeteryIds(user);
 const result=await pool.query(`SELECT ${maintenanceRecordSelectSql} FROM maintenance_records ${maintenanceRecordJoinSql} WHERE maintenance_records.id=$1 AND maintenance_records.deleted_at IS NULL AND($2::uuid[] IS NULL OR maintenance_records.cemetery_id=ANY($2::uuid[])) AND EXISTS(SELECT 1 FROM maintenance_records m JOIN cemeteries c ON c.id=m.cemetery_id AND c.deleted_at IS NULL WHERE m.id=maintenance_records.id AND ${activeParents})`,[id,scope]);return result.rows[0]?toMaintenanceRecord(result.rows[0]):undefined;
}
