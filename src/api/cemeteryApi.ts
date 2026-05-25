import { apiBaseUrl } from "../config/environment";
import type { AppRole, AppUser, CemeteryData, CurrentUser, GraveSpace, GraveStatus, SearchMatch } from "../types";

type AccessTokenProvider = () => Promise<string | undefined>;

let accessTokenProvider: AccessTokenProvider | undefined;

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/u, "");

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export function setAccessTokenProvider(provider: AccessTokenProvider | undefined) {
  accessTokenProvider = provider;
}

async function authorizedFetch(url: string, init?: RequestInit) {
  const token = await accessTokenProvider?.();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

async function jsonResponse<T>(response: Response, label: string): Promise<T> {
  if (!response.ok) throw new Error(`${label} returned ${response.status}`);
  return (await response.json()) as T;
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function fetchCemeteryData(attempts = 5): Promise<CemeteryData> {
  const url = `${normalizeBaseUrl(apiBaseUrl)}/cemetery-map`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await authorizedFetch(url);
      if (!response.ok) throw new Error(`Cemetery API returned ${response.status}`);
      return (await response.json()) as CemeteryData;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(200 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to load cemetery data");
}

export async function fetchGraveSpace(cemeteryId: string, id: string): Promise<GraveSpace> {
  const response = await authorizedFetch(
    `${normalizeBaseUrl(apiBaseUrl)}/cemeteries/${encodeURIComponent(cemeteryId)}/grave-spaces/${encodeURIComponent(id)}`,
  );
  return jsonResponse<GraveSpace>(response, "Grave API");
}

export async function fetchSearchMatches(query: string, statuses: Set<GraveStatus>): Promise<SearchMatch[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query);
  params.set("status", [...statuses].join(","));

  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/search?${params.toString()}`);
  return jsonResponse<SearchMatch[]>(response, "Search API");
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/me`);
  return jsonResponse<CurrentUser>(response, "Current user API");
}

export async function fetchAdminRoles(): Promise<AppRole[]> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/roles`);
  return jsonResponse<AppRole[]>(response, "Roles API");
}

export async function fetchAdminUsers(): Promise<AppUser[]> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/users`);
  return jsonResponse<AppUser[]>(response, "Users API");
}

export type SaveUserInput = Pick<AppUser, "email" | "externalSubject" | "displayName" | "role" | "isActive">;

export async function createAdminUser(user: SaveUserInput): Promise<AppUser> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/users`, jsonRequest("POST", user));
  return jsonResponse<AppUser>(response, "Create user API");
}

export async function updateAdminUser(id: string, user: SaveUserInput): Promise<AppUser> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/admin/users/${encodeURIComponent(id)}`, jsonRequest("PUT", user));
  return jsonResponse<AppUser>(response, "Update user API");
}
