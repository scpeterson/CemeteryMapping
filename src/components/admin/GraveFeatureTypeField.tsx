import type { LookupRecord } from "../../types";

export function GraveFeatureTypeField({ record, types, onChange }: {
  record: LookupRecord;
  types: LookupRecord[];
  onChange: (patch: Partial<LookupRecord>) => void;
}) {
  return <label className="lookup-feature-type">Feature type
    <select aria-label="Feature type" value={record.graveFeatureTypeId ?? ""} disabled={Boolean(record.id)} onChange={event => onChange({ graveFeatureTypeId: event.target.value || null })}>
      <option value="">All feature types</option>
      {types.filter(type => type.isActive || type.id === record.graveFeatureTypeId).map(type => (
        <option key={type.id} value={type.id}>{type.label}{type.isActive ? "" : " (inactive)"}</option>
      ))}
    </select>
    {record.id ? <span className="muted">To use a different feature type, add a new subtype.</span> : null}
  </label>;
}
