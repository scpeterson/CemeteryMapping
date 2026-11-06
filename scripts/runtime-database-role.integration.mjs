import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { loadApiConfig } from "../server/config.mjs";

test("automated TEST uses restricted API credentials and can write audited records", async () => {
  const config = loadApiConfig();
  assert.equal(config.appEnv, "test");
  assert.equal(config.database.user, "cemetery_api", "Run APP_ENV=test npm run db:configure-api first");
  const pool = new pg.Pool(config.database);
  try {
    const { rows: [role] } = await pool.query(`SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
      has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
      has_table_privilege(current_user, 'databasechangelog', 'UPDATE') AS migration_write
      FROM pg_roles WHERE rolname=current_user`);
    for (const [privilege, allowed] of Object.entries(role)) assert.equal(allowed, false, privilege);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const changed = await client.query("UPDATE cemeteries SET name=name || ' [rolled-back security test]' WHERE id=(SELECT id FROM cemeteries LIMIT 1)");
      assert.equal(changed.rowCount, 1);
      const { rows: [audit] } = await client.query("SELECT count(*)::int AS count FROM audit_events WHERE transaction_id=txid_current() AND actor_database_user=current_user");
      assert.ok(audit.count >= 1);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  } finally {
    await pool.end();
  }
});

test('restricted API credentials support new import, merge, recovery, export and task workflows without schema ownership',async()=>{
 const {randomUUID}=await import('node:crypto');
 const {fieldTransactionPool}=await import('../server/fieldOperationReceipts.mjs');
 const {stageImport,decideImport}=await import('../server/cemeteryOnboardingRepository.mjs');
 const {previewBurialMerge,mergeBurials}=await import('../server/burialMergeRepository.mjs');
 const {listDeletedRecords,restoreDeletedRecord}=await import('../server/recordRecoveryRepository.mjs');
 const {createMaintenanceTask}=await import('../server/maintenanceTaskRepository.mjs');
 const {validateMaintenanceRecordPayload}=await import('../server/routes/cemeteryRouteValidation.mjs');
 const {exportRecords,validateExportOptions}=await import('../server/recordExportRepository.mjs');
 const config=loadApiConfig();assert.equal(config.appEnv,'test');assert.equal(config.database.user,'cemetery_api');
 const pool=new pg.Pool(config.database),client=await pool.connect();
 try{
  try{
  await client.query('BEGIN');const borrowed=fieldTransactionPool(client),actor={role:'admin',subject:`fixture|runtime-${randomUUID()}`};
  const grave=(await client.query('SELECT g.id,g.gravesite_id,g.cemetery_id FROM gravesites g JOIN cemeteries c ON c.id=g.cemetery_id AND c.deleted_at IS NULL WHERE g.deleted_at IS NULL LIMIT 1')).rows[0];
  const suffix=randomUUID().slice(0,8),batch=await stageImport(borrowed,grave.cemetery_id,{kind:'burials',sourceName:'runtime.csv',sourceText:`gravesiteId,firstName,lastName\n${grave.gravesite_id},Runtime,Donor-${suffix}\n${grave.gravesite_id},Runtime,Survivor-${suffix}`},actor);assert.equal(batch.review.errorCount,0);
  const approved=await decideImport(borrowed,grave.cemetery_id,batch.id,{decision:'approve',expectedVersion:batch.version,reason:'Runtime privilege fixture'},actor);assert.equal(approved.createdRecords.length,2);
  const [source,target]=approved.createdRecords,preview=await previewBurialMerge(borrowed,grave.cemetery_id,source.id,target.id,actor);assert.deepEqual(preview.blockers,[]);await mergeBurials(borrowed,grave.cemetery_id,{...preview,reason:'Runtime merge fixture',acknowledge:true},actor);
  const choices=(await client.query('SELECT(SELECT id FROM maintenance_issue_types WHERE is_active LIMIT 1) AS issue,(SELECT id FROM maintenance_priority_types WHERE is_active LIMIT 1) AS priority')).rows[0];
  const input=validateMaintenanceRecordPayload({graveSpaceId:grave.gravesite_id,issueTypeId:choices.issue,priorityTypeId:choices.priority,reason:'Runtime task fixture'}),schedule={assignedToId:null,dueDate:'2026-11-10',remindOn:'2026-11-08'},operationId=randomUUID();
  const task=await createMaintenanceTask(borrowed,grave.cemetery_id,input,schedule,actor,{operationId});assert.ok(task.id);assert.equal((await createMaintenanceTask(borrowed,grave.cemetery_id,input,schedule,actor,{operationId})).replayed,true);
  await client.query("UPDATE maintenance_records SET deleted_at=now(),delete_reason='Runtime recovery fixture' WHERE id=$1",[task.id]);
  const deleted=(await listDeletedRecords(borrowed,grave.cemetery_id,'maintenance_records',{query:task.id}))[0];await restoreDeletedRecord(borrowed,grave.cemetery_id,'maintenance_records',task.id,{expectedVersion:deleted.version,reason:'Runtime restore fixture'},actor);
  }finally{await client.query('ROLLBACK');client.release();}

  const cemetery=(await pool.query('SELECT id FROM cemeteries WHERE deleted_at IS NULL LIMIT 1')).rows[0];
  const result=await exportRecords(pool,cemetery.id,validateExportOptions({dataset:'maintenance',format:'csv',q:randomUUID()}),{role:'admin'});assert.equal(result.count,0);
 }finally{await pool.end();}
});
