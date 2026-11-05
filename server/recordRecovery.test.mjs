import assert from 'node:assert/strict';
import test from 'node:test';
import {replaceFaceBurialIds} from './burialMergeRepository.mjs';
import {listDeletedRecords} from './recordRecoveryRepository.mjs';
import {createApp} from './index.mjs';

test('merge remaps face people without changing readings, IDs, photos or historical evidence',()=>{
 const faces=[{id:'face',label:'Front',inscription:'  ORIGINAL\nWORDS',burialIds:['donor','survivor','other'],mediaAssetIds:['photo'],historicalTranscriptions:[{text:'Old reading'}]}];
 const result=replaceFaceBurialIds(faces,'donor','survivor');assert.deepEqual(result[0].burialIds,['survivor','other']);assert.deepEqual({...result[0],burialIds:[]},{...faces[0],burialIds:[]});assert.deepEqual(faces[0].burialIds,['donor','survivor','other']);
});
test('recovery rejects non-whitelisted tables before queries',async()=>{await assert.rejects(()=>listDeletedRecords({query(){throw new Error('No query');}},'cemetery','app_users'),{name:'BadRequestError'});});
test('recovery and merge APIs reject other-cemetery administrators without database access',async t=>{
 let queries=0;const app=createApp({appEnv:'test',auth:{mode:'trusted-header',roleHeader:'x-role',emailHeader:'x-email',subjectHeader:'x-subject',auth0:{management:{}}}},{query:async()=>{queries++;throw new Error('Forbidden query');}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
 const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',base=`http://127.0.0.1:${server.address().port}/api/cemeteries/${id}`;
 const headers={'x-role':'cemetery-admin','x-email':'fixture@example.test','x-cemetery-user-cemetery-ids':other};
 for(const [method,path]of [['GET','/deleted-records?kind=burials'],['POST',`/deleted-records/burials/${other}/restore`],['POST','/person-merge-preview'],['POST','/person-merges'],['GET',`/person-merges/${other}/evidence`]])assert.equal((await fetch(base+path,{method,headers})).status,403);
 assert.equal(queries,0);
});
