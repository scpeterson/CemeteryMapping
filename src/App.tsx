import { useMemo, useState } from "react";
import { CemeteryMap } from "./components/CemeteryMap";
import { DetailPanel } from "./components/DetailPanel";
import { SearchPanel } from "./components/SearchPanel";
import { cemeteryData } from "./data/cemeteryData";
import { statusLabels } from "./lib/format";
import { searchGraves } from "./lib/search";
import type { GraveSpace, GraveStatus, SearchMatch } from "./types";

const allStatuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "unknown"];

export default function App() {
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<GraveStatus>>(() => new Set(allStatuses));
  const [selectedGrave, setSelectedGrave] = useState<GraveSpace | undefined>(() => cemeteryData.graves[0]);

  const matches = useMemo(() => searchGraves(cemeteryData, query, selectedStatuses), [query, selectedStatuses]);
  const visibleGraves = useMemo(() => cemeteryData.graves.filter((grave) => selectedStatuses.has(grave.status)), [selectedStatuses]);
  const searchResultIds = useMemo(() => new Set(matches.map((match) => match.grave.id)), [matches]);

  const toggleStatus = (status: GraveStatus) => {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status) && next.size > 1) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const selectMatch = (match: SearchMatch) => {
    setSelectedGrave(match.grave);
  };

  return (
    <main className="app-shell">
      <SearchPanel
        query={query}
        onQueryChange={setQuery}
        selectedStatuses={selectedStatuses}
        onToggleStatus={toggleStatus}
        matches={matches}
        selectedGraveId={selectedGrave?.id}
        onSelectMatch={selectMatch}
      />
      <section className="map-region">
        <CemeteryMap
          data={cemeteryData}
          selectedGrave={selectedGrave}
          visibleGraves={visibleGraves}
          searchResultIds={searchResultIds}
          onSelectGrave={setSelectedGrave}
        />
        <div className="map-legend" aria-label="Map status legend">
          {allStatuses.map((status) => (
            <span key={status}>
              <i className={`legend-dot legend-${status}`} />
              {statusLabels[status]}
            </span>
          ))}
        </div>
      </section>
      <DetailPanel data={cemeteryData} grave={selectedGrave} />
    </main>
  );
}
