import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import {loadApiConfig} from '../server/config.mjs';
import {integrationAdminDatabase} from './lib/integration-admin.mjs';
import {fieldTransactionPool} from '../server/fieldOperationReceipts.mjs';
import {validateMaintenanceRecordPayload} from '../server/routes/cemeteryRouteValidation.mjs';
import {createMaintenanceTask,editMaintenanceTask,getMaintenanceTask,listMaintenanceTasks,taskReminderSummary,listTaskAssignees,validateTaskFilters,validateTaskEdit,readMaintenanceRecord} from '../server/maintenanceTaskRepository.mjs';
import {updateMaintenanceRecord} from '../server/cemeteryMaintenanceMutations.mjs';

test('assigned task lifecycle, safe creation retry, current membership checks, personal reminders and legacy editor conflicts',async()=>{
 const client=new pg.Client(integrationAdminDatabase(loadApiConfig()));await client.connect();
 try{
  await client.query('BEGIN');const pool=fieldTransactionPool(client),grave=(await client.query('SELECT g.id,g.gravesite_id,g.cemetery_id FROM gravesites g JOIN cemeteries c ON c.id=g.cemetery_id AND c.deleted_at IS NULL WHERE g.deleted_at IS NULL LIMIT 1')).rows[0];
  const actorId=randomUUID(),otherId=randomUUID(),readerId=randomUUID();
  for(const [id,role]of [[actorId,'power-user'],[otherId,'power-user'],[readerId,'reader']]){
   await client.query('INSERT INTO app_users(id,external_subject,email,display_name,role_name) VALUES($1,$2,$3,$4,$5)',[id,`fixture|${id}`,`${id}@example.test`,`Task ${role}`,'reader']);
   await client.query('INSERT INTO app_user_cemetery_access(app_user_id,cemetery_id,role_name,can_edit) VALUES($1,$2,$3,$4)',[id,grave.cemetery_id,role,role!=='reader']);
  }
  const actor={id:actorId,subject:`fixture|${actorId}`,role:'power-user',cemeteryAccess:[{cemeteryId:grave.cemetery_id,role:'power-user',canEdit:true}]},other={...actor,id:otherId,subject:`fixture|${otherId}`};
  const choices=(await client.query('SELECT(SELECT id FROM maintenance_issue_types WHERE is_active LIMIT 1) AS issue,(SELECT id FROM maintenance_priority_types WHERE is_active LIMIT 1) AS priority')).rows[0];
  const notes=`Task fixture ${randomUUID()}`,record=validateMaintenanceRecordPayload({targetType:'gravesite',graveSpaceId:grave.gravesite_id,issueTypeId:choices.issue,priorityTypeId:choices.priority,observedAt:'2026-11-01',notes,reason:'Create reviewed task'}),schedule={assignedToId:actorId,dueDate:'2026-11-04',remindOn:'2026-11-03'},operationId=randomUUID();
  const first=await createMaintenanceTask(pool,grave.cemetery_id,record,schedule,actor,{operationId});assert.ok(first.id);assert.equal(first.assigneeActive,true);assert.equal((await createMaintenanceTask(pool,grave.cemetery_id,record,schedule,actor,{operationId})).id,first.id);
  await assert.rejects(()=>createMaintenanceTask(pool,grave.cemetery_id,{...record,notes:'Changed retry'},schedule,actor,{operationId}),{name:'ConflictError'});
  const listed=await listMaintenanceTasks(pool,actor,{...validateTaskFilters({today:'2026-11-05'}),query:notes});assert.equal(listed.summary.total,1);assert.equal(listed.rows[0].overdue,true);assert.equal(listed.rows[0].reminderDue,true);
  const assignees=await listTaskAssignees(pool,grave.cemetery_id,actor);assert.ok(assignees.some(u=>u.id===actorId));assert.ok(!assignees.some(u=>u.id===readerId));
  const task=()=>getMaintenanceTask(pool,first.id,actor);
  let current=await task();assert.equal((await editMaintenanceTask(pool,current.id,validateTaskEdit({expectedVersion:current.version,reason:'Wrong person',dismissReminder:true}),other)).forbidden,true);
  await editMaintenanceTask(pool,current.id,validateTaskEdit({expectedVersion:current.version,reason:'Read my reminder',dismissReminder:true}),actor);
  let summary=await taskReminderSummary(pool,actor,'2026-11-05');assert.equal(summary.reminders,0);assert.ok(summary.overdue>=1,'dismissing reminder does not remove overdue work');
  current=await task();const legacy=await readMaintenanceRecord(pool,current.id,actor);
  const edit={expectedVersion:current.version,reason:'Rescheduled visit',assignedToId:actorId,dueDate:'2026-11-10',remindOn:'2026-11-08',status:'scheduled',completedAt:'',performedBy:'',notes};
  current=await editMaintenanceTask(pool,current.id,validateTaskEdit(edit),actor);assert.equal(current.reminderDismissedAt,null);
  await assert.rejects(()=>updateMaintenanceRecord(pool,current.id,{...record,status:'completed',completedAt:'2026-11-05',expectedVersion:legacy.version},{actorUser:actor,allowedCemeteryIds:[grave.cemetery_id]}),{name:'ConflictError'});
  await assert.rejects(()=>editMaintenanceTask(pool,current.id,validateTaskEdit({...edit,expectedVersion:current.version,assignedToId:readerId}),actor),/active editor/);
  const before=await taskReminderSummary(pool,actor,'2026-11-05'),due=await taskReminderSummary(pool,actor,'2026-11-09');assert.equal(before.attention,0);assert.equal(due.reminders,1);
  current=await editMaintenanceTask(pool,current.id,validateTaskEdit({...edit,expectedVersion:current.version,status:'completed',completedAt:'2026-11-09',performedBy:'Fixture worker'}),actor);assert.equal((await taskReminderSummary(pool,actor,'2026-11-09')).attention,0);
  assert.equal((await listMaintenanceTasks(pool,actor,{...validateTaskFilters({today:'2026-11-09',state:'completed'}),query:notes})).summary.total,1);
  const completed=await readMaintenanceRecord(pool,current.id,actor);await updateMaintenanceRecord(pool,current.id,{...record,status:'open',completedAt:'',expectedVersion:completed.version},{actorUser:actor,allowedCemeteryIds:[grave.cemetery_id]});current=await task();assert.equal(current.assignedToId,actorId);assert.equal(current.dueDate,'2026-11-10');assert.equal(current.reminderDismissedAt,null);assert.equal((await taskReminderSummary(pool,actor,'2026-11-09')).reminders,1);
  assert.equal(await getMaintenanceTask(pool,current.id,{...actor,cemeteryAccess:[]}),undefined);
  assert.ok((await client.query("SELECT 1 FROM audit_events WHERE target_table='maintenance_records' AND target_record_id=$1",[current.id])).rowCount);
 }finally{await client.query('ROLLBACK');await client.end();}
});

test('independent task and maintenance editors allow one writer without clearing schedules',async()=>{
 const config=integrationAdminDatabase(loadApiConfig()),admin=new pg.Client(config);await admin.connect();const schema=`task_race_${randomUUID().replaceAll('-','')}`;let pool;
 try{
  await admin.query(`CREATE SCHEMA ${schema}`);for(const table of ['maintenance_records','audit_events'])await admin.query(`CREATE TABLE ${schema}.${table}(LIKE public.${table} INCLUDING ALL)`);
  pool=new pg.Pool({...config,max:3,options:`-c search_path=${schema},public -c lock_timeout=10000 -c statement_timeout=15000`});
  const grave=(await pool.query('SELECT id,gravesite_id,cemetery_id FROM gravesites WHERE deleted_at IS NULL LIMIT 1')).rows[0],id=randomUUID(),actor={role:'admin',subject:'fixture|task-race'};
  const issue=(await pool.query('SELECT id FROM maintenance_issue_types WHERE is_active LIMIT 1')).rows[0],priority=(await pool.query('SELECT id FROM maintenance_priority_types WHERE is_active LIMIT 1')).rows[0];
  await pool.query("INSERT INTO maintenance_records(id,cemetery_id,gravesite_uuid,issue_type_id,priority_type_id,status,observed_at,due_date,remind_on) VALUES($1,$2,$3,$4,$5,'open','2026-11-01','2026-11-10','2026-11-08')",[id,grave.cemetery_id,grave.id,issue.id,priority.id]);
  const current=await getMaintenanceTask(pool,id,actor),record=validateMaintenanceRecordPayload({issueTypeId:issue.id,priorityTypeId:priority.id,status:'deferred',notes:'Legacy winner'},{requireTarget:false});
  const outcomes=await Promise.allSettled([
   editMaintenanceTask(pool,id,validateTaskEdit({expectedVersion:current.version,reason:'Queue race',assignedToId:'',dueDate:'2026-11-10',remindOn:'2026-11-08',status:'completed',completedAt:'2026-11-05',performedBy:'Queue worker',notes:'Queue winner'}),actor),
   updateMaintenanceRecord(pool,id,{...record,expectedVersion:current.version},{actorUser:actor}),
  ]);
  assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal(outcomes.find(o=>o.status==='rejected').reason.name,'ConflictError');
  const after=await getMaintenanceTask(pool,id,actor);assert.ok(['Queue winner','Legacy winner'].includes(after.notes));assert.equal(after.dueDate,'2026-11-10');assert.equal(after.remindOn,'2026-11-08');
 }finally{if(pool)await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
