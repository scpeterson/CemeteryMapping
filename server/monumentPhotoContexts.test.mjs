import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePhotoContext,validatePhotoContextTarget} from './monumentPhotoContexts.mjs';
import {validateMediaUploadMetadata} from './routes/mediaRouteValidation.mjs';
const id='11111111-1111-4111-8111-111111111111';
test('photo context requires exactly one record, a valid UUID, and a known phase',()=>{
 for(const value of [{},{inspectionId:id,maintenanceRecordId:id},{inspectionId:'no'},{inspectionId:id,phase:'later'}]) assert.throws(()=>validatePhotoContext(value));
 assert.equal(validatePhotoContext({inspectionId:id}).phase,'unspecified');
 assert.equal(validatePhotoContext({maintenanceRecordId:id,phase:'after'}).phase,'after');
 assert.equal(validateMediaUploadMetadata({inspectionId:id}).inspectionId,id);
 assert.throws(()=>validateMediaUploadMetadata({inspectionId:id,maintenanceRecordId:id}));
});
test('inspection photo uploads enforce admin role and reject foreign or missing records before writing files',async()=>{
 const client={query:async()=>({rows:[]})};
 await assert.rejects(validatePhotoContextTarget(client,id,{inspectionId:id},{role:'power-user'}),{statusCode:403});
 await assert.rejects(validatePhotoContextTarget(client,id,{inspectionId:id},{role:'admin'}),/does not belong/);
 await assert.rejects(validatePhotoContextTarget(client,id,{maintenanceRecordId:id},{role:'admin'}),/does not belong/);
 await assert.doesNotReject(validatePhotoContextTarget({query:async()=>({rows:[{id}]})},id,{maintenanceRecordId:id},{role:'power-user'}));
});

test('photo face labels belong to the selected inspection snapshot or maintenance monument',async()=>{
 const faceId='22222222-2222-4222-8222-222222222222';
 const client={query:async()=>({rows:[{id,faces:[{id:faceId,label:'Back'}]}]})};
 for(const target of [{inspectionId:id},{maintenanceRecordId:id}]){
  await assert.doesNotReject(validatePhotoContextTarget(client,id,{...target,faceId},{role:'admin'}));
  await assert.rejects(validatePhotoContextTarget(client,id,{...target,faceId:id},{role:'admin'}),/face does not belong/);
 }
 assert.equal(validateMediaUploadMetadata({inspectionId:id,faceId}).faceId,faceId);
 assert.throws(()=>validatePhotoContext({inspectionId:id,faceId:'invalid'}));
});
