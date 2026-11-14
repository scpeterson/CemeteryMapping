import type { LookupRecord } from "../../types";

type Props = {
  record: LookupRecord;
  hasSourceFields: boolean;
  onChange: (patch: Partial<LookupRecord>) => void;
};

export function LookupTextFields({ record, hasSourceFields, onChange }: Props) {
  return <>
    <label className="lookup-label">Label
      <input value={record.label} onChange={event => onChange({ label: event.target.value })} title="Human-readable label shown in forms." />
    </label>
    <label className="lookup-description">Description
      <textarea value={record.description} onChange={event => onChange({ description: event.target.value })} rows={hasSourceFields ? 3 : 2} title="Explanation of when to use this value." />
    </label>
    {hasSourceFields ? <>
      <label className="lookup-source-notes">Source notes
        <textarea value={record.sourceNotes ?? ""} onChange={event => onChange({ sourceNotes: event.target.value })} rows={3} title="Optional source notes." />
      </label>
      <label className="lookup-source-url">Source URL
        <input value={record.sourceUrl ?? ""} onChange={event => onChange({ sourceUrl: event.target.value })} title="Optional source URL." />
      </label>
    </> : null}
  </>;
}
