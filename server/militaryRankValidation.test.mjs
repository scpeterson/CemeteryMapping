import assert from "node:assert/strict";
import test from "node:test";
import { validateLookupPayload } from "./routes/adminRouteValidation.mjs";
const rank = {code:"tec4",label:"Technician fourth grade",description:"Historical Army rank",militaryBranchId:"11111111-1111-4111-8111-111111111111",abbreviation:"Tec 4",payGrade:"4th Grade",rankGroup:"enlisted",isActive:true};
test("rank validation retains historical pay grades and requires branch, abbreviation and group",()=>{
  assert.deepEqual(validateLookupPayload(rank,"military_rank_types"),{...rank,sourceNotes:"",sourceUrl:""});
  for(const patch of [{militaryBranchId:""},{abbreviation:""},{abbreviation:"a".repeat(21)},{payGrade:"a".repeat(11)},{rankGroup:"invalid"}]) {
    assert.throws(()=>validateLookupPayload({...rank,...patch},"military_rank_types"));
  }
  assert.equal(validateLookupPayload({...rank,payGrade:""},"military_rank_types").payGrade,"");
});
test("ordinary lookup validation does not require rank fields",()=>{
  assert.equal(validateLookupPayload({code:"x",label:"X",description:"Example"},"marker_types").label,"X");
});
