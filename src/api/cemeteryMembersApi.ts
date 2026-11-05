import { apiBaseUrl } from "../config/environment";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

export type CemeteryMember = { id: string; email: string; displayName: string; role: "reader" | "power-user" | "cemetery-admin"; isActive: boolean; version: string };
export type MembershipInput = { role: CemeteryMember["role"]; reason: string; email?: string; displayName?: string; expectedVersion?: string };
const endpoint = (cemeteryId: string) => `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/members`;
export async function fetchCemeteryMembers(cemeteryId: string, query: string, offset: number): Promise<CemeteryMember[]> {
  return jsonResponse(await authorizedFetch(`${endpoint(cemeteryId)}?${new URLSearchParams({ q:query,offset:String(offset),limit:"51" })}`),"Cemetery members");
}
export async function saveCemeteryMember(cemeteryId: string, input: MembershipInput, userId?: string, remove = false): Promise<{ invitationSent?: boolean }> {
  return jsonResponse(await authorizedFetch(`${endpoint(cemeteryId)}${userId ? `/${encodeURIComponent(userId)}` : ""}`,jsonRequest(remove ? "DELETE" : userId ? "PUT" : "POST",input)),"Cemetery membership");
}
