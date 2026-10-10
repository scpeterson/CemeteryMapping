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

export type AccessRequestStats = { pending: number; lastHour: number; limits: { pending: number; hourly: number } };
export async function fetchAccessRequestStats() {
  return jsonResponse<AccessRequestStats>(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/access-request-stats`), "Access request capacity");
}
