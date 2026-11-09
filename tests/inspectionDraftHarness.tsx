import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SessionContext } from "../src/auth/sessionContext";
import { useInspectionDraft } from "../src/components/detail/useInspectionDraft";

function Editor({ marker }: { marker: string }) {
  const state = useInspectionDraft(marker);
  useEffect(() => { document.documentElement.dataset.inspectionDraft = state.draft?.source ?? ""; }, [state.draft]);
  return <>
    <button onClick={() => state.setDraft(() => ({ id: "visit", inspectedAt: "2026-11-09", sourceType: "field_survey", source: "Initial source", conditionId: "unknown", conditionNotes: "", inscription: "Reading", faces: [{ id: "front", label: "Front", inscription: "Reading" }] }))}>Begin</button>
    <input aria-label="Source" value={state.draft?.source ?? ""} onChange={event => state.setDraft(current => current && { ...current, source: event.target.value })} />
    <button onClick={() => { state.setStep(1); state.setActiveFaceId("front"); state.setUpdating(true); }}>Face step</button>
    <button onClick={() => state.setDraft(current => current && { ...current, photos: [{ id: "photo", faceId: "front", notes: "Photo notes", capturedAt: "", file: new File(["image"], "draft.png", { type: "image/png" }) }] })}>Photo</button>
    <button onClick={() => state.setDraft(current => current && { ...current, recordSaved: true })}>Record saved</button>
    <button onClick={() => { state.clearRecovery(); state.setDraft(null); }}>Finish or discard</button>
    <button onClick={() => { if (state.recovery) { state.setDraft(() => state.recovery!.draft); state.setStep(state.recovery.step); state.setActiveFaceId(state.recovery.activeFaceId); state.setUpdating(state.recovery.updating); state.setRecovery(null); } }}>Resume</button>
    <output data-testid="draft">{JSON.stringify({ draft: state.draft, recovery: state.recovery, unavailable: state.recoveryUnavailable, step: state.step, face: state.activeFaceId, updating: state.updating })}</output>
  </>;
}

export function Harness() {
  const [account, setAccount] = useState("one");
  const [marker, setMarker] = useState("marker-one");
  const [mounted, setMounted] = useState(true);
  return <SessionContext value={{ accountId: account, identity: account, signOut: () => {} }}>
    <button onClick={() => setMounted(value => !value)}>Toggle editor</button>
    <button onClick={() => setMarker(value => value === "marker-one" ? "marker-two" : "marker-one")}>Switch marker</button>
    <button onClick={() => setAccount(value => value === "one" ? "two" : "one")}>Switch account</button>
    {mounted && <Editor key={`${account}/${marker}`} marker={marker} />}
  </SessionContext>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
