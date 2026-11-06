import type { Burial, Headstone, HeadstoneLookups, LookupOption, SaveBurialInput, SaveHeadstoneInput, SaveHeadstoneGravesiteRelationshipInput } from "../types";

export type FieldSnapshot = { cemeteryId:string; cemeteryName:string; headstone:Headstone; burials:Burial[]; lookups:HeadstoneLookups; nearbyGraves:LookupOption[]; downloadedAt:string };
export type FieldState = "pending" | "sending" | "failed" | "conflict" | "synced" | "discarded";
export type FieldOperation = { id:string; cemeteryId:string; targetId:string; kind:"marker"|"burial"|"inspection"|"link"; payload:SaveBurialInput|SaveHeadstoneInput|SaveHeadstoneGravesiteRelationshipInput; base?:SaveBurialInput|SaveHeadstoneInput; state:FieldState; attempted:boolean; error?:string; errorStatus?:number };
export type FieldPhoto = { id:string; markerId:string; cemeteryId:string; filename:string; contentType:string; size:number; notes:string; capturedAt:string; inspectionId?:string; faceId?:string; latitude?:number; longitude?:number; gpsAccuracy?:number; state:FieldState; attempted:boolean; error?:string };
export type OfflineWorkspace = { format:1; id:string; ownerSubject:string; ownerLabel?:string; preparedRole?:"reader"|"power-user"|"cemetery-admin"|"admin"; cemeteryId:string; cemeteryName:string; records:FieldSnapshot[]; operations:FieldOperation[]; photos:FieldPhoto[]; savedAt:string };

export function isOfflineWorkspace(value:unknown):value is OfflineWorkspace {
  if(!value||typeof value!=="object")return false;
  const d=value as Partial<OfflineWorkspace>;
  return d.format===1&&typeof d.id==="string"&&typeof d.ownerSubject==="string"&&typeof d.cemeteryId==="string"&&typeof d.cemeteryName==="string"
    &&Array.isArray(d.records)&&d.records.length<=50&&d.records.every(r=>r&&r.cemeteryId===d.cemeteryId&&typeof r.headstone?.id==="string"&&Array.isArray(r.burials)&&r.lookups&&Array.isArray(r.nearbyGraves))
    &&Array.isArray(d.operations)&&d.operations.length<=1000&&d.operations.every(o=>o&&typeof o.id==="string"&&o.cemeteryId===d.cemeteryId&&["marker","burial","inspection","link"].includes(o.kind)&&o.payload&&["pending","sending","failed","conflict","synced","discarded"].includes(o.state))
    &&Array.isArray(d.photos)&&d.photos.length<=500&&d.photos.every(p=>p&&typeof p.id==="string"&&typeof p.filename==="string"&&p.cemeteryId===d.cemeteryId&&["pending","sending","failed","conflict","synced","discarded"].includes(p.state));
}
