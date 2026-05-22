import { apiBaseUrl } from "../config/environment";
import type { CemeteryData, GraveSpace, GraveStatus, SearchMatch } from "../types";

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
  if (!response.ok) throw new Error(`Grave API returned ${response.status}`);
  return (await response.json()) as GraveSpace;
}

export async function fetchSearchMatches(query: string, statuses: Set<GraveStatus>): Promise<SearchMatch[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query);
  params.set("status", [...statuses].join(","));

  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/search?${params.toString()}`);
  if (!response.ok) throw new Error(`Search API returned ${response.status}`);
  return (await response.json()) as SearchMatch[];
}
