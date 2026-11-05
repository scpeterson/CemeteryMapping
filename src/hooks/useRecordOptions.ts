import { useEffect, useState } from "react";
import { apiBaseUrl } from "../config/environment";
import { authorizedFetch, jsonResponse, normalizeBaseUrl } from "../api/apiClient";
import type { LookupOption } from "../types";

export function useRecordOptions(kind: "headstones" | "gravesites", legacy: LookupOption[], enabled: boolean, initial?: LookupOption, excludeId?: string) {
  const useLegacy = legacy.length > 0;
  const [query, changeQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<LookupOption[]>([]);
  const [selected, setSelected] = useState<LookupOption | undefined>(initial);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(enabled && !useLegacy);
  const [error, setError] = useState("");
  const pageSize = 50;
  useEffect(() => { const timer = setTimeout(() => setSearch(query),200); return () => clearTimeout(timer); },[query]);
  useEffect(() => {
    if (!enabled || useLegacy) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ kind,q:search,offset:String(offset),limit:String(pageSize+1) });
    if (excludeId) params.set("excludeId",excludeId);
    setLoading(true);setError("");
    authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/record-options?${params}`,{signal:controller.signal})
      .then(r => jsonResponse<LookupOption[]>(r,"Record options API"))
      .then(items => { if (!controller.signal.aborted) { setRows(items.slice(0,pageSize));setHasMore(items.length>pageSize); } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load record options."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  },[kind,search,offset,enabled,useLegacy,excludeId]);
  const filtered = legacy.filter(row => `${row.code} ${row.label}`.toLowerCase().includes(search.toLowerCase()));
  const page = useLegacy ? filtered.slice(offset,offset+pageSize) : rows;
  const options = selected && !page.some(row => row.id===selected.id) ? [selected,...page] : page;
  return { options,matchCount:page.length,query,loading,error,offset,pageSize,hasMore:useLegacy ? filtered.length>offset+pageSize : hasMore,
    setOffset, setQuery:(value:string)=>{changeQuery(value);setOffset(0);},
    remember:(id:string)=>setSelected(options.find(row=>row.id===id)),
  };
}
