import {apiBaseUrl} from "../config/environment";
import {authorizedFetch,jsonRequest,jsonResponse,normalizeBaseUrl} from "./apiClient";
export type PolicyScope={cemeteryId:string|null;sectionId:string|null;blockId:string|null};
export type PolicyRow={cemetery_id:string|null;section_uuid:string|null;block_uuid:string|null;rule_key:string;enabled:boolean;reason:string};
export type PolicyChange=PolicyScope&{rule:string;value:boolean|null;reason:string;revision:string};
export type PolicySnapshot={historyCursor:string|null;revision:string;catalog:{key:string;label:string}[];cemeteries:{id:string;name:string}[];sections:{id:string;cemeteryId:string;name:string}[];blocks:{id:string;cemeteryId:string;sectionId:string;name:string}[];policies:PolicyRow[];history:{id:string;created_at:string;actor_email:string;scope_label:string;cemetery_id:string|null;section_uuid:string|null;block_uuid:string|null;rule_key:string;before_value:PolicyRow|null;after_value:PolicyRow|null;reason:string}[]};
export type PolicyPreview={previewToken:string;impact:{graves:number;markers:number;burials:number}};
export async function fetchPolicies(before?:string):Promise<PolicySnapshot>{return jsonResponse(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/policies${before?`?before=${encodeURIComponent(before)}`:""}`),'Policies');}
export async function postPolicy(action:'preview'|'save',change:PolicyChange,previewToken?:string):Promise<PolicyPreview>{return jsonResponse(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/policies/${action}`,jsonRequest('POST',{...change,...(previewToken?{previewToken}:{})})),'Policies');}
