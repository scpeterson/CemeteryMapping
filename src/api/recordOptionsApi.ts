import { apiBaseUrl } from "../config/environment";
import { authorizedFetch, jsonResponse, normalizeBaseUrl } from "./apiClient";
import type { LookupOption } from "../types";

export type RecordOptionKind = "headstones" | "gravesites" | "field-markers" | "task-gravesites";

export const recordOptionsPageSize = 50;

type RecordOptionsRequest = {
  kind: RecordOptionKind;
  q: string;
  offset: number;
  excludeId?: string;
  cemeteryId?: string;
};

export async function fetchRecordOptions(
  { kind, q, offset, excludeId, cemeteryId }: RecordOptionsRequest,
  signal?: AbortSignal,
): Promise<LookupOption[]> {
  const params = new URLSearchParams({ kind, q, offset: String(offset), limit: String(recordOptionsPageSize + 1) });
  if (excludeId) params.set("excludeId", excludeId);
  if (cemeteryId) params.set("cemeteryId", cemeteryId);
  const endpoint = kind === "field-markers" || kind === "task-gravesites" ? kind : "record-options";
  return jsonResponse<LookupOption[]>(
    await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/${endpoint}?${params}`, { signal }),
    "Record options API",
  );
}
