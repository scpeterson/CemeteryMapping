import { useCallback, useEffect, useId, useState, type Dispatch, type SetStateAction } from "react";

const drafts = new Map<string, () => void>();

export function confirmDiscardChanges() {
  if (!drafts.size) return true;
  if (!window.confirm("Discard unsaved changes? Choose Cancel to keep editing.")) return false;
  for (const discard of drafts.values()) discard();
  drafts.clear();
  return true;
}

/** Functional updates edit a draft; a replacement loads or accepts a saved record. */
export function useDraftState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const id = useId();
  const [state, setState] = useState(() => {
    const value = initial instanceof Function ? initial() : initial;
    return { value, baseline: value };
  });
  const setDraft: Dispatch<SetStateAction<T>> = useCallback((next) => {
    setState((current) => next instanceof Function
      ? { ...current, value: next(current.value) }
      : { value: next, baseline: next });
  }, []);
  useEffect(() => {
    if (JSON.stringify(state.value) !== JSON.stringify(state.baseline)) {
      drafts.set(id, () => setState((current) => ({ ...current, value: current.baseline })));
    } else drafts.delete(id);
    return () => { drafts.delete(id); };
  }, [id, state]);
  return [state.value, setDraft];
}

export function useDraftNavigationGuard() {
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (!drafts.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button) return;
      const navigation = button.closest(".result-card, .detail-tabs, .admin-nav, [data-discard-draft]") ||
        /^(Cancel|Close|New |Add new|Reset)/i.test(button.getAttribute("aria-label") || button.textContent?.trim() || "");
      if (navigation && !confirmDiscardChanges()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, []);
}
