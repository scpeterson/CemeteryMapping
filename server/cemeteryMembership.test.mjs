import assert from "node:assert/strict";
import test from "node:test";
import { canManageCemeteryMembers, validateMembership } from "./cemeteryMembershipRepository.mjs";
import { createApp } from "./index.mjs";

const cemeteryId="11111111-1111-4111-8111-111111111111";
const otherId="22222222-2222-4222-8222-222222222222";
test("member administration checks the target cemetery role and rejects system account fields",()=>{
  const actor={role:"cemetery-admin",cemeteryAccess:[{cemeteryId,role:"cemetery-admin",canEdit:true},{cemeteryId:otherId,role:"power-user",canEdit:true}]};
  assert.equal(canManageCemeteryMembers(actor,cemeteryId),true);
  assert.equal(canManageCemeteryMembers(actor,otherId),false);
  assert.equal(canManageCemeteryMembers({role:"admin"},otherId),true);
  const input={email:"PERSON@example.test",displayName:"Person",role:"reader",reason:"Volunteer access"};
  assert.equal(validateMembership(input,{invite:true}).email,"person@example.test");
  for(const extra of [{role:"admin"},{isActive:true},{externalSubject:"auth0|other"},{cemeteryMemberships:[]}]){
    assert.throws(()=>validateMembership({...input,...extra},{invite:true}));
  }
  assert.throws(()=>validateMembership({...input,email:"invalid"},{invite:true}));
  assert.throws(()=>validateMembership({role:"reader",expectedVersion:"",reason:"Changed role"}));
});

test("real membership endpoints reject anonymous, reader, power-user and other-cemetery administrators without database access",async t=>{
  let queries=0;
  const app=createApp({appEnv:"test",auth:{mode:"trusted-header",roleHeader:"x-role",emailHeader:"x-email",subjectHeader:"x-subject",auth0:{management:{}}}}, {query:async()=>{queries++;throw new Error("Forbidden requests must not query data");}});
  const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}/api/cemeteries/${cemeteryId}/members`;
  for(const method of ["GET","POST","PUT","DELETE"]){
    const url=base+(["PUT","DELETE"].includes(method)?`/${otherId}`:"");
    assert.equal((await fetch(url,{method})).status,401);
    for(const role of ["reader","power-user","cemetery-admin"]){
      const headers={"x-role":role,"x-email":"test@example.test","x-cemetery-user-cemetery-ids":otherId};
      assert.equal((await fetch(url,{method,headers})).status,403);
    }
  }
  assert.equal(queries,0);
});
