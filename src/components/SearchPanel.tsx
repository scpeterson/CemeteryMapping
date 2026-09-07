import { Button } from "./ui/Button";
import { EmptyState, Notice, StatusBadge } from "./ui/Feedback";
import { CalendarSearch, Filter, Search, X } from "lucide-react";
import type { CemeterySearchMatch, GraveStatus } from "../types";
import { formatGraveLocation, graveSelectionKey, lotSelectionKey, statusColors, statusLabels } from "../lib/format";

type SearchPanelProps = {
  isSearching: boolean;
  error?: string;
  onRetry: () => void;
  cemeteryScopeLabel: string;
  query: string;
  onQueryChange: (query: string) => void;
  selectedStatuses: Set<GraveStatus>;
  onToggleStatus: (status: GraveStatus) => void;
  matches: CemeterySearchMatch[];
  canViewOwnership: boolean;
  selectedGraveKey?: string;
  selectedLotKey?: string;
  onSelectMatch: (match: CemeterySearchMatch) => void;
};

const statuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];

export function SearchPanel({
  isSearching, error, onRetry,
  cemeteryScopeLabel,
  query,
  onQueryChange,
  selectedStatuses,
  onToggleStatus,
  matches,
  canViewOwnership,
  selectedGraveKey,
  selectedLotKey,
  onSelectMatch,
}: SearchPanelProps) {
  return (
    <aside className="search-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{cemeteryScopeLabel}</p>
          <h1>Cemetery Map</h1>
        </div>
        <CalendarSearch size={24} aria-hidden="true" />
      </div>

      <label className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={canViewOwnership ? "Search names, owners, dates, graves, lots" : "Search names, dates, graves, lots"}
          aria-label="Search cemetery records"
          aria-controls="cemetery-search-results"
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
            aria-pressed={selectedStatuses.has(status)}
            className={`status-chip ${selectedStatuses.has(status) ? "is-active" : ""}`}
            onClick={() => onToggleStatus(status)}
          >
            <span style={{ backgroundColor: statusColors[status] }} />
            {statusLabels[status]}
          </button>
        ))}
      </div>

      <div className="results-heading" role="status" aria-live="polite" aria-atomic="true">
        <span>{isSearching ? "Searching records…" : `${matches.length} result${matches.length === 1 ? "" : "s"}${error ? " from loaded map data" : ""}`}</span>
      </div>

      <div className="results-list" id="cemetery-search-results" aria-busy={isSearching}>
        {error ? <Notice tone="error">{error} <Button variant="secondary" onClick={onRetry}>Retry search</Button></Notice> : null}
        {!isSearching && !error && !matches.length ? <EmptyState title="No matching records">Try a different name, grave, or lot, or enable more status filters.</EmptyState> : null}
        {!isSearching && matches.map((match) => {
          if ("lot" in match) {
            const key = lotSelectionKey(match.lot);
            return (
              <button
                key={`lot:${key}`}
                type="button"
                aria-current={selectedLotKey === key ? "true" : undefined}
                className={`result-card ${selectedLotKey === key ? "is-selected" : ""}`}
                onClick={() => onSelectMatch(match)}
              >
                <span className="result-title">Lot {match.lot.name || match.lot.id}</span>
                <span className="result-cemetery">Section {match.lot.section}{match.lot.block ? `, Block ${match.lot.block}` : ""}</span>
                <span className="result-meta">Lot</span>
                {match.reasons.length ? <span className="result-reason">{match.reasons.slice(0, 2).join(" | ")}</span> : null}
              </button>
            );
          }

          const key = graveSelectionKey(match.grave);
          const statusLabel = statusLabels[match.grave.status];
          const reasons = match.reasons.filter((reason) => reason !== statusLabel && reason !== `Status: ${statusLabel}`).slice(0, 2);

          return (
            <button
              key={key}
              type="button"
              aria-current={selectedGraveKey === key ? "true" : undefined}
              className={`result-card ${selectedGraveKey === key ? "is-selected" : ""}`}
              onClick={() => onSelectMatch(match)}
            >
              <span className="result-title">{formatGraveLocation(match.grave)}</span>
              <span className="result-cemetery">{match.grave.cemeteryName}</span>
              <StatusBadge tone={["needs_review", "reserved"].includes(match.grave.status) ? "warning" : match.grave.status === "available" ? "success" : "neutral"}>{statusLabel}</StatusBadge>
              {reasons.length ? <span className="result-reason">{reasons.join(" | ")}</span> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
