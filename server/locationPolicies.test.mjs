import assert from "node:assert/strict";
import test from "node:test";
import {validateHeadstoneBusinessRules} from "./routes/routeBusinessRules.mjs";
for(const restricted of [false,true])test(`marker edit uses resolved linked-grave policy: restricted=${restricted}`,async()=>{
 const queries=[];
 const pool={query:async(sql)=>{queries.push(sql);return {rows:sql.includes('SELECT code')?[{code:'footstone'}]:[{flat_only:restricted}]};}};
 const result=()=>validateHeadstoneBusinessRules(pool,'marker-id',{markerTypeId:'footstone-id'});
 if(restricted)await assert.rejects(result,/Location policy permits only flat markers/);else await result();
 assert.match(queries[1],/headstone_requires_flat_marker/);
 assert.doesNotMatch(queries[1],/sections.name|= 'G'/);
});
