import { useCallback, useEffect, useId, useLayoutEffect, useState, type Dispatch, type SetStateAction } from "react";

type DraftGuard = { isDirty: () => boolean; discard: () => void };
const drafts = new Map<string, DraftGuard>();

export function confirmDiscardChanges() {
  const pending = [...drafts.values()].filter(draft => draft.isDirty());
  if (!pending.length) return true;
  if (!window.confirm("Discard unsaved changes? Choose Cancel to keep editing.")) return false;
  for (const draft of pending) draft.discard();
  return true;
}

/** Functional updates edit a draft; a replacement loads or accepts a saved record. */
export function useDraftState<T>(initial: T | (() => T), onDiscard?: () => void): [T, Dispatch<SetStateAction<T>>] {
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
  // Register committed values before navigation can occur, but serialize only
  // when navigation/unload actually asks whether they differ from the baseline.
  useLayoutEffect(() => {
    drafts.set(id, {
      isDirty: () => state.value !== state.baseline && JSON.stringify(state.value) !== JSON.stringify(state.baseline),
      discard: () => {
        onDiscard?.();
        // Remove immediately so a second check in the same event does not prompt again.
        drafts.delete(id);
        setState(current => ({ ...current, value: current.baseline }));
      },
    });
    return () => { drafts.delete(id); };
  }, [id, state, onDiscard]);
  return [state.value, setDraft];
}

export function useDraftNavigationGuard() {
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (![...drafts.values()].some(draft => draft.isDirty())) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      // Resetting inspection display preferences does not discard or replace a draft.
      if (button?.matches(".inspection-editor .inspection-display-preferences-reset")) return;
      if (!button || button.closest(".ui-confirmation, .media-gallery-modal, .overview-photo-dialog, .reports-panel")) return;
      const navigation = button.closest(".result-card, .detail-tabs, .admin-nav, [data-discard-draft]") ||
        /^(Cancel|Close|New |Add new|Reset)/i.test(button.getAttribute("aria-label") || button.textContent?.trim() || "");
      if (navigation && !confirmDiscardChanges()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); };
  }, []);
}
