import { CalendarSearch, Filter, Search, X } from "lucide-react";
import type { GraveStatus, SearchMatch } from "../types";
import { statusColors, statusLabels } from "../lib/format";

type SearchPanelProps = {
  query: string;
  onQueryChange: (query: string) => void;
  selectedStatuses: Set<GraveStatus>;
  onToggleStatus: (status: GraveStatus) => void;
  matches: SearchMatch[];
  selectedGraveId?: string;
  onSelectMatch: (match: SearchMatch) => void;
};

const statuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "unknown"];

export function SearchPanel({ query, onQueryChange, selectedStatuses, onToggleStatus, matches, selectedGraveId, onSelectMatch }: SearchPanelProps) {
  return (
    <aside className="search-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">St. Mark Church Cemetery</p>
          <h1>Cemetery Map</h1>
        </div>
        <CalendarSearch size={24} aria-hidden="true" />
      </div>

      <label className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search names, owners, dates, lots"
          aria-label="Search cemetery records"
        />
        {query ? (
          <button type="button" className="icon-button" onClick={() => onQueryChange("")} aria-label="Clear search">
            <X size={16} />
          </button>
        ) : null}
      </label>

      <div className="filter-header">
        <Filter size={16} aria-hidden="true" />
        <span>Status</span>
      </div>
      <div className="status-filter" role="group" aria-label="Filter by grave status">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            className={`status-chip ${selectedStatuses.has(status) ? "is-active" : ""}`}
            onClick={() => onToggleStatus(status)}
          >
            <span style={{ backgroundColor: statusColors[status] }} />
            {statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="results-heading">
        <span>{matches.length} result{matches.length === 1 ? "" : "s"}</span>
      </div>

      <div className="results-list">
        {matches.map((match) => (
          <button
            key={match.grave.id}
            type="button"
            className={`result-card ${selectedGraveId === match.grave.id ? "is-selected" : ""}`}
            onClick={() => onSelectMatch(match)}
          >
            <span className="result-title">
              Section {match.grave.section}, Lot {match.grave.lot}, Space {match.grave.space}
            </span>
            <span className="result-meta">{statusLabels[match.grave.status]}</span>
            <span className="result-reason">{match.reasons.slice(0, 2).join(" | ")}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
