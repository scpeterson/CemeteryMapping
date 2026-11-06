import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {fieldRequestHash,fieldTransactionPool} from './fieldOperationReceipts.mjs';
import {validateFieldOperation} from './fieldCollectionRepository.mjs';

test('field receipts hash semantic JSON consistently and bind all content',()=>{
  assert.equal(fieldRequestHash({a:1,b:{y:2,x:3}}),fieldRequestHash({b:{x:3,y:2},a:1}));
  assert.notEqual(fieldRequestHash({a:1}),fieldRequestHash({a:2}));
});
test('field operations require versions and separate new observations from metadata',()=>{
  const common={id:randomUUID(),cemeteryId:randomUUID(),targetId:randomUUID()};
  assert.throws(()=>validateFieldOperation({...common,kind:'burial',payload:{firstName:'Test',lastName:'Person'}}),/version|reload/i);
  assert.throws(()=>validateFieldOperation({...common,kind:'unexpected',payload:{}}),/Unsupported/);
  assert.throws(()=>validateFieldOperation({...common,kind:'link',payload:{gravesiteId:randomUUID(),relationshipType:'primary'}}),/primary/);
});
test('borrowed mutation transactions cannot commit the enclosing receipt',async()=>{
  const statements=[];const pool=fieldTransactionPool({query:async(sql)=>{statements.push(sql);return {rows:[]};}});
  const client=await pool.connect();await client.query('BEGIN');await client.query('UPDATE fixture');await client.query('COMMIT');client.release();
  const savepoint=statements[0].slice('SAVEPOINT '.length);assert.match(savepoint,/^field_mutation_\d+_\d+$/u);
  assert.deepEqual(statements,[`SAVEPOINT ${savepoint}`,'UPDATE fixture',`RELEASE SAVEPOINT ${savepoint}`]);
});

test('field endpoints reject unassigned editors before loading snapshots or receipts',async t=>{
  const {createApp}=await import('./index.mjs');let queries=0;
  const app=createApp({appEnv:'test',auth:{mode:'trusted-header',roleHeader:'x-role',emailHeader:'x-email',subjectHeader:'x-subject',auth0:{management:{}}}},{query:async()=>{queries++;throw new Error('Forbidden query');}});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>new Promise(r=>server.close(r)));
  const id=randomUUID(),other=randomUUID(),base=`http://127.0.0.1:${server.address().port}`;
  for(const path of [`/api/field-markers?cemeteryId=${id}`,`/api/cemeteries/${id}/field-snapshot/${other}`]){
    assert.equal((await fetch(base+path)).status,401);
    assert.equal((await fetch(base+path,{headers:{'x-role':'power-user','x-email':'fixture@example.test','x-cemetery-user-cemetery-ids':other}})).status,403);
  }
  assert.equal(queries,0);
});
