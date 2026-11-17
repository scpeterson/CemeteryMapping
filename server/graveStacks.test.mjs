import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGraveStack,optionalStackDate,saveGraveStack} from './graveStacks.mjs';
import {validateGraveSpacePayload} from './routes/cemeteryRouteValidation.mjs';

test('ordinary graves stay unstacked; legacy PATCH preserves stacking',()=>{
 assert.equal(validateGraveStack({}),undefined);
 assert.equal(validateGraveSpacePayload({expectedVersion:'1',status:'reserved'}).stack,undefined);
 assert.deepEqual(validateGraveStack({stackGroup:''}),{stackGroup:'',stackLevel:null,stackingAuthorizedOn:'',stackingAuthorizationReference:''});
 assert.throws(()=>validateGraveStack({stackGroup:'',stackLevel:2}),/Single-level/);
});
test('stack levels and upper authorizations are explicit and dates are real calendar dates',()=>{
 assert.equal(validateGraveStack({stackGroup:' Family A ',stackLevel:1}).stackGroup,'Family A');
 const upper={stackGroup:'A',stackLevel:2,stackingAuthorizedOn:'2027-02-28',stackingAuthorizationReference:'Deed 123'};
 assert.equal(validateGraveStack(upper).stackLevel,2);
 for(const level of [0,-1,1.5,2147483648,'bad']) assert.throws(()=>validateGraveStack({...upper,stackLevel:level}),/positive whole/);
 for(const date of ['0000-01-01','2027-02-29','2027-13-01','2027-03-01T00:00:00Z','unknown']) assert.throws(()=>optionalStackDate(date),/valid YYYY/);
 assert.throws(()=>validateGraveStack({...upper,stackingAuthorizedOn:''}),/require an authorization/);
 assert.throws(()=>validateGraveStack({...upper,stackingAuthorizationReference:''}),/require an authorization/);
});
test('stacking edits require administration in the target cemetery, not merely a global role',async()=>{
 const existing={uuid:'g',cemetery_id:'A'};
 const stack=validateGraveStack({stackGroup:'A',stackLevel:1});
 const client={query:async()=>({rows:[{}]})};
 for(const actor of [{role:'power-user'},{role:'cemetery-admin',cemeteryAccess:[{cemeteryId:'A',role:'reader'}]}])
  await assert.rejects(saveGraveStack(client,existing,stack,actor),/Only cemetery/);
});

test('authorization evidence is absent from public summaries and ownership-redacted details', async()=>{
 const {toGraveSummary,toDetailedGrave}=await import('./cemeteryGraveQueries.mjs');
 const row={gravesite_id:'A',cemetery_id:'C',stack_group:'Family',stack_level:2,stacking_authorized_on:'2027-02-28',stacking_authorization_reference:'Private register',geometry:{type:'MultiPolygon',coordinates:[]}};
 assert.equal(toGraveSummary(row).stackingAuthorizationReference,undefined);
 const detail=include=>toDetailedGrave(row,[],[],[],[],[],[],[],include);
 assert.equal(detail(false).stackingAuthorizationReference,undefined);
 assert.equal(detail(false).stackingAuthorizedOn,undefined);
 assert.equal(detail(true).stackingAuthorizationReference,'Private register');
});

test('cemetery stacking policy changes require an administrator for that cemetery',async()=>{
 const {updateCemeteryText}=await import('./cemeteryAdminRepository.mjs');
 let wrote=false;
 const client={release(){},async query(sql){
  if(sql.startsWith('UPDATE cemeteries'))wrote=true;
  return {rows:sql.includes('SELECT stacking_authorization_cutoff')?[{cutoff:'2027-03-01',notes:''}]:[]};
 }};
 await assert.rejects(updateCemeteryText({connect:async()=>client},'A',{stackingAuthorizationCutoff:''},{actorUser:{role:'cemetery-admin',cemeteryAccess:[{cemeteryId:'A',role:'power-user'}]}}),/Only cemetery/);
 assert.equal(wrote,false);
});
