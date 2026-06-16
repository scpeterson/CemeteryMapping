import { useEffect, useMemo, useState } from "react";
import { BarChart3, MapPinned, ShieldCheck } from "lucide-react";
import {
  createOwnershipEvent,
  fetchCemeteryData,
  fetchCurrentUser,
  fetchHeadstoneLookups,
  fetchSearchMatches,
  updateBurial,
  updateGraveSpace,
  updateHeadstone,
  uploadGravePhoto,
  uploadHeadstonePhoto,
} from "./api/cemeteryApi";
import { AdminPanel } from "./components/AdminPanel";
import { CemeteryMap } from "./components/CemeteryMap";
import { ControlPointCollector } from "./components/ControlPointCollector";
import { DetailPanel } from "./components/DetailPanel";
import { ReportsPanel } from "./components/ReportsPanel";
import { SearchPanel } from "./components/SearchPanel";
import { apiBaseUrl, appEnvironment, appVersionMetadata } from "./config/environment";
import { cemeteryData } from "./data/cemeteryData";
import { graveSelectionKey } from "./lib/format";
import { searchGraves } from "./lib/search";
import { useSelectedRecordDetails } from "./hooks/useSelectedRecordDetails";
import type {
  Burial,
  CemeteryData,
  CemeteryLot,
  CurrentUser,
  GraveSpace,
  GraveSpaceSummary,
  GraveStatus,
  Headstone,
  HeadstoneLookups,
  HeadstoneSummary,
  SaveBurialInput,
  SaveGraveSpaceInput,
  SaveHeadstoneInput,
  SaveOwnershipEventInput,
  SearchMatch,
} from "./types";

const allStatuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];
const emptyHeadstoneLookups: HeadstoneLookups = {
  markerTypes: [],
  materials: [],
  conditions: [],
  vaseTypes: [],
  vaseMaterials: [],
  vasePlacements: [],
  intermentTypes: [],
  militaryBranches: [],
  militaryWarServices: [],
};

function includesAllStatuses(statuses: Set<GraveStatus>) {
  return allStatuses.every((status) => statuses.has(status));
}

export default function App() {
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<GraveStatus>>(() => new Set(allStatuses));
  const [data, setData] = useState<CemeteryData>(cemeteryData);
  const [loadError, setLoadError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGrave, setSelectedGrave] = useState<GraveSpaceSummary | undefined>();
  const [selectedLot, setSelectedLot] = useState<CemeteryLot | undefined>();
  const [selectedHeadstone, setSelectedHeadstone] = useState<HeadstoneSummary | undefined>();
  const [remoteMatches, setRemoteMatches] = useState<SearchMatch[]>();
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [headstoneLookups, setHeadstoneLookups] = useState<HeadstoneLookups>(emptyHeadstoneLookups);
  const [userError, setUserError] = useState<string>();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isReportsPanelOpen, setIsReportsPanelOpen] = useState(false);
  const [isControlPointCollectorOpen, setIsControlPointCollectorOpen] = useState(false);
  const {
    selectedGraveDetails,
    setSelectedGraveDetails,
    selectedHeadstoneDetails,
    setSelectedHeadstoneDetails,
    selectedGraveOwners,
    detailError,
    isDetailLoading,
    refreshDetails,
  } = useSelectedRecordDetails({ selectedGrave, selectedHeadstone });

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
          current ? nextData.graves.find((grave) => graveSelectionKey(grave) === graveSelectionKey(current)) : undefined,
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
    const cleanedQuery = query.trim();
    if (!cleanedQuery) {
      setRemoteMatches(undefined);
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();
    const searchTimeout = window.setTimeout(() => {
      fetchSearchMatches(cleanedQuery, selectedStatuses, controller.signal)
        .then((matches) => {
          if (isCurrent) setRemoteMatches(matches);
        })
        .catch((error: unknown) => {
          if (!isCurrent || (error instanceof DOMException && error.name === "AbortError")) return;
          setRemoteMatches([]);
        });
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(searchTimeout);
      controller.abort();
    };
  }, [query, selectedStatuses]);

  const localMatches = useMemo(() => searchGraves(data, query, selectedStatuses), [data, query, selectedStatuses]);
  const matches = remoteMatches ?? localMatches;
  const visibleGraves = useMemo(() => {
    if (selectedStatuses.size === allStatuses.length && includesAllStatuses(selectedStatuses)) return data.graves;
    return data.graves.filter((grave) => selectedStatuses.has(grave.status));
  }, [data.graves, selectedStatuses]);
  const isInitialMapFitReady = Boolean(currentUser) && !isLoading;
  const initialMapFitCemeteryIds =
    currentUser && currentUser.role !== "admin" && currentUser.assignedCemeteryIds.length ? currentUser.assignedCemeteryIds : undefined;
  const searchResultIds = useMemo(() => {
    if (!query.trim()) return new Set<string>();
    return new Set(matches.map((match) => graveSelectionKey(match.grave)));
  }, [matches, query]);
  const selectedLotGraves = useMemo(() => {
    if (!selectedLot) return [];
    return data.graves.filter(
      (grave) =>
        grave.cemeteryId === selectedLot.cemeteryId &&
        grave.section === selectedLot.section &&
        grave.lot === selectedLot.id,
    );
  }, [data.graves, selectedLot]);
  const selectedHeadstoneGraves = useMemo(() => {
    if (!selectedHeadstone) return [];
    const associatedIds = selectedHeadstoneDetails?.associatedGravesiteIds?.length
      ? selectedHeadstoneDetails.associatedGravesiteIds
      : selectedHeadstone.gravesiteId
        ? [selectedHeadstone.gravesiteId]
        : [];
    const associatedIdSet = new Set(associatedIds);
    return data.graves.filter((grave) => grave.cemeteryId === selectedHeadstone.cemeteryId && associatedIdSet.has(grave.id));
  }, [data.graves, selectedHeadstone, selectedHeadstoneDetails]);
  const hasScopedEditAccess = currentUser?.role === "power-user" || currentUser?.role === "cemetery-admin";
  const canViewSelectedOwnership =
    currentUser?.role === "admin" ||
    (hasScopedEditAccess && selectedGrave ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedGrave.cemeteryId) : false);
  const canUpdateSelectedHeadstones =
    currentUser?.role === "admin" ||
    (hasScopedEditAccess && selectedGrave ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedGrave.cemeteryId) : false) ||
    (hasScopedEditAccess && selectedHeadstone ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedHeadstone.cemeteryId) : false);
  const canUpdateSelectedGravesites = canUpdateSelectedHeadstones;
  const canUpdateSelectedBurials = canUpdateSelectedHeadstones;
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
    setSelectedHeadstone(undefined);
    setSelectedLot(undefined);
    setSelectedGrave(match.grave);
  };

  const selectGrave = (grave: GraveSpaceSummary) => {
    setSelectedHeadstone(undefined);
    setSelectedLot(undefined);
    setSelectedGrave(grave);
  };

  const selectLot = (lot: CemeteryLot) => {
    setSelectedHeadstone(undefined);
    setSelectedGrave(undefined);
    setSelectedLot(lot);
  };

  const selectHeadstone = (headstone: HeadstoneSummary) => {
    setSelectedHeadstone(headstone);
    setSelectedLot(undefined);
    setSelectedGrave(undefined);
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
    setSelectedHeadstoneDetails((current) => (current?.id === saved.id ? saved : current));
    setData((current) => ({
      ...current,
      headstones: (current.headstones ?? []).map((candidate) =>
        candidate.id === saved.id
          ? {
              ...candidate,
              markerTypeCode: saved.markerType.code,
              markerType: saved.markerType.label,
              condition: saved.condition.code,
            }
          : candidate,
      ),
    }));
    return saved;
  };

  const saveGraveSpace = async (graveSpace: SaveGraveSpaceInput): Promise<GraveSpace> => {
    if (!selectedGrave) throw new Error("Select a grave site before saving.");
    const saved = await updateGraveSpace(selectedGrave.cemeteryId, selectedGrave.id, graveSpace);
    setSelectedGraveDetails(saved);
    setSelectedGrave(saved);
    setData((current) => ({
      ...current,
      graves: current.graves.map((candidate) => (graveSelectionKey(candidate) === graveSelectionKey(saved) ? saved : candidate)),
    }));
    return saved;
  };

  const saveBurial = async (id: string, burial: SaveBurialInput): Promise<Burial> => {
    const saved = await updateBurial(id, burial);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            burials: current.burials.map((candidate) => (candidate.id === saved.id ? saved : candidate)),
          }
        : current,
    );
    return saved;
  };

  const saveGravePhoto = async ({ file, headstoneId, notes }: { file: File; headstoneId?: string; notes?: string }) => {
    const source = /iPhone|iPad|iPod/u.test(navigator.userAgent) ? "iphone" : "field_upload";
    if (selectedGrave) {
      await uploadGravePhoto({
        cemeteryId: selectedGrave.cemeteryId,
        graveSpaceId: selectedGrave.id,
        file,
        headstoneId,
        notes,
        source,
      });
    } else if (selectedHeadstone) {
      await uploadHeadstonePhoto({
        cemeteryId: selectedHeadstone.cemeteryId,
        headstoneId: selectedHeadstone.id,
        file,
        notes,
        source,
      });
    } else {
      throw new Error("Select a grave site or marker before uploading a photo.");
    }
    refreshDetails();
  };

  const saveOwnershipEvent = async (event: SaveOwnershipEventInput) => {
    if (!selectedGrave) throw new Error("Select a grave site before recording ownership.");
    await createOwnershipEvent(selectedGrave.cemeteryId, selectedGrave.id, event);
    refreshDetails();
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
        <div
          className={`environment-badge environment-${appEnvironment.toLowerCase()}`}
          title={`Version: ${appVersionMetadata.version} (${appVersionMetadata.gitSha})\nBuild: ${appVersionMetadata.buildTime}\nAPI: ${apiBaseUrl}`}
        >
          {appEnvironment}
        </div>
        <div className="map-tool-buttons">
          {currentUser ? (
            <button
              type="button"
              className="map-tool-button"
              onClick={() => setIsReportsPanelOpen(true)}
              aria-label="Open reports: run saved cemetery reports and guided queries"
              title="Open reports: run saved cemetery reports and guided queries."
            >
              <BarChart3 size={16} aria-hidden="true" />
              Reports
            </button>
          ) : null}
          {currentUser?.permissions.canOpenAdminPanel ? (
            <>
              <button
                type="button"
                className="map-tool-button"
                onClick={() => setIsControlPointCollectorOpen(true)}
                aria-label="Open control point collector: align historic map images to cemetery coordinates"
                title="Open control point collector: align historic map images to cemetery coordinates."
              >
                <MapPinned size={16} aria-hidden="true" />
                Control
              </button>
              <button
                type="button"
                className="map-tool-button"
                onClick={() => setIsAdminPanelOpen(true)}
                aria-label="Open administration: manage users, records, lookups, audits, and system events"
                title="Open administration: manage users, records, lookups, audits, and system events."
              >
                <ShieldCheck size={16} aria-hidden="true" />
                Admin
              </button>
            </>
          ) : null}
        </div>
        {isReportsPanelOpen && currentUser ? <ReportsPanel currentUser={currentUser} data={data} onClose={() => setIsReportsPanelOpen(false)} /> : null}
        {isAdminPanelOpen && currentUser ? <AdminPanel currentUser={currentUser} onClose={() => setIsAdminPanelOpen(false)} /> : null}
        {isControlPointCollectorOpen && currentUser?.permissions.canOpenAdminPanel ? (
          <ControlPointCollector data={data} onClose={() => setIsControlPointCollectorOpen(false)} />
        ) : null}
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
          selectedLot={selectedLot}
          selectedHeadstone={selectedHeadstone}
          visibleGraves={visibleGraves}
          searchResultIds={searchResultIds}
          initialFitCemeteryIds={initialMapFitCemeteryIds}
          isInitialFitReady={isInitialMapFitReady}
          onSelectGrave={selectGrave}
          onSelectLot={selectLot}
          onSelectHeadstone={selectHeadstone}
        />
      </section>
      <DetailPanel
        owners={selectedGraveOwners}
        summary={selectedGrave}
        lot={selectedLot}
        lotGraves={selectedLotGraves}
        grave={selectedGraveDetails}
        standaloneHeadstoneSummary={selectedHeadstone}
        standaloneHeadstone={selectedHeadstoneDetails}
        markerGraves={selectedHeadstoneGraves}
        canViewOwnership={canViewSelectedOwnership}
        canUpdateGravesites={canUpdateSelectedGravesites}
        canUpdateBurials={canUpdateSelectedBurials}
        canUpdateHeadstones={canUpdateSelectedHeadstones}
        headstoneLookups={headstoneLookups}
        onSaveGraveSpace={saveGraveSpace}
        onSaveBurial={saveBurial}
        onSaveHeadstone={saveHeadstone}
        onSaveOwnershipEvent={saveOwnershipEvent}
        onSelectLotGrave={selectGrave}
        onSelectMarkerGrave={selectGrave}
        onUploadPhoto={saveGravePhoto}
        isLoading={isDetailLoading}
        error={detailError}
        onRetry={refreshDetails}
      />
    </main>
  );
}
