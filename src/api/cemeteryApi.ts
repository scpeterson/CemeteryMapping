import { apiBaseUrl } from "../config/environment";
import type { CemeteryData, GraveSpace, GraveStatus, SearchMatch } from "../types";

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/u, "");

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

export async function fetchCemeteryData(attempts = 5): Promise<CemeteryData> {
  const url = `${normalizeBaseUrl(apiBaseUrl)}/cemetery-map`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Cemetery API returned ${response.status}`);
      return (await response.json()) as CemeteryData;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(200 * attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to load cemetery data");
}

export async function fetchGraveSpace(id: string): Promise<GraveSpace> {
  const response = await fetch(`${normalizeBaseUrl(apiBaseUrl)}/grave-spaces/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`Grave API returned ${response.status}`);
  return (await response.json()) as GraveSpace;
}

export async function fetchSearchMatches(query: string, statuses: Set<GraveStatus>): Promise<SearchMatch[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query);
  params.set("status", [...statuses].join(","));

  const response = await fetch(`${normalizeBaseUrl(apiBaseUrl)}/search?${params.toString()}`);
  if (!response.ok) throw new Error(`Search API returned ${response.status}`);
  return (await response.json()) as SearchMatch[];
}
