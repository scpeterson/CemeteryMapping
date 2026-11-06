import assert from "node:assert/strict";
import test from "node:test";
import { assertRecordVersion, validateExpectedVersion } from "./recordVersions.mjs";
import { createApp } from "./index.mjs";

test("versions reject missing/malformed tokens and stale snapshots",()=>{
  for(const token of [undefined,null,"",12,"x".repeat(200),"version;drop"] )assert.throws(()=>validateExpectedVersion(token));
  for(const token of ["42","42:43","42:abcdef1234"])assert.equal(validateExpectedVersion(token),token);
  assert.throws(()=>assertRecordVersion("43","42"),{name:"ConflictError"});
  assert.doesNotThrow(()=>assertRecordVersion("42","42"));
});

test("public edit routes require captured versions before accessing records",async t=>{
  const id="11111111-1111-4111-8111-111111111111";
  let queries=0;
  const app=createApp({appEnv:"test",auth:{mode:"disabled",auth0:{management:{}}}}, {query:async()=>{queries++;throw new Error("Missing versions must not access data");}});
  const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(()=>new Promise(r=>server.close(r)));
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const [method,path,body] of [
    ["PATCH",`/api/burials/${id}`,{}],
    ["PATCH",`/api/headstones/${id}`,{markerTypeId:id,markerScopeId:id,materialId:id,conditionId:id}],
    ["PATCH",`/api/ownership-parties/${id}/events/${id}`,{firstName:"Fixture"}],
    ["PUT","/api/me/profile",{displayName:"Fixture"}],
    ["PUT",`/api/admin/users/${id}`,{}],
  ]){
    const response=await fetch(base+path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    assert.equal(response.status,400,path);
    assert.match((await response.json()).error,/version/iu);
  }
  assert.equal(queries,0);
});
