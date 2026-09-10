import { ConfirmationProvider } from "./components/ui/ConfirmationProvider";
import { confirmDiscardChanges, useDraftNavigationGuard } from "./hooks/useDraftState";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ApplicationHeader } from "./components/ApplicationHeader";
import {
  fetchCemeteryData,
  fetchCurrentUser,
  fetchHeadstoneLookups,
  fetchSearchMatches,
} from "./api/cemeteryApi";
import { CemeteryMap } from "./components/CemeteryMap";
import { DetailPanel } from "./components/DetailPanel";
import { SearchPanel } from "./components/SearchPanel";
import { apiBaseUrl, appEnvironment, appVersionMetadata } from "./config/environment";
import { cemeteryData } from "./data/cemeteryData";
import { graveSelectionKey, lotSelectionKey } from "./lib/format";
import { searchGraves, searchLots } from "./lib/search";
import { useSelectedRecordDetails } from "./hooks/useSelectedRecordDetails";
import { useRecordMutations } from "./hooks/useRecordMutations";
import type {
  CemeterySearchMatch,
  CemeteryData,
  CemeteryLot,
  CurrentUser,
  GraveSpaceSummary,
  GraveStatus,
  HeadstoneLookups,
  HeadstoneSummary,
  SearchMatch,
} from "./types";

const AdminPanel = lazy(() => import("./components/AdminPanel").then((module) => ({ default: module.AdminPanel })));
const ControlPointCollector = lazy(() =>
  import("./components/ControlPointCollector").then((module) => ({ default: module.ControlPointCollector })),
);
const ReportsPanel = lazy(() => import("./components/ReportsPanel").then((module) => ({ default: module.ReportsPanel })));

const allStatuses: GraveStatus[] = ["available", "reserved", "occupied", "sold", "needs_review", "unknown"];
const emptyHeadstoneLookups: HeadstoneLookups = {
  headstones: [],
  gravesites: [],
  markerTypes: [],
  markerScopes: [],
  materials: [],
  conditions: [],
  vaseTypes: [],
  vaseMaterials: [],
  vasePlacements: [],
  graveFeatureTypes: [],
  graveFeatureSubtypes: [],
  graveFeaturePlacements: [],
  graveFeatureMaterials: [],
  intermentTypes: [],
  burialRecordStatuses: [],
  militaryBranches: [],
  militaryRanks: [],
  militaryWarServices: [],
  militaryDecorations: [],
  verifiedPlaces: [],
  maintenanceIssueTypes: [],
  maintenanceActionTypes: [],
  maintenancePriorities: [],
};

type PickedMarkerPoint = {
  latitude: number;
  longitude: number;
  pickedAt: number;
};

function includesAllStatuses(statuses: Set<GraveStatus>) {
  return allStatuses.every((status) => statuses.has(status));
}

export default function App() {
  useDraftNavigationGuard();
  const [mobileView, setMobileView] = useState<"search" | "map" | "details">("map");
  const [selectionVersion, setSelectionVersion] = useState(0);
  const [adminCemeteryScope, setAdminCemeteryScope] = useState("");
  const [query, setQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<GraveStatus>>(() => new Set(allStatuses));
  const [data, setData] = useState<CemeteryData>(cemeteryData);
  const [loadError, setLoadError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGrave, setSelectedGrave] = useState<GraveSpaceSummary | undefined>();
  const [selectedLot, setSelectedLot] = useState<CemeteryLot | undefined>();
  const [selectedHeadstone, setSelectedHeadstone] = useState<HeadstoneSummary | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>();
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [remoteMatches, setRemoteMatches] = useState<SearchMatch[]>();
  const [currentUser, setCurrentUser] = useState<CurrentUser>();
  const [headstoneLookups, setHeadstoneLookups] = useState<HeadstoneLookups>(emptyHeadstoneLookups);
  const [userError, setUserError] = useState<string>();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isReportsPanelOpen, setIsReportsPanelOpen] = useState(false);
  const [isControlPointCollectorOpen, setIsControlPointCollectorOpen] = useState(false);
  const [isPickingMarkerPoint, setIsPickingMarkerPoint] = useState(false);
  const [pickedMarkerPoint, setPickedMarkerPoint] = useState<PickedMarkerPoint>();
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
    setSearchError(undefined);
    setRemoteMatches(undefined);
    setIsSearching(Boolean(cleanedQuery));
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
          setRemoteMatches(undefined);
          setSearchError("Search is unavailable. Showing matches from loaded map data.");
        })
        .finally(() => { if (isCurrent) setIsSearching(false); });
    }, 250);

    return () => {
      isCurrent = false;
      window.clearTimeout(searchTimeout);
      controller.abort();
    };
  }, [query, selectedStatuses, searchAttempt]);

  const cemeteryScope = currentUser?.role === "admin"
    ? adminCemeteryScope
    : currentUser?.assignedCemeteryIds.length === 1 ? currentUser.assignedCemeteryIds[0] : null;

  const cemeteries = useMemo(() => {
    const names = new Map<string, string>();
    for (const boundary of data.boundaries ?? (data.boundary ? [data.boundary] : [])) {
      if (boundary.properties.id) names.set(boundary.properties.id, boundary.properties.name);
    }
    for (const grave of data.graves) names.set(grave.cemeteryId, grave.cemeteryName);
    return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const mapData = useMemo<CemeteryData>(() => {
    if (cemeteryScope === "") return data;
    if (cemeteryScope === null) return { boundaries: [], sections: [], lots: [], graves: [], headstones: [], lotRestrictedAreas: [] };
    const name = cemeteries.find((cemetery) => cemetery.id === cemeteryScope)?.name;
    const boundaries = (data.boundaries ?? (data.boundary ? [data.boundary] : [])).filter((boundary) =>
      boundary.properties.id ? boundary.properties.id === cemeteryScope : boundary.properties.name === name);
    return {
      ...data,
      boundary: boundaries[0],
      boundaries,
      graves: data.graves.filter((grave) => grave.cemeteryId === cemeteryScope),
      lots: data.lots.filter((lot) => lot.cemeteryId === cemeteryScope),
      headstones: data.headstones.filter((marker) => marker.cemeteryId === cemeteryScope),
      lotRestrictedAreas: data.lotRestrictedAreas?.filter((area) => area.cemeteryId === cemeteryScope),
    };
  }, [data, cemeteryScope, cemeteries]);
  const localMatches = useMemo(() => searchGraves(data, query, selectedStatuses), [data, query, selectedStatuses]);
  const lotMatches = useMemo(() => searchLots(data, query), [data, query]);
  const matches = useMemo<CemeterySearchMatch[]>(() => [...lotMatches, ...(remoteMatches ?? localMatches)].filter((match) => cemeteryScope === "" || ("lot" in match ? match.lot.cemeteryId : match.grave.cemeteryId) === cemeteryScope), [localMatches, lotMatches, remoteMatches, cemeteryScope]);
  const visibleGraves = useMemo(() => {
    if (cemeteryScope === "" && selectedStatuses.size === allStatuses.length && includesAllStatuses(selectedStatuses)) return data.graves;
    return data.graves.filter((grave) => selectedStatuses.has(grave.status) && (cemeteryScope === "" || grave.cemeteryId === cemeteryScope));
  }, [data.graves, selectedStatuses, cemeteryScope]);
  const isInitialMapFitReady = Boolean(currentUser) && cemeteryScope !== null && !isLoading;
  const initialMapFitCemeteryIds =
    cemeteryScope ? [cemeteryScope] : undefined;
  const searchResultIds = useMemo(() => {
    if (!query.trim()) return new Set<string>();
    return new Set(matches.filter((match): match is SearchMatch => "grave" in match).map((match) => graveSelectionKey(match.grave)));
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
  const selectedCemeteryGraves = useMemo(
    () => (selectedGrave ? data.graves.filter((grave) => grave.cemeteryId === selectedGrave.cemeteryId) : []),
    [data.graves, selectedGrave],
  );
  const selectedLotRestrictedAreas = useMemo(() => {
    if (!selectedLot) return [];
    return (data.lotRestrictedAreas ?? []).filter((area) => area.cemeteryId === selectedLot.cemeteryId && area.lotId === selectedLot.id);
  }, [data.lotRestrictedAreas, selectedLot]);
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
    (hasScopedEditAccess && (selectedGrave || selectedHeadstone) ? (currentUser?.assignedCemeteryIds ?? []).includes((selectedGrave ?? selectedHeadstone)!.cemeteryId) : false);
  const canUpdateSelectedHeadstones =
    currentUser?.role === "admin" ||
    (hasScopedEditAccess && selectedGrave ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedGrave.cemeteryId) : false) ||
    (hasScopedEditAccess && selectedHeadstone ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedHeadstone.cemeteryId) : false);
  const canUpdateSelectedGravesites = canUpdateSelectedHeadstones;
  const canManageSelectedGraveLot =
    currentUser?.role === "admin" ||
    (currentUser?.role === "cemetery-admin" && selectedGrave ? (currentUser.assignedCemeteryIds ?? []).includes(selectedGrave.cemeteryId) : false);
  const canUpdateSelectedBurials = canUpdateSelectedHeadstones;
  const cemeteryScopeLabel = useMemo(() => {
    if (!currentUser) return "Loading cemetery…";
    if (currentUser.role !== "admin") {
      if (cemeteryScope === null) return "Contact your administrator to register one cemetery.";
      return cemeteries.find((cemetery) => cemetery.id === cemeteryScope)?.name ?? "Your registered cemetery";
    }
    const cemeteryNames = [...new Set((data.boundaries ?? (data.boundary ? [data.boundary] : [])).map((boundary) => boundary.properties.name))];
    if (cemeteryNames.length === 0) return "Cemetery records";
    if (cemeteryNames.length === 1) return "1 cemetery";
    return `${cemeteryNames.length} cemeteries`;
  }, [data.boundaries, data.boundary, currentUser, cemeteryScope, cemeteries]);

  const changeCemeteryScope = (id: string) => {
    if (currentUser?.role !== "admin" || !confirmDiscardChanges()) return;
    setAdminCemeteryScope(id);
    setSelectedGrave(undefined);
    setSelectedLot(undefined);
    setSelectedHeadstone(undefined);
    setIsPickingMarkerPoint(false);
    setPickedMarkerPoint(undefined);
    setMobileView("map");
  };

  const toggleStatus = (status: GraveStatus) => {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(status) && next.size > 1) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const selectMatch = (match: CemeterySearchMatch) => {
    setMobileView("details");
    setSelectionVersion((version) => version + 1);
    setSelectedHeadstone(undefined);
    if ("lot" in match) {
      setSelectedGrave(undefined);
      setSelectedLot(match.lot);
      return;
    }
    setSelectedLot(undefined);
    setSelectedGrave(match.grave);
  };

  const selectGrave = (grave: GraveSpaceSummary) => {
    if (!confirmDiscardChanges()) return;
    setMobileView("details");
    setSelectionVersion((version) => version + 1);
    setSelectedHeadstone(undefined);
    setSelectedLot(undefined);
    setSelectedGrave(grave);
  };

  const selectLot = (lot: CemeteryLot) => {
    if (!confirmDiscardChanges()) return;
    setMobileView("details");
    setSelectedHeadstone(undefined);
    setSelectedGrave(undefined);
    setSelectedLot(lot);
  };

  const selectHeadstone = (headstone: HeadstoneSummary) => {
    if (!confirmDiscardChanges()) return;
    setMobileView("details");
    setSelectionVersion((version) => version + 1);
    setSelectedHeadstone(headstone);
    setSelectedLot(undefined);
    setSelectedGrave(undefined);
  };

  const {
    saveHeadstone,
    createHeadstoneForGrave,
    saveHeadstoneRelationship,
    updateSavedHeadstoneRelationship,
    deleteSavedHeadstoneRelationship,
    saveHeadstoneGravesiteRelationship,
    updateSavedHeadstoneGravesiteRelationship,
    deleteSavedHeadstoneGravesiteRelationship,
    saveGraveSpace,
    saveBurial,
    saveGraveFeature,
    updateSavedGraveFeature,
    deleteSavedGraveFeature,
    saveMaintenanceRecord,
    updateSavedMaintenanceRecord,
    saveGravePhoto,
    deletePhoto,
    movePhoto,
    saveOwnershipEvent,
    saveOwner,
    removeOwnershipConnection,
    saveGraveLot,
  } = useRecordMutations({
    selectedGrave,
    selectedHeadstone,
    setSelectedGrave,
    setData,
    setSelectedGraveDetails,
    setSelectedHeadstoneDetails,
    refreshDetails,
  });
  const startMarkerPointPick = () => {
    setMobileView("map");
    setPickedMarkerPoint(undefined);
    setIsPickingMarkerPoint(true);
  };

  const cancelMarkerPointPick = () => {
    setIsPickingMarkerPoint(false);
    setPickedMarkerPoint(undefined);
  };

  const pickMarkerPoint = (point: { latitude: number; longitude: number }) => {
    setMobileView("details");
    setPickedMarkerPoint({ ...point, pickedAt: Date.now() });
    setIsPickingMarkerPoint(false);
  };


  return (
    <ConfirmationProvider>
      <div className="application-workspace">
        <ApplicationHeader
          cemeteryScopeLabel={cemeteryScopeLabel}
          cemeteries={cemeteries}
          cemeteryScope={cemeteryScope ?? ""}
          onCemeteryScopeChange={changeCemeteryScope}
          currentUser={currentUser}
          onOpenReports={() => setIsReportsPanelOpen(true)}
          onOpenControl={() => setIsControlPointCollectorOpen(true)}
          onOpenAdmin={() => setIsAdminPanelOpen(true)}
        />
        <main className="app-shell" data-mobile-view={mobileView}>
          <nav className="mobile-workspace-nav" aria-label="Workspace views">
            {(["search", "map", "details"] as const).map((view) => <button key={view} type="button" aria-pressed={mobileView === view} onClick={() => setMobileView(view)}>{view === "search" ? "Search" : view === "map" ? "Map" : "Details"}</button>)}
          </nav>
          <SearchPanel
            isSearching={isSearching}
            error={searchError}
            onRetry={() => setSearchAttempt((attempt) => attempt + 1)}
            query={query}
            onQueryChange={setQuery}
            selectedStatuses={selectedStatuses}
            onToggleStatus={toggleStatus}
            onResetStatuses={() => setSelectedStatuses(new Set(allStatuses))}
            onOnlyStatus={(status) => setSelectedStatuses(new Set([status]))}
            matches={matches}
            canViewOwnership={currentUser?.permissions.canViewOwnership ?? false}
            selectedGraveKey={selectedGrave ? graveSelectionKey(selectedGrave) : undefined}
            selectedLotKey={selectedLot ? lotSelectionKey(selectedLot) : undefined}
            onSelectMatch={selectMatch}
          />
          <section className={`map-region ${isLoading || loadError || userError ? "has-data-status" : ""}`}>
            <div
              className={`environment-badge environment-${appEnvironment.toLowerCase()}`}
              title={`Version: ${appVersionMetadata.version} (${appVersionMetadata.gitSha})\nBuild: ${appVersionMetadata.buildTime}\nAPI: ${apiBaseUrl}`}
            >
              {appEnvironment}
            </div>

            {isLoading || loadError || userError ? (
              <div className={`data-status ${loadError || userError ? "is-error" : ""}`} role={loadError || userError ? "alert" : "status"}>
                {isLoading && !loadError ? <p>Loading cemetery records...</p> : null}
                {loadError ? <p><strong>Cemetery data API:</strong> {loadError}</p> : null}
                {userError ? <p><strong>Current user API:</strong> {userError}</p> : null}
              </div>
            ) : null}
            <CemeteryMap
              data={mapData}
              selectedGrave={selectedGrave}
              selectedLot={selectedLot}
              selectedHeadstone={selectedHeadstone}
              visibleGraves={visibleGraves}
              searchResultIds={searchResultIds}
              initialFitCemeteryIds={initialMapFitCemeteryIds}
              cemeteryScope={cemeteryScope ?? ""}
              isInitialFitReady={isInitialMapFitReady}
              isPickingMarkerPoint={isPickingMarkerPoint}
              onSelectGrave={selectGrave}
              onSelectLot={selectLot}
              onSelectHeadstone={selectHeadstone}
              onPickMarkerPoint={pickMarkerPoint}
            />
          </section>
          <DetailPanel
            selectionVersion={selectionVersion}
            onSelectHeadstone={selectHeadstone}
            owners={selectedGraveOwners}
            summary={selectedGrave}
            lot={selectedLot}
            lotGraves={selectedLotGraves}
            cemeteryGraves={selectedCemeteryGraves}
            cemeteryLots={data.lots.filter((lot) => !selectedGrave || lot.cemeteryId === selectedGrave.cemeteryId)}
            cemeteryHeadstones={data.headstones.filter((headstone) => !selectedGrave || headstone.cemeteryId === selectedGrave.cemeteryId)}
            lotRestrictedAreas={selectedLotRestrictedAreas}
            grave={selectedGraveDetails}
            standaloneHeadstoneSummary={selectedHeadstone}
            standaloneHeadstone={selectedHeadstoneDetails}
            markerGraves={selectedHeadstoneGraves}
            canViewOwnership={canViewSelectedOwnership}
            canUpdateGravesites={canUpdateSelectedGravesites}
            canManageLotAssignment={canManageSelectedGraveLot}
            canUpdateBurials={canUpdateSelectedBurials}
            canUpdateHeadstones={canUpdateSelectedHeadstones}
            headstoneLookups={headstoneLookups}
            pickedMarkerPoint={pickedMarkerPoint}
            isPickingMarkerPoint={isPickingMarkerPoint}
            onSaveGraveSpace={saveGraveSpace}
            onSaveBurial={saveBurial}
            onSaveHeadstone={saveHeadstone}
            onCreateHeadstone={createHeadstoneForGrave}
            onSaveHeadstoneRelationship={saveHeadstoneRelationship}
            onUpdateHeadstoneRelationship={updateSavedHeadstoneRelationship}
            onDeleteHeadstoneRelationship={deleteSavedHeadstoneRelationship}
            onSaveHeadstoneGravesiteRelationship={saveHeadstoneGravesiteRelationship}
            onUpdateHeadstoneGravesiteRelationship={updateSavedHeadstoneGravesiteRelationship}
            onDeleteHeadstoneGravesiteRelationship={deleteSavedHeadstoneGravesiteRelationship}
            onSaveGraveFeature={saveGraveFeature}
            onUpdateGraveFeature={updateSavedGraveFeature}
            onDeleteGraveFeature={deleteSavedGraveFeature}
            onSaveMaintenanceRecord={saveMaintenanceRecord}
            onUpdateMaintenanceRecord={updateSavedMaintenanceRecord}
            onSaveOwnershipEvent={saveOwnershipEvent}
            onUpdateOwner={saveOwner}
            onRemoveOwnershipConnection={removeOwnershipConnection}
            onUpdateGraveLot={saveGraveLot}
            onSelectLotGrave={selectGrave}
            onSelectMarkerGrave={selectGrave}
            onUploadPhoto={saveGravePhoto}
            onDeletePhoto={deletePhoto}
            onMovePhoto={movePhoto}
            onStartMarkerPointPick={startMarkerPointPick}
            onCancelMarkerPointPick={cancelMarkerPointPick}
            canDeleteGraveFeatures={currentUser?.permissions.canDeleteGraveFeatures ?? false}
            canDeletePhotos={currentUser?.permissions.canDeletePhotos ?? false}
            canReorderPhotos={canUpdateSelectedHeadstones}
            isLoading={isDetailLoading}
            error={detailError}
            onRetry={refreshDetails}
          />
        </main>
        <Suspense fallback={null}>
          {isReportsPanelOpen && currentUser ? <ReportsPanel currentUser={currentUser} data={data} onClose={() => setIsReportsPanelOpen(false)} /> : null}
          {isAdminPanelOpen && currentUser ? <AdminPanel currentUser={currentUser} onClose={() => setIsAdminPanelOpen(false)} /> : null}
          {isControlPointCollectorOpen && currentUser?.permissions.canOpenAdminPanel ? (
            <ControlPointCollector data={data} onClose={() => setIsControlPointCollectorOpen(false)} />
          ) : null}
        </Suspense>
      </div>
    </ConfirmationProvider>
  );
}
