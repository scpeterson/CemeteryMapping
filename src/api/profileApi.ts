import { apiBaseUrl } from "../config/environment";
import type { UserProfile, UserActivity } from "../types/administration";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";
export async function fetchProfile(): Promise<UserProfile | null> {
  return jsonResponse(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/me/profile`), "Profile API");
}
export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  return jsonResponse(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/me/profile`, jsonRequest("PUT", { ...profile, expectedVersion:profile.version })), "Profile API");
}
export async function fetchUserActivity(id: string): Promise<UserActivity[]> {
  return jsonResponse(await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/users/${encodeURIComponent(id)}/activity`), "User activity API");
}
