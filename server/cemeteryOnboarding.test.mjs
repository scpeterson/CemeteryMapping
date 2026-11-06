import assert from 'node:assert/strict';
import test from 'node:test';
import {parseImportCsv,parseImportSource} from './cemeteryOnboardingRepository.mjs';
import {createApp} from './index.mjs';

test('import CSV preserves quoted evidence and rejects ambiguous headers and malformed records',()=>{
 const rows=parseImportCsv('gravesiteId,firstName,lastName,notes\r\nA-1,Alice,Example,"Recorded, with ""quotes""\nand lines"\r\n');
 assert.equal(rows[0].notes,'Recorded, with "quotes"\nand lines');
 for(const source of ['gravesiteId,lastName,lastName\nA,One,Two','gravesiteId,lastName,unknown\nA,One,Two','gravesiteId,lastName\nA,"Open','gravesiteId,lastName\nA,"Name"bad','gravesiteId,lastName\nA,One,Extra'])assert.throws(()=>parseImportCsv(source));
 assert.throws(()=>parseImportSource('gravesites','{}'));
 assert.throws(()=>parseImportSource('burials','x'.repeat(2*1024*1024+1)));
});
test('onboarding scope rejects other-cemetery administrators and global creation escalation',async t=>{
 let queries=0;const app=createApp({appEnv:'test',auth:{mode:'trusted-header',roleHeader:'x-role',emailHeader:'x-email',subjectHeader:'x-subject',auth0:{management:{}}}},{query:async()=>{queries++;throw new Error('Forbidden request queried data');}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',base=`http://127.0.0.1:${server.address().port}`;
 const headers={'x-role':'cemetery-admin','x-email':'fixture@example.test','x-cemetery-user-cemetery-ids':other};
 for(const path of [`/api/cemeteries/${id}/import-batches`,`/api/cemeteries/${id}/import-batches/${other}/source`])assert.equal((await fetch(base+path,{headers})).status,403);
 assert.equal((await fetch(base+'/api/onboarding/cemeteries',{method:'POST',headers})).status,403);assert.equal(queries,0);
});
