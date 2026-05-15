import { useEffect, useMemo, useState } from "react";
import { fetchCemeteryData } from "./api/cemeteryApi";
import { CemeteryMap } from "./components/CemeteryMap";
import { DetailPanel } from "./components/DetailPanel";
import { SearchPanel } from "./components/SearchPanel";
import { apiBaseUrl, appEnvironment } from "./config/environment";
import { cemeteryData } from "./data/cemeteryData";
import { statusLabels } from "./lib/format";
import { searchGraves } from "./lib/search";
import type { CemeteryData, GraveSpace, GraveStatus, SearchMatch } from "./types";

const allStatuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "unknown"];

export default function App() {
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<GraveStatus>>(() => new Set(allStatuses));
  const [data, setData] = useState<CemeteryData>(cemeteryData);
  const [loadError, setLoadError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGrave, setSelectedGrave] = useState<GraveSpace | undefined>();

  useEffect(() => {
    let isCurrent = true;

    fetchCemeteryData()
      .then((nextData) => {
        if (!isCurrent) return;
        setData(nextData);
        setSelectedGrave((current) => (current ? nextData.graves.find((grave) => grave.id === current.id) : nextData.graves[0]));
        setLoadError(undefined);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load cemetery data");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const matches = useMemo(() => searchGraves(data, query, selectedStatuses), [data, query, selectedStatuses]);
  const visibleGraves = useMemo(() => data.graves.filter((grave) => selectedStatuses.has(grave.status)), [data, selectedStatuses]);
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
        <div className={`environment-badge environment-${appEnvironment.toLowerCase()}`} title={`API: ${apiBaseUrl}`}>
          {appEnvironment}
        </div>
        {isLoading || loadError ? (
          <div className={`data-status ${loadError ? "is-error" : ""}`} role="status">
            {loadError ? `API unavailable: ${loadError}` : "Loading cemetery records..."}
          </div>
        ) : null}
        <CemeteryMap
          data={data}
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
      <DetailPanel data={data} grave={selectedGrave} />
    </main>
  );
}
