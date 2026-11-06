import {apiBaseUrl} from '../config/environment';
import {authorizedFetch,jsonRequest,jsonResponse,normalizeBaseUrl} from './apiClient';
export type ImportReview={recordCount:number;errorCount:number;rows:{row:number;errors:string[];warnings:string[];record:{gravesiteId:string;name?:string;burial?:{firstName:string;lastName:string}}|null}[]};
export type ImportBatch={id:string;cemeteryId:string;kind:'gravesites'|'burials';sourceName:string;sourceSha256:string;status:'staged'|'approved'|'rejected';review:ImportReview;version:string;createdAt:string;createdRecords?:{id:string;gravesiteId:string}[]};
const url=(cemeteryId:string)=>`${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/import-batches`;
export async function listImports(cemeteryId:string,offset=0){return jsonResponse<ImportBatch[]>(await authorizedFetch(`${url(cemeteryId)}?limit=51&offset=${offset}`),'Import queue API');}
export async function stageImport(cemeteryId:string,input:{kind:string;sourceName:string;sourceText:string}){return jsonResponse<ImportBatch>(await authorizedFetch(url(cemeteryId),jsonRequest('POST',input)),'Stage import API');}
export async function decideImport(batch:ImportBatch,decision:'approve'|'reject',reason:string){return jsonResponse<ImportBatch>(await authorizedFetch(`${url(batch.cemeteryId)}/${batch.id}/decision`,jsonRequest('POST',{expectedVersion:batch.version,decision,reason})),'Import approval API');}
export async function createOnboardingCemetery(input:{name:string;municipality:string;geometry:unknown;reason:string}){return jsonResponse<{id:string;name:string}>(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/onboarding/cemeteries`,jsonRequest('POST',input)),'Cemetery setup API');}
export async function downloadImportSource(batch:ImportBatch){const response=await authorizedFetch(`${url(batch.cemeteryId)}/${batch.id}/source`);if(!response.ok)await jsonResponse(response,'Import source API');const blob=await response.blob();const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=batch.sourceName;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}

export async function getImport(batch:ImportBatch){return jsonResponse<ImportBatch>(await authorizedFetch(`${url(batch.cemeteryId)}/${batch.id}`),'Import review API');}
