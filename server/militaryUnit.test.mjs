import assert from 'node:assert/strict';
import test from 'node:test';
import {validateBurialPayload} from './routes/cemeteryRouteValidation.mjs';
import {toBurial} from './cemeteryMappers.mjs';
const unit='Company E, 136th Pennsylvania Infantry Regiment';
test('military unit accepts recorded text, clearing, and omitted legacy values',()=>{
 assert.equal(validateBurialPayload({firstName:'Daniel',militaryUnit:`  ${unit}  `}).militaryUnit,unit);
 assert.equal(validateBurialPayload({firstName:'Daniel',militaryUnit:''}).militaryUnit,'');
 assert.equal(validateBurialPayload({firstName:'Daniel'}).militaryUnit,undefined);
 assert.throws(()=>validateBurialPayload({firstName:'Daniel',militaryUnit:'a'.repeat(501)}),/Military unit.*too long/);
});
test('military unit is mapped independently of branch and rank',()=>{
 assert.equal(toBurial({id:'example',military_unit:unit,military_branch:'U.S. Army'}).militaryUnit,unit);
 assert.equal(toBurial({id:'example'}).militaryUnit,'');
});
