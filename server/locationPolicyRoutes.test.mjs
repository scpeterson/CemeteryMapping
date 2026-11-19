import assert from 'node:assert/strict';
import test from 'node:test';
import {registerLocationPolicyRoutes} from './routes/locationPolicyRoutes.mjs';
import {previewToken,validatePolicyChange} from './locationPolicyAdministration.mjs';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const body={cemeteryId:id,sectionId:null,blockId:null,rule:'flat_markers_only',value:true,revision:'2',reason:'Reviewed change'};
function routes(){const handlers=new Map(),guard=()=>{};registerLocationPolicyRoutes({get(path,...h){handlers.set(path,h);},post(path,...h){handlers.set(path,h);}},{pool:{connect(){throw new Error('Unexpected database access');}},requireCemeteryAdmin:guard});return{handlers,guard};}
test('all policy routes require cemetery-administrator middleware',()=>{const {handlers,guard}=routes();assert.equal(handlers.size,3);for(const route of handlers.values())assert.equal(route[0],guard);});
test('cross-cemetery, system-scope and anonymous writes stop before database access',async()=>{
 const {handlers}=routes();
 for(const [user,patch] of [[{id,role:'cemetery-admin',cemeteryAccess:[{cemeteryId:id,role:'cemetery-admin',canEdit:true}]},{cemeteryId:other}],[{id,role:'cemetery-admin',cemeteryAccess:[]},{cemeteryId:null}],[{role:'admin'},{}]]){
  let status;await handlers.get('/api/admin/policies/preview')[1]({user,body:{...body,...patch}},{status(s){status=s;return this;},json(){}},e=>{throw e;});assert.equal(status,403);
 }
});
test('save requires proof for the exact account, scope, reason and value',async()=>{
 const {handlers}=routes(),input=validatePolicyChange(body),proof=previewToken(input,id);
 for(const [actor,patch] of [[id,{}],[other,{previewToken:proof}],[id,{previewToken:proof,value:false}],[id,{previewToken:proof,reason:'Another reason'}]]){
  let error;await handlers.get('/api/admin/policies/save')[1]({user:{id:actor,role:'admin'},body:{...body,...patch}}, {},e=>{error=e;});assert.equal(error?.name,'ConflictError');
 }
});
