import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNewInspections } from './monumentInspections.mjs';
const entry = { id:'11111111-1111-4111-8111-111111111111', inspectedAt:'2026-10-13', sourceType:'field_survey', source:'Scott Peterson',conditionId:'22222222-2222-4222-8222-222222222222',conditionNotes:'Weathered',inscription:'Current reading' };
test('NHG dates are always October 11 2005, while field observations retain their own values',()=>{
 const [nhg,field] = validateNewInspections([{...entry,sourceType:'nhg',inspectedAt:'2003-09-26',conditionNotes:'exc cond',inscription:'NHG reading'},entry]);
 assert.equal(nhg.inspectedAt,'2005-10-11');assert.equal(field.inspectedAt,'2026-10-13');
 assert.equal(nhg.inscription,'NHG reading');assert.equal(field.inscription,'Current reading');
 assert.equal(field.conditionNotes,'Weathered');
});
test('inspections require valid dates, sources, condition references and bounded input',()=>{
 for(const change of [{inspectedAt:'2026-02-30'},{inspectedAt:''},{source:''},{conditionId:'poor'},{sourceType:'other'}]) assert.throws(()=>validateNewInspections([{...entry,...change}]));
 assert.throws(()=>validateNewInspections({}));assert.throws(()=>validateNewInspections(Array(21).fill(entry)));
});

test('editing an inspection requires its version and preserves a year-only observation',()=>{
 const version='2026-10-21T12:00:00.123456+00:00';
 const [edited]=validateNewInspections([{...entry,inspectedAt:'',inspectionYear:2026,expectedUpdatedAt:version}],{updating:true});
 assert.equal(edited.inspectionYear,2026);assert.equal(edited.inspectedAt,'');
 assert.equal(edited.expectedUpdatedAt,version);
 assert.throws(()=>validateNewInspections([entry],{updating:true}),/version/);
 assert.throws(()=>validateNewInspections([{...entry,expectedUpdatedAt:'bad'}],{updating:true}),/version/);
});

test('only cemetery admins and global admins can edit inspections',async()=>{
 const {assertInspectionEditor,inspectionFieldsChanged}=await import('./monumentInspections.mjs');
 for(const role of ['reader','power-user']) assert.throws(()=>assertInspectionEditor({role}),{statusCode:403});
 for(const role of ['cemetery-admin','admin']) assert.doesNotThrow(()=>assertInspectionEditor({role}));
 const previous={condition_type_id:entry.conditionId,condition_notes:entry.conditionNotes,last_inspected_at:entry.inspectedAt,inscription:entry.inscription};
 const same={conditionId:entry.conditionId,conditionNotes:entry.conditionNotes,lastInspectedAt:entry.inspectedAt,inscription:entry.inscription};
 assert.equal(inspectionFieldsChanged(previous,same),false);
 for(const changed of [{conditionId:entry.id},{conditionNotes:'Changed'},{lastInspectedAt:'2026-10-21'},{inscription:'Changed'}]) assert.equal(inspectionFieldsChanged(previous,{...same,...changed}),true);
});


test('copied inspection transcriptions preserve all whitespace and line breaks',()=>{
 const inscription='  FAMILY\n[illegible lines]  ';
 assert.equal(validateNewInspections([{...entry,inscription}])[0].inscription,inscription);
 assert.throws(()=>validateNewInspections([{...entry,inscription:{text:'bad'}}]));
});

test('inspection face readings preserve whitespace, validate identity and discard photo links',()=>{
 const faces=[{id:entry.id,label:'Front',inscription:'  FRONT\nREADING  ',mediaAssetIds:[entry.conditionId]},{id:entry.conditionId,label:'Back',inscription:'BACK'}];
 const result=validateNewInspections([{...entry,faces}])[0];
 assert.equal(result.faces[0].inscription,faces[0].inscription);
 assert.equal(result.faces[0].mediaAssetIds,undefined);
 assert.throws(()=>validateNewInspections([{...entry,faces:[faces[0],faces[0]]}]),/unique/);
 assert.throws(()=>validateNewInspections([{...entry,faces:[{...faces[0],label:''}]}]),/label/);
 assert.throws(()=>validateNewInspections([{...entry,faces:[{...faces[0],id:'wrong'}]}]));
});

test('explicitly empty inspection faces are rejected; legacy omitted faces use the database default',()=>{
 assert.throws(()=>validateNewInspections([{...entry,faces:[]}]),/between 1 and 32/);
 assert.equal(validateNewInspections([entry])[0].faces,undefined);
});

test('inspection face designs preserve exact text, allow clearing, and reject invalid values',()=>{
 const face={id:entry.id,label:'Front',inscription:'Reading',designNotes:'  Ivy\nCarved rose  '};
 assert.deepEqual(validateNewInspections([{...entry,faces:[face]}])[0].faces,[face]);
 assert.equal(validateNewInspections([{...entry,faces:[{...face,designNotes:''}]}])[0].faces[0].designNotes,'');
 for(const designNotes of [null,42,'x'.repeat(20001)])assert.throws(()=>validateNewInspections([{...entry,faces:[{...face,designNotes}]}]),/Face design notes/);
});
