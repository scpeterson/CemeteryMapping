import { confirmDiscardChanges } from "../../hooks/useDraftState";
import { useEffect, useRef, type ReactNode } from "react";

/** Native modal dialogs provide focus containment and make background content inert. */
export function Modal({ children, className = "", label, onClose, protectDrafts = false }: {
  children: ReactNode;
  protectDrafts?: boolean;
  className?: string;
  label: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return <dialog ref={ref} className={`ui-modal ${className}`} aria-label={label}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter((element) => element.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); if (!protectDrafts || confirmDiscardChanges()) onClose(); }}>
    {children}
  </dialog>;
}
