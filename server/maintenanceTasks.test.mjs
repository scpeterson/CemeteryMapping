import assert from 'node:assert/strict';
import test from 'node:test';
import {validateTaskSchedule,validateTaskEdit,validateTaskFilters} from './maintenanceTaskRepository.mjs';
import {createApp} from './index.mjs';

test('task dates, completion and reminder edits require explicit consistent values',()=>{
 assert.throws(()=>validateTaskSchedule({remindOn:'2026-11-05'}),/due date/);
 assert.throws(()=>validateTaskSchedule({dueDate:'2026-11-04',remindOn:'2026-11-05'}),/on or before/);
 assert.throws(()=>validateTaskSchedule({dueDate:'2026-02-29'}),/valid calendar/);
 assert.throws(()=>validateTaskEdit({expectedVersion:'1',reason:'Complete',status:'completed'}),/completion date/);
 assert.throws(()=>validateTaskEdit({expectedVersion:'1',reason:'Reopen',status:'open',completedAt:'2026-11-05'}),/Only completed/);
 assert.throws(()=>validateTaskEdit({expectedVersion:'1',reason:'Dismiss',dismissReminder:true,assignedToId:'other'}),/separately/);
 assert.throws(()=>validateTaskFilters({view:'everyone'}));
 assert.equal(validateTaskFilters({today:'2026-11-05'}).today,'2026-11-05');
});
test('public task updates and the existing maintenance editor reject missing versions before data queries',async t=>{
 let queries=0;const app=createApp({appEnv:'test',auth:{mode:'disabled',auth0:{management:{}}}},{query:async()=>{queries++;throw new Error('No data query expected');}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const id='11111111-1111-4111-8111-111111111111',base=`http://127.0.0.1:${server.address().port}`;
 for(const [method,path]of [['PUT',`/api/maintenance-tasks/${id}`],['POST',`/api/maintenance-tasks/${id}/dismiss-reminder`],['PATCH',`/api/maintenance-records/${id}`]])assert.equal((await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:'{}'})).status,400);
 assert.equal(queries,0);
});
test('task creation and assignee discovery reject reader and foreign cemetery requests',async t=>{
 let queries=0;const app=createApp({appEnv:'test',auth:{mode:'trusted-header',roleHeader:'x-role',emailHeader:'x-email',subjectHeader:'x-subject',auth0:{management:{}}}},{query:async()=>{queries++;throw new Error('Forbidden query');}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/api/maintenance-tasks',{headers:{'x-role':'reader','x-email':'fixture@example.test'}})).status,403);
 for(const [method,path]of [['GET',`/api/cemeteries/${id}/task-assignees`],['POST',`/api/cemeteries/${id}/maintenance-tasks`],['GET',`/api/task-gravesites?cemeteryId=${id}`],['GET',`/api/maintenance-tasks?cemeteryId=${id}&view=all`]])assert.equal((await fetch(base+path,{method,headers:{'x-role':'power-user','x-email':'fixture@example.test','x-cemetery-user-cemetery-ids':other}})).status,403);
 assert.equal(queries,0);
});
