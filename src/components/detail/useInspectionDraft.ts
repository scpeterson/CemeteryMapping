import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { useAccountSession } from "../../auth/sessionContext";
import { useDraftState } from "../../hooks/useDraftState";
import { readInspectionRecovery, storeInspectionRecovery, type InspectionDraft, type InspectionRecovery } from "../../lib/inspectionDraftRecovery";

// The editor is keyed by account and marker so recovery is initialized for each selection.
export function useInspectionDraft(headstoneId: string) {
  const account = useAccountSession();
  const recoveryKey = `cemetery-mapping:inspection-draft:v1:${encodeURIComponent(account?.accountId ?? account?.identity ?? "local")}:${headstoneId}`;
  const [recovery, setRecovery] = useState(() => readInspectionRecovery(recoveryKey));
  const [recoveryUnavailable, setRecoveryUnavailable] = useState(false);
  const pendingRef = useRef<Omit<InspectionRecovery, "version" | "savedAt"> | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clearRecovery = () => {
    // Discard/save must also cancel the delayed write so it cannot restore a cleared draft.
    clearTimeout(timerRef.current);
    pendingRef.current = undefined;
    try { localStorage.removeItem(recoveryKey); } catch { /* Editing remains available. */ }
    setRecovery(null);
  };
  const [draft, setDraft] = useDraftState<InspectionDraft | null>(null, clearRecovery);
  const [updating, setUpdating] = useState(false);
  const [step, setStep] = useState(0);
  const [activeFaceId, setActiveFaceId] = useState<string>();

  const flushRecovery = useEffectEvent(() => {
    clearTimeout(timerRef.current);
    if (!pendingRef.current) return;
    try {
      storeInspectionRecovery(recoveryKey, pendingRef.current);
      pendingRef.current = undefined;
      setRecoveryUnavailable(false);
    } catch { setRecoveryUnavailable(true); }
  });

  // Capture committed edits before a page lifecycle event can request a flush.
  useLayoutEffect(() => {
    clearTimeout(timerRef.current);
    pendingRef.current = draft ? { draft, updating, step, activeFaceId } : undefined;
    if (draft) timerRef.current = setTimeout(flushRecovery, 350);
  }, [recoveryKey, draft, updating, step, activeFaceId]);

  useEffect(() => {
    const hidden = () => { if (document.visibilityState === "hidden") flushRecovery(); };
    window.addEventListener("beforeunload", flushRecovery);
    window.addEventListener("pagehide", flushRecovery);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", flushRecovery);
      window.removeEventListener("pagehide", flushRecovery);
      document.removeEventListener("visibilitychange", hidden);
      flushRecovery();
    };
  }, []);

  return { recovery, setRecovery, recoveryUnavailable, clearRecovery, draft, setDraft,
    updating, setUpdating, step, setStep, activeFaceId, setActiveFaceId };
}
