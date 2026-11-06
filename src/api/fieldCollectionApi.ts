import { apiBaseUrl } from "../config/environment";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";
import type { FieldOperation, FieldSnapshot } from "../lib/offlineFieldTypes";
export type FieldCemetery = {id:string;name:string};
const base=()=>normalizeBaseUrl(apiBaseUrl);
export async function fetchFieldCemeteries(q=""):Promise<FieldCemetery[]>{
  return jsonResponse(await authorizedFetch(`${base()}/field-cemeteries?${new URLSearchParams({q})}`),"Field cemeteries");
}
export async function fetchFieldSnapshot(cemeteryId:string,markerId:string):Promise<FieldSnapshot>{
  return jsonResponse(await authorizedFetch(`${base()}/cemeteries/${encodeURIComponent(cemeteryId)}/field-snapshot/${encodeURIComponent(markerId)}`),"Field snapshot");
}
export async function synchronizeFieldAction(operation:FieldOperation):Promise<{id:string;version:string|null;received:boolean;replayed:boolean}>{
  const {id,kind,cemeteryId,targetId,payload}=operation;
  return jsonResponse(await authorizedFetch(`${base()}/field-sync`,jsonRequest("POST",{id,kind,cemeteryId,targetId,payload})),"Field synchronization");
}
