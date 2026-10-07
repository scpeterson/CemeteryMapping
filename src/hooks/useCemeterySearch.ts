import { useEffect, useState } from "react";
import { fetchSearchPage } from "../api/cemeteryApi";
import type { GraveStatus, SearchMatch } from "../types";

export function useCemeterySearch(query: string, statuses: Set<GraveStatus>, cemeteryScope: string | null) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([query.trim(), [...statuses].sort(), cemeteryScope, attempt]);
  const [page, setPage] = useState({ key: "", offset: 0 });
  const offset = page.key === key ? page.offset : 0;
  const [result, setResult] = useState<{ key: string; matches: SearchMatch[]; hasMore: boolean }>();
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [pending, setPending] = useState<string>();
  const enabled = Boolean(query.trim()) && cemeteryScope !== null;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setPending(key);
    setFailure(undefined);
    const timeout = window.setTimeout(() => {
      void fetchSearchPage(query.trim(), statuses, controller.signal, { cemeteryId: cemeteryScope || undefined, offset })
        .then(({ matches, hasMore }) => {
          if (controller.signal.aborted) return;
          setResult((current) => ({ key, matches: offset && current?.key === key ? [...current.matches, ...matches] : matches, hasMore }));
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailure({ key, message: "Search is unavailable. Showing matches from loaded map data." });
        })
        .finally(() => { if (!controller.signal.aborted) setPending(undefined); });
    }, offset ? 0 : 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [key, offset, enabled, query, statuses, cemeteryScope]);
  const current = result?.key === key ? result : undefined;
  const failed = failure?.key === key;
  return {
    remoteMatches: failed ? undefined : current?.matches,
    searchError: failed ? failure.message : undefined,
    isSearching: enabled && !failed && (pending === key || !current),
    hasMore: Boolean(!failed && current?.hasMore),
    loadMore: () => { if (current?.hasMore && pending !== key) setPage({ key, offset: current.matches.length }); },
    retry: () => setAttempt((value) => value + 1),
  };
}
