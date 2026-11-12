import { useState } from "react";
import { useConfirmation } from "../src/components/ui/confirmationContext";
import { Modal } from "../src/components/ui/Modal";
import WhatsNewPanel from "../src/components/WhatsNewPanel";

export function WhatsNewHarness({ version }: { version: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Open release notes fixture</button>
    {open ? <WhatsNewPanel version={version} onClose={() => setOpen(false)} /> : null}
  </>;
}

export function ConfirmationHarness() {
  const confirm = useConfirmation();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState("");
  return <>
    <button onClick={() => setOpen(true)}>Open test editor</button>
    {open ? <Modal label="Test editor" onClose={() => setOpen(false)}>
      <button onClick={async () => setResult(await confirm("Remove this record?") ? "Confirmed" : "Canceled")}>Request removal</button>
      <p>{result}</p>
    </Modal> : null}
  </>;
}
