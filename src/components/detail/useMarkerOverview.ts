import { useEffect, useState } from "react";
import { fetchHeadstoneOverview } from "../../api/cemeteryApi";
import { graveSelectionKey } from "../../lib/format";
import type { GraveOverviewSummary, GraveSpaceSummary } from "../../types";

type LinkedGrave = { summary: GraveSpaceSummary; detail?: GraveOverviewSummary; failed?: boolean };

export function useMarkerOverview(markerId: string, graves: GraveSpaceSummary[]) {
  const [result, setResult] = useState<{ markerId: string; source: GraveSpaceSummary[]; records: LinkedGrave[] }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!graves.length) return () => controller.abort();
    void fetchHeadstoneOverview(markerId, controller.signal).then((details) => {
      if (controller.signal.aborted) return;
      const byKey = new Map(details.map((detail) => [graveSelectionKey(detail), detail]));
      setResult({ markerId, source: graves, records: graves.map((summary) => {
        const detail = byKey.get(graveSelectionKey(summary));
        return { summary, detail, failed: !detail };
      }) });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ markerId, source: graves, records: graves.map((summary) => ({ summary, failed: true })) });
    });
    return () => controller.abort();
  }, [markerId, graves, attempt]);
  const current = result?.markerId === markerId && result.source === graves;
  return {
    records: current ? result.records : [],
    loading: graves.length > 0 && !current,
    retry: () => { setResult(undefined); setAttempt((value) => value + 1); },
  };
}
