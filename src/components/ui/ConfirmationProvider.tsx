import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmationContext } from "./confirmationContext";
import { Modal } from "./Modal";
import { Button } from "./Button";
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string>();
  const resolver = useRef<((confirmed: boolean) => void) | undefined>(undefined);
  const confirm = useCallback((nextMessage: string) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setMessage(nextMessage);
  }), []);
  const finish = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = undefined;
    setMessage(undefined);
  };
  useEffect(() => () => resolver.current?.(false), []);
  return <ConfirmationContext.Provider value={confirm}>
    {children}
    {message ? <Modal className="ui-confirmation" label="Confirm change" onClose={() => finish(false)}>
      <h2>Confirm change</h2><p>{message}</p>
      <div className="ui-actions"><Button variant="secondary" autoFocus onClick={() => finish(false)}>Cancel</Button><Button variant="danger" onClick={() => finish(true)}>Confirm</Button></div>
    </Modal> : null}
  </ConfirmationContext.Provider>;
}
