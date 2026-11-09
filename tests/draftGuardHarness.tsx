import { useEffect, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { confirmDiscardChanges, useDraftNavigationGuard, useDraftState } from "../src/hooks/useDraftState";

const params = new URLSearchParams(location.search);
const faceCount = Number(params.get("faces") ?? 1);
const textLength = Number(params.get("text") ?? 1000);
const initial = { profileDraft: true, source: "Initial source", faces: Array.from({ length: faceCount }, (_, index) => ({ id: String(index), inscription: "R".repeat(textLength), designNotes: "D".repeat(textLength) })) };

declare global {
  interface Window {
    guardProfile: { serializations: number[]; commits: number[]; started?: number };
  }
}
window.guardProfile = { serializations: [], commits: [] };
const stringify = JSON.stringify;
JSON.stringify = function (...args: Parameters<typeof stringify>) {
  const start = performance.now();
  const result = stringify(...args);
  if (args[0]?.profileDraft) window.guardProfile.serializations.push(performance.now() - start);
  return result;
} as typeof stringify;

function Form({ name }: { name: string }) {
  const [discards, setDiscards] = useState(0);
  const emptyBaseline = params.get("baseline") === "null";
  const [draft, setDraft] = useDraftState<typeof initial | null>(emptyBaseline ? null : initial, () => setDiscards(value => value + 1));
  useEffect(() => { if (emptyBaseline) setDraft(() => initial); }, [emptyBaseline, setDraft]);
  const [renders, setRenders] = useState(0);
  useLayoutEffect(() => {
    if (window.guardProfile.started !== undefined) {
      window.guardProfile.commits.push(performance.now() - window.guardProfile.started);
      window.guardProfile.started = undefined;
    }
  });
  return <section aria-label={name}>
    <input aria-label={`${name} source`} value={draft?.source ?? ""} onChange={event => {
      window.guardProfile.started = performance.now();
      setDraft(current => current && ({ ...current, source: event.target.value }));
    }} />
    <span>{draft?.source}</span><output aria-label={`${name} discards`}>{discards}</output>
    <button onClick={() => setDraft(initial)}>Load baseline {name}</button>
    <button onClick={() => { if (draft) setDraft({ ...draft }); }}>Accept save {name}</button>
    <button onClick={() => setDraft(current => current && ({ ...current, source: "Initial source" }))}>Revert {name}</button>
    <button onClick={() => setDraft(current => current && ({ ...current }))}>Equal copy {name}</button>
    <button onClick={() => setRenders(value => value + 1)}>Rerender {name} {renders}</button>
  </section>;
}

export function Harness() {
  useDraftNavigationGuard();
  const [mounted, setMounted] = useState(true);
  const [navigation, setNavigation] = useState(0);
  return <>
    {mounted && <><Form name="First" /><Form name="Second" /></>}
    <button onClick={() => { if (confirmDiscardChanges()) setNavigation(value => value + 1); }}>Navigate</button>
    <button onClick={() => { const a = confirmDiscardChanges(); const b = a && confirmDiscardChanges(); if (b) setNavigation(value => value + 1); }}>Navigate twice</button>
    <button onClick={() => setMounted(false)}>Unmount forms</button>
    <output aria-label="Navigation count">{navigation}</output>
  </>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
