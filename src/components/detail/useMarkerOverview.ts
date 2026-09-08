import { useEffect, useState } from "react";
import { fetchGraveSpace } from "../../api/cemeteryApi";
import type { GraveSpace, GraveSpaceSummary } from "../../types";

type LinkedGrave = { summary: GraveSpaceSummary; detail?: GraveSpace; failed?: boolean };

export function useMarkerOverview(graves: GraveSpaceSummary[]) {
  const [result, setResult] = useState<{ source: GraveSpaceSummary[]; records: LinkedGrave[] }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let next = 0;
    const records: LinkedGrave[] = new Array(graves.length);
    const worker = async () => {
      while (active && next < graves.length) {
        const index = next++;
        const summary = graves[index];
        try {
          records[index] = { summary, detail: await fetchGraveSpace(summary.cemeteryId, summary.id) };
        } catch {
          records[index] = { summary, failed: true };
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, graves.length) }, worker)).then(() => {
      if (active) setResult({ source: graves, records });
    });
    return () => { active = false; };
  }, [graves, attempt]);
  return {
    records: result?.source === graves ? result.records : [],
    loading: result?.source !== graves,
    retry: () => { setResult(undefined); setAttempt((value) => value + 1); },
  };
}
