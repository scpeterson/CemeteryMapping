import assert from 'node:assert/strict';
import test from 'node:test';
import {validatePolicyChange,canManagePolicy,previewToken,verifyPreview} from './locationPolicyAdministration.mjs';
import {matchingPolicies,localPolicy} from '../shared/locationPolicyResolution.mjs';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const body={cemeteryId:id,sectionId:null,blockId:null,rule:'flat_markers_only',value:false,reason:'A reviewed exception',revision:'8'};
test('policy changes reject unknown rules, integrity overrides, invalid scopes and absent reasons',()=>{
 for(const patch of [{rule:'stacking_authorization_cutoff'},{rule:'disable_foreign_keys'},{value:'false'},{value:undefined},{revision:8},{revision:'-1'},{reason:''},{blockId:id},{cemeteryId:null,sectionId:id},{actorId:id},{cemeteryId:false}])assert.throws(()=>validatePolicyChange({...body,...patch}));
 assert.equal(validatePolicyChange(body).value,false);assert.equal(validatePolicyChange({...body,value:null}).value,null);
});
test('policy permissions restrict cemetery administrators to their actual editable memberships',()=>{
 const user={role:'cemetery-admin',cemeteryAccess:[{cemeteryId:id,role:'cemetery-admin',canEdit:true},{cemeteryId:other,role:'power-user',canEdit:true}]};
 assert.equal(canManagePolicy(user,body),true);assert.equal(canManagePolicy(user,{cemeteryId:other}),false);assert.equal(canManagePolicy(user,{cemeteryId:null}),false);
 assert.equal(canManagePolicy({role:'admin'},{cemeteryId:null}),true);
});
test('preview proof binds account, reason, scope, rule, value, revision and five-minute lifetime',()=>{
 const input=validatePolicyChange(body),time=1770000000000,token=previewToken(input,id,time);
 assert.equal(verifyPreview(token,input,id,time+100),true);
 for(const patch of [{value:true},{reason:'Changed reason'},{cemeteryId:other},{rule:'no_gravesites'},{revision:'9'}])assert.equal(verifyPreview(token,{...input,...patch},id,time+100),false);
 assert.equal(verifyPreview(token,input,other,time+100),false);assert.equal(verifyPreview(token,input,id,time+300001),false);assert.equal(verifyPreview(token,input,id,time-1),false);assert.equal(verifyPreview('bad',input,id,time),false);
});
test('UI source resolution retains explicit false overrides and removes local values for inheritance',()=>{
 const system={cemetery_id:null,section_uuid:null,block_uuid:null,rule_key:'flat_markers_only',enabled:true};
 const cemetery={...system,cemetery_id:id,enabled:false},section={...cemetery,section_uuid:other,enabled:true};
 const scope={cemeteryId:id,sectionId:other,blockId:null};
 assert.deepEqual(matchingPolicies([system,cemetery,section],scope,'flat_markers_only'),[section,cemetery,system]);
 assert.equal(localPolicy([system,cemetery],scope,'flat_markers_only'),undefined);
 assert.equal(matchingPolicies([system,cemetery],scope,'flat_markers_only')[0].enabled,false);
});
