import type { LookupRecord } from "../../types";

type Props = {
  record: LookupRecord;
  branches: LookupRecord[];
  onChange: (patch: Partial<LookupRecord>) => void;
};

export function MilitaryRankFields({ record, branches, onChange }: Props) {
  return <div className="lookup-rank-fields">
    <label>Military branch
      <select aria-label="Military branch" value={record.militaryBranchId ?? ""} disabled={Boolean(record.id)} onChange={event => onChange({ militaryBranchId: event.target.value })}>
        <option value="">Choose a branch</option>
        {branches.filter(branch => branch.isActive || branch.id === record.militaryBranchId).map(branch => <option key={branch.id} value={branch.id}>{branch.label}{branch.isActive ? "" : " (inactive)"}</option>)}
      </select>
      {record.id ? <span className="muted">To use a different branch, add a new rank.</span> : null}
    </label>
    <label>Abbreviation
      <input value={record.abbreviation ?? ""} maxLength={20} onChange={event => onChange({ abbreviation: event.target.value })} placeholder="e.g. Tec 4" />
    </label>
    <label>Pay grade (optional)
      <input value={record.payGrade ?? ""} maxLength={10} onChange={event => onChange({ payGrade: event.target.value })} placeholder="e.g. 4th Grade" />
    </label>
    <label>Rank group
      <select value={record.rankGroup ?? "enlisted"} onChange={event => onChange({ rankGroup: event.target.value })}>
        <option value="enlisted">Enlisted</option>
        <option value="warrant_officer">Warrant officer</option>
        <option value="officer">Officer</option>
      </select>
    </label>
  </div>;
}
