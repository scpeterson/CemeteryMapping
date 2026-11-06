import assert from 'node:assert/strict';
import test from 'node:test';
import {csvCell,recordsCsv,validateExportOptions,canExportCemetery,exportRecords} from './recordExportRepository.mjs';
import {createApp} from './index.mjs';

test('CSV escapes quotes/newlines and neutralizes spreadsheet formulas without modifying numeric values',()=>{
 for(const text of ['=CMD()','+SUM(A1:A2)','-1+2','@SUM(A1)',' \t=CMD()','\rformula'])assert.ok(csvCell(text).startsWith('"\''));
 assert.equal(csvCell(-79.5),'"-79.5"');assert.equal(csvCell('Line "one"\ntwo'),'"Line ""one""\ntwo"');assert.equal(recordsCsv([{name:'Alice, Example'}],['name']),'\uFEFF"name"\r\n"Alice, Example"\r\n');
 for(const input of [{dataset:'users',format:'csv'},{dataset:'ownership',format:'geojson'},{dataset:'gravesites',format:'csv',limit:'5001'},{dataset:'people',format:'csv',q:['bad']}])assert.throws(()=>validateExportOptions(input));
});
test('exports never substitute a global role for actual cemetery membership',async()=>{
 const user={role:'cemetery-admin',cemeteryAccess:[{cemeteryId:'one',role:'cemetery-admin',canEdit:true},{cemeteryId:'two',role:'reader',canEdit:false}]};
 assert.equal(canExportCemetery(user,'one'),true);assert.equal(canExportCemetery(user,'three'),false);
 const pool={query(){throw new Error('Private denial must not query data');}};
 assert.equal((await exportRecords(pool,'two',validateExportOptions({dataset:'ownership',format:'csv'}),user)).forbidden,true);
});
test('export routes deny unassigned readers and private exports before database work',async t=>{
 let queries=0;const app=createApp({appEnv:'test',auth:{mode:'trusted-header',roleHeader:'x-role',emailHeader:'x-email',subjectHeader:'x-subject',auth0:{management:{}}}},{query:async()=>{queries++;throw new Error('Forbidden query');}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',url=`http://127.0.0.1:${server.address().port}/api/cemeteries/${id}/export?format=csv&dataset=`;
 assert.equal((await fetch(url+'people')).status,401);
 assert.equal((await fetch(url+'people',{headers:{'x-role':'reader','x-email':'fixture@example.test','x-cemetery-user-cemetery-ids':other}})).status,403);
 for(const dataset of ['ownership','maintenance'])assert.equal((await fetch(url+dataset,{headers:{'x-role':'reader','x-email':'fixture@example.test','x-cemetery-user-cemetery-ids':id}})).status,403);
 assert.equal(queries,0);
});
