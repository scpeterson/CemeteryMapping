import { apiBaseUrl } from "../config/environment";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";
export type AccessRequest = { id: string; email: string; displayName: string; cemeteryInterest: string; reason: string; createdAt: string; status: string };
const base = `${normalizeBaseUrl(apiBaseUrl)}/admin/access-requests`;
export async function fetchAccessRequests() {
  return jsonResponse<AccessRequest[]>(await authorizedFetch(base), "Access requests");
}
export async function rejectAccessRequest(id: string) {
  return jsonResponse(await authorizedFetch(`${base}/${encodeURIComponent(id)}/reject`, jsonRequest("POST", {})), "Reject request");
}
