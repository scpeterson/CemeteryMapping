import { useEffect, useState } from "react";
import { fetchRecordOptions, recordOptionsPageSize as pageSize, type RecordOptionKind } from "../api/recordOptionsApi";
import type { LookupOption } from "../types";

export function useRecordOptions(
  kind: RecordOptionKind,
  legacy: LookupOption[],
  enabled: boolean,
  initial?: LookupOption,
  excludeId?: string,
  cemeteryId?: string,
) {
  const useLegacy = legacy.length > 0;
  const [query, changeQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [remoteRows, setRemoteRows] = useState<LookupOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<LookupOption | undefined>(initial);
  const [loading, setLoading] = useState(enabled && !useLegacy);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!enabled || useLegacy) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    // Fetch one extra row to detect the next page without a separate count request.
    fetchRecordOptions({ kind, q: search, offset, excludeId, cemeteryId }, controller.signal)
      .then(items => {
        if (controller.signal.aborted) return;
        setRemoteRows(items);
      })
      .catch(error => {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Unable to load record options.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, search, offset, enabled, useLegacy, excludeId, cemeteryId]);

  const filtered = legacy.filter(row => `${row.code} ${row.label}`.toLowerCase().includes(search.toLowerCase()));
  const page = useLegacy ? filtered.slice(offset, offset + pageSize) : remoteRows.slice(0, pageSize);
  // A remembered selection remains available even when it is outside the current page.
  const options = selectedOption && !page.some(row => row.id === selectedOption.id) ? [selectedOption, ...page] : page;

  return {
    options, matchCount: page.length, query, loading, error, offset, pageSize,
    hasMore: (useLegacy ? filtered.length - offset : remoteRows.length) > pageSize,
    setOffset,
    setQuery: (value: string) => { changeQuery(value); setOffset(0); },
    remember: (id: string) => setSelectedOption(options.find(row => row.id === id)),
  };
}
