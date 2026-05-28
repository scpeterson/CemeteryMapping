import { useEffect, useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { fetchCemeteryData, fetchCurrentUser, fetchGraveSpace, fetchHeadstoneLookups, fetchSearchMatches, updateHeadstone } from "./api/cemeteryApi";
import { AdminPanel } from "./components/AdminPanel";
import { CemeteryMap } from "./components/CemeteryMap";
import { DetailPanel } from "./components/DetailPanel";
import { SearchPanel } from "./components/SearchPanel";
import { apiBaseUrl, appEnvironment } from "./config/environment";
import { cemeteryData } from "./data/cemeteryData";
import { graveSelectionKey } from "./lib/format";
import { searchGraves } from "./lib/search";
import type { CemeteryData, CurrentUser, GraveSpace, GraveSpaceSummary, GraveStatus, Headstone, HeadstoneLookups, Owner, SaveHeadstoneInput, SearchMatch } from "./types";

const allStatuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];
const emptyHeadstoneLookups: HeadstoneLookups = { markerTypes: [], materials: [], conditions: [] };

export default function App() {
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<GraveStatus>>(() => new Set(allStatuses));
  const [data, setData] = useState<CemeteryData>(cemeteryData);
  const [loadError, setLoadError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGrave, setSelectedGrave] = useState<GraveSpaceSummary | undefined>();
  const [selectedGraveDetails, setSelectedGraveDetails] = useState<GraveSpace | undefined>();
  const [selectedGraveOwners, setSelectedGraveOwners] = useState<Owner[]>([]);
  const [detailError, setDetailError] = useState<string>();
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);
  const [remoteMatches, setRemoteMatches] = useState<SearchMatch[]>();
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [headstoneLookups, setHeadstoneLookups] = useState<HeadstoneLookups>(emptyHeadstoneLookups);
  const [userError, setUserError] = useState<string>();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    fetchCurrentUser()
      .then((user) => {
        if (!isCurrent) return;
        setCurrentUser(user);
        setUserError(undefined);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setUserError(error instanceof Error ? error.message : "Unable to load user permissions");
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    fetchHeadstoneLookups()
      .then((lookups) => {
        if (isCurrent) setHeadstoneLookups(lookups);
      })
      .catch(() => {
        if (isCurrent) setHeadstoneLookups(emptyHeadstoneLookups);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    let isCurrent = true;

    fetchCemeteryData()
      .then((nextData) => {
        if (!isCurrent) return;
        setData(nextData);
        setSelectedGrave((current) =>
          current ? nextData.graves.find((grave) => graveSelectionKey(grave) === graveSelectionKey(current)) : nextData.graves[0],
        );
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

  useEffect(() => {
    setSelectedGraveDetails(undefined);
    setSelectedGraveOwners([]);
    setDetailError(undefined);

    if (!selectedGrave) {
      setIsDetailLoading(false);
      return;
    }

    let isCurrent = true;
    setIsDetailLoading(true);

    fetchGraveSpace(selectedGrave.cemeteryId, selectedGrave.id)
      .then((detail) => {
        if (!isCurrent) return;
        setSelectedGraveDetails(detail);
        setSelectedGraveOwners(detail.owners);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setDetailError(error instanceof Error ? error.message : "Unable to load grave details");
      })
      .finally(() => {
        if (isCurrent) setIsDetailLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedGrave, detailRequestVersion]);

  useEffect(() => {
    const cleanedQuery = query.trim();
    if (!cleanedQuery) {
      setRemoteMatches(undefined);
      return;
    }

    let isCurrent = true;

    fetchSearchMatches(cleanedQuery, selectedStatuses)
      .then((matches) => {
        if (isCurrent) setRemoteMatches(matches);
      })
      .catch(() => {
        if (isCurrent) setRemoteMatches([]);
      });

    return () => {
      isCurrent = false;
    };
  }, [query, selectedStatuses]);

  const localMatches = useMemo(() => searchGraves(data, query, selectedStatuses), [data, query, selectedStatuses]);
  const matches = remoteMatches ?? localMatches;
  const visibleGraves = useMemo(() => data.graves.filter((grave) => selectedStatuses.has(grave.status)), [data, selectedStatuses]);
  const searchResultIds = useMemo(() => new Set(matches.map((match) => graveSelectionKey(match.grave))), [matches]);
  const hasScopedEditAccess = currentUser?.role === "power-user" || currentUser?.role === "cemetery-admin";
  const canViewSelectedOwnership =
    currentUser?.role === "admin" ||
    (hasScopedEditAccess && selectedGrave ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedGrave.cemeteryId) : false);
  const canUpdateSelectedHeadstones =
    currentUser?.role === "admin" ||
    (hasScopedEditAccess && selectedGrave ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedGrave.cemeteryId) : false);
  const cemeteryScopeLabel = useMemo(() => {
    const cemeteryNames = [...new Set((data.boundaries ?? (data.boundary ? [data.boundary] : [])).map((boundary) => boundary.properties.name))];
    if (cemeteryNames.length === 0) return "Cemetery records";
    if (cemeteryNames.length === 1) return cemeteryNames[0];
    return `${cemeteryNames.length} cemeteries`;
  }, [data.boundaries, data.boundary]);

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

  const saveHeadstone = async (id: string, headstone: SaveHeadstoneInput): Promise<Headstone> => {
    const saved = await updateHeadstone(id, headstone);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            headstones: current.headstones.map((candidate) => (candidate.id === saved.id ? saved : candidate)),
          }
        : current,
    );
    return saved;
  };

  return (
    <main className="app-shell">
      <SearchPanel
        cemeteryScopeLabel={cemeteryScopeLabel}
        query={query}
        onQueryChange={setQuery}
        selectedStatuses={selectedStatuses}
        onToggleStatus={toggleStatus}
        matches={matches}
        canViewOwnership={currentUser?.permissions.canViewOwnership ?? false}
        selectedGraveKey={selectedGrave ? graveSelectionKey(selectedGrave) : undefined}
        onSelectMatch={selectMatch}
      />
      <section className="map-region">
        <div className={`environment-badge environment-${appEnvironment.toLowerCase()}`} title={`API: ${apiBaseUrl}`}>
          {appEnvironment}
        </div>
        {currentUser?.permissions.canOpenAdminPanel ? (
          <button type="button" className="admin-open-button" onClick={() => setIsAdminPanelOpen(true)} aria-label="Open admin management">
            <ShieldCheck size={16} aria-hidden="true" />
            Admin
          </button>
        ) : null}
        {isAdminPanelOpen && currentUser ? <AdminPanel currentUser={currentUser} onClose={() => setIsAdminPanelOpen(false)} /> : null}
        {isLoading || loadError ? (
          <div className={`data-status ${loadError ? "is-error" : ""}`} role="status">
            {loadError ? `API unavailable: ${loadError}` : "Loading cemetery records..."}
          </div>
        ) : null}
        {userError ? (
          <div className="data-status is-error" role="status">
            Permissions unavailable: {userError}
          </div>
        ) : null}
        <CemeteryMap
          data={data}
          selectedGrave={selectedGrave}
          visibleGraves={visibleGraves}
          searchResultIds={searchResultIds}
          onSelectGrave={setSelectedGrave}
        />
      </section>
      <DetailPanel
        owners={selectedGraveOwners}
        summary={selectedGrave}
        grave={selectedGraveDetails}
        canViewOwnership={canViewSelectedOwnership}
        canUpdateHeadstones={canUpdateSelectedHeadstones}
        headstoneLookups={headstoneLookups}
        onSaveHeadstone={saveHeadstone}
        isLoading={isDetailLoading}
        error={detailError}
        onRetry={() => setDetailRequestVersion((version) => version + 1)}
      />
    </main>
  );
}
