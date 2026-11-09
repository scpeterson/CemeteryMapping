import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useRecordOptions } from "../src/hooks/useRecordOptions";
import type { RecordOptionKind } from "../src/api/recordOptionsApi";
import { RecordOptionSearch } from "../src/components/detail/RecordOptionSearch";
import type { LookupOption } from "../src/types";

export function Harness() {
  const [enabled, setEnabled] = useState(false);
  const [legacy, setLegacy] = useState<LookupOption[]>([]);
  const [kind, setKind] = useState<RecordOptionKind>("headstones");
  const [cemetery, setCemetery] = useState("cemetery/one");
  const records = useRecordOptions(kind, legacy, enabled, { id: "initial", code: "OLD", label: "Initial selection" }, "self/marker", cemetery);
  useEffect(() => { document.documentElement.dataset.recordOptionsQuery = records.query; }, [records.query]);
  return <>
    <button onClick={() => setEnabled(current => !current)}>Toggle enabled</button>
    <button onClick={() => setLegacy(Array.from({ length: 55 }, (_, i) => ({ id: `local-${i}`, code: `Local-${i}`, label: `Local option ${i}` })))}>Legacy</button>
    <button onClick={() => setCemetery("cemetery/two")}>Other cemetery</button>
    <select aria-label="Kind" value={kind} onChange={event => setKind(event.target.value as RecordOptionKind)}>
      {["headstones", "gravesites", "field-markers", "task-gravesites"].map(value => <option key={value}>{value}</option>)}
    </select>
    <RecordOptionSearch records={records} label="Search options" />
    <select aria-label="Remember option" onChange={event => records.remember(event.target.value)}>
      {records.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <output data-testid="state">{JSON.stringify({ ids: records.options.map(option => option.id), count: records.matchCount, loading: records.loading, offset: records.offset, hasMore: records.hasMore, error: records.error })}</output>
  </>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
