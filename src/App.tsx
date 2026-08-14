import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BarChart3, MapPinned, ShieldCheck } from "lucide-react";
import {
  createOwnershipEvent,
  updateOwner,
  updateGraveLot,
  createGraveFeature,
  createGravesiteHeadstone,
  createHeadstoneRelationship,
  createHeadstoneGravesiteRelationship,
  createMaintenanceRecord,
  deleteHeadstoneRelationship,
  deleteHeadstoneGravesiteRelationship,
  deleteGraveFeature,
  deleteMediaAsset,
  fetchCemeteryData,
  fetchCurrentUser,
  fetchHeadstone,
  fetchHeadstoneLookups,
  fetchSearchMatches,
  updateBurial,
  updateGraveFeature,
  updateGraveSpace,
  updateHeadstone,
  updateHeadstoneRelationship,
  updateHeadstoneGravesiteRelationship,
  updateMaintenanceRecord,
  moveMediaAsset,
  uploadGravePhoto,
  uploadHeadstonePhoto,
} from "./api/cemeteryApi";
import { CemeteryMap } from "./components/CemeteryMap";
import { DetailPanel } from "./components/DetailPanel";
import { SearchPanel } from "./components/SearchPanel";
import { apiBaseUrl, appEnvironment, appVersionMetadata } from "./config/environment";
import { cemeteryData } from "./data/cemeteryData";
import { graveSelectionKey, lotSelectionKey } from "./lib/format";
import { searchGraves, searchLots } from "./lib/search";
import { useSelectedRecordDetails } from "./hooks/useSelectedRecordDetails";
import type {
  Burial,
  CemeterySearchMatch,
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
  SaveGraveFeatureInput,
  SaveHeadstoneInput,
  SaveHeadstoneGravesiteRelationshipInput,
  SaveHeadstoneCreateInput,
  SaveHeadstoneRelationshipInput,
  SaveMaintenanceRecordInput,
  SaveOwnershipEventInput,
  UpdateOwnerInput,
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
  const lotMatches = useMemo(() => searchLots(data, query), [data, query]);
  const matches = useMemo<CemeterySearchMatch[]>(() => [...lotMatches, ...(remoteMatches ?? localMatches)], [localMatches, lotMatches, remoteMatches]);
  const visibleGraves = useMemo(() => {
    if (selectedStatuses.size === allStatuses.length && includesAllStatuses(selectedStatuses)) return data.graves;
    return data.graves.filter((grave) => selectedStatuses.has(grave.status));
  }, [data.graves, selectedStatuses]);
  const isInitialMapFitReady = Boolean(currentUser) && !isLoading;
  const initialMapFitCemeteryIds =
    currentUser && currentUser.role !== "admin" && currentUser.assignedCemeteryIds.length ? currentUser.assignedCemeteryIds : undefined;
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
    (hasScopedEditAccess && selectedGrave ? (currentUser?.assignedCemeteryIds ?? []).includes(selectedGrave.cemeteryId) : false);
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

  const selectMatch = (match: CemeterySearchMatch) => {
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
              markerScopeCode: saved.markerScope.code,
              markerScope: saved.markerScope.label,
              condition: saved.condition.code,
            }
          : candidate,
        ),
    }));
    if (saved.burialNhgPropagation) {
      refreshDetails({ preserveCurrent: true });
    }
    return saved;
  };

  const createHeadstoneForGrave = async (grave: GraveSpace, headstone: SaveHeadstoneCreateInput): Promise<Headstone> => {
    const saved = await createGravesiteHeadstone(grave.cemeteryId, grave.id, headstone);
    setSelectedGraveDetails((current) =>
      current?.id === grave.id
        ? {
            ...current,
            headstones: [...current.headstones, saved],
          }
        : current,
    );
    refreshDetails({ preserveCurrent: true });
    fetchCemeteryData()
      .then((nextData) => setData(nextData))
      .catch(() => undefined);
    return saved;
  };

  const startMarkerPointPick = () => {
    setPickedMarkerPoint(undefined);
    setIsPickingMarkerPoint(true);
  };

  const cancelMarkerPointPick = () => {
    setIsPickingMarkerPoint(false);
    setPickedMarkerPoint(undefined);
  };

  const pickMarkerPoint = (point: { latitude: number; longitude: number }) => {
    setPickedMarkerPoint({ ...point, pickedAt: Date.now() });
    setIsPickingMarkerPoint(false);
  };

  const refreshHeadstoneDetails = async (id: string) => {
    const refreshed = await fetchHeadstone(id);
    setSelectedHeadstoneDetails((current) => (current?.id === refreshed.id ? refreshed : current));
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            headstones: current.headstones.map((candidate) => (candidate.id === refreshed.id ? refreshed : candidate)),
          }
        : current,
    );
    return refreshed;
  };

  const saveHeadstoneRelationship = async (headstoneId: string, relationship: SaveHeadstoneRelationshipInput) => {
    await createHeadstoneRelationship(headstoneId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const updateSavedHeadstoneRelationship = async (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneRelationshipInput) => {
    await updateHeadstoneRelationship(relationshipId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const deleteSavedHeadstoneRelationship = async (headstoneId: string, relationshipId: string, reason?: string) => {
    await deleteHeadstoneRelationship(relationshipId, reason);
    await refreshHeadstoneDetails(headstoneId);
  };

  const saveHeadstoneGravesiteRelationship = async (headstoneId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => {
    await createHeadstoneGravesiteRelationship(headstoneId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const updateSavedHeadstoneGravesiteRelationship = async (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => {
    await updateHeadstoneGravesiteRelationship(relationshipId, relationship);
    return refreshHeadstoneDetails(headstoneId);
  };

  const deleteSavedHeadstoneGravesiteRelationship = async (headstoneId: string, relationshipId: string, reason?: string) => {
    await deleteHeadstoneGravesiteRelationship(relationshipId, reason);
    await refreshHeadstoneDetails(headstoneId);
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

  const saveGraveFeature = async (feature: SaveGraveFeatureInput) => {
    const cemeteryId = selectedGrave?.cemeteryId ?? selectedHeadstone?.cemeteryId;
    if (!cemeteryId) throw new Error("Select a grave site or marker before adding a feature.");
    const saved = await createGraveFeature(cemeteryId, feature);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            features: feature.graveSpaceId ? [...(current.features ?? []), saved] : (current.features ?? []),
            headstones: current.headstones.map((headstone) => (headstone.id === saved.headstoneUuid ? { ...headstone, features: [...(headstone.features ?? []), saved] } : headstone)),
          }
        : current,
    );
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, features: [...(current.features ?? []), saved] };
    });
    return saved;
  };

  const saveMaintenanceRecord = async (record: SaveMaintenanceRecordInput) => {
    const cemeteryId = selectedGrave?.cemeteryId ?? selectedHeadstone?.cemeteryId;
    if (!cemeteryId) throw new Error("Select a grave site or marker before adding maintenance.");
    const saved = await createMaintenanceRecord(cemeteryId, record);
    setSelectedGraveDetails((current) => {
      if (!current) return current;
      return {
        ...current,
        maintenanceRecords: record.graveSpaceId ? [...(current.maintenanceRecords ?? []), saved] : (current.maintenanceRecords ?? []),
        headstones: current.headstones.map((headstone) =>
          headstone.id === saved.headstoneUuid ? { ...headstone, maintenanceRecords: [...(headstone.maintenanceRecords ?? []), saved] } : headstone,
        ),
      };
    });
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, maintenanceRecords: [...(current.maintenanceRecords ?? []), saved] };
    });
    return saved;
  };

  const updateSavedGraveFeature = async (id: string, feature: SaveGraveFeatureInput) => {
    const saved = await updateGraveFeature(id, feature);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            features: (current.features ?? []).map((currentFeature) => (currentFeature.id === saved.id ? saved : currentFeature)),
            headstones: current.headstones.map((headstone) =>
              headstone.id === saved.headstoneUuid
                ? { ...headstone, features: (headstone.features ?? []).map((currentFeature) => (currentFeature.id === saved.id ? saved : currentFeature)) }
                : headstone,
            ),
          }
        : current,
    );
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, features: (current.features ?? []).map((currentFeature) => (currentFeature.id === saved.id ? saved : currentFeature)) };
    });
    return saved;
  };

  const deleteSavedGraveFeature = async (id: string, reason?: string) => {
    await deleteGraveFeature(id, reason);
    refreshDetails({ preserveCurrent: true });
  };

  const updateSavedMaintenanceRecord = async (id: string, record: SaveMaintenanceRecordInput) => {
    const saved = await updateMaintenanceRecord(id, record);
    setSelectedGraveDetails((current) =>
      current
        ? {
            ...current,
            maintenanceRecords: (current.maintenanceRecords ?? []).map((currentRecord) => (currentRecord.id === saved.id ? saved : currentRecord)),
            headstones: current.headstones.map((headstone) =>
              headstone.id === saved.headstoneUuid
                ? { ...headstone, maintenanceRecords: (headstone.maintenanceRecords ?? []).map((currentRecord) => (currentRecord.id === saved.id ? saved : currentRecord)) }
                : headstone,
            ),
          }
        : current,
    );
    setSelectedHeadstoneDetails((current) => {
      if (!current || current.id !== saved.headstoneUuid) return current;
      return { ...current, maintenanceRecords: (current.maintenanceRecords ?? []).map((currentRecord) => (currentRecord.id === saved.id ? saved : currentRecord)) };
    });
    return saved;
  };

  const saveGravePhoto = async ({ file, headstoneId, notes, capturedAt }: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => {
    const source = /iPhone|iPad|iPod/u.test(navigator.userAgent) ? "iphone" : "field_upload";
    if (selectedGrave) {
      await uploadGravePhoto({
        cemeteryId: selectedGrave.cemeteryId,
        graveSpaceId: selectedGrave.id,
        file,
        headstoneId,
        notes,
        capturedAt,
        source,
      });
    } else if (selectedHeadstone) {
      await uploadHeadstonePhoto({
        cemeteryId: selectedHeadstone.cemeteryId,
        headstoneId: selectedHeadstone.id,
        file,
        notes,
        capturedAt,
        source,
      });
    } else {
      throw new Error("Select a grave site or marker before uploading a photo.");
    }
    refreshDetails({ preserveCurrent: true });
  };

  const deletePhoto = async (assetId: string, reason?: string) => {
    await deleteMediaAsset(assetId, reason);
    refreshDetails({ preserveCurrent: true });
  };

  const movePhoto = async (asset: { id: string; mediaLinkId?: string; mediaLinkType?: "headstone" | "gravesite" }, direction: "earlier" | "later") => {
    if (!asset.mediaLinkId || !asset.mediaLinkType) throw new Error("Photo link information is missing.");
    await moveMediaAsset({
      id: asset.id,
      linkId: asset.mediaLinkId,
      linkType: asset.mediaLinkType,
      direction,
    });
    refreshDetails({ preserveCurrent: true });
  };

  const saveOwnershipEvent = async (event: SaveOwnershipEventInput) => {
    if (!selectedGrave) throw new Error("Select a grave site before recording ownership.");
    await createOwnershipEvent(selectedGrave.cemeteryId, selectedGrave.id, event);
    refreshDetails();
  };

  const saveOwner = async (partyId: string, eventId: string, owner: UpdateOwnerInput) => {
    await updateOwner(partyId, eventId, owner);
    refreshDetails();
  };

  const saveGraveLot = async (lotId: string) => {
    if (!selectedGrave) throw new Error("Select a gravesite before assigning a lot.");
    await updateGraveLot(selectedGrave.cemeteryId, selectedGrave.id, lotId);
    const nextData = await fetchCemeteryData();
    setData(nextData);
    setSelectedGrave((current) => current ? nextData.graves.find((grave) => graveSelectionKey(grave) === graveSelectionKey(current)) : undefined);
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
        selectedLotKey={selectedLot ? lotSelectionKey(selectedLot) : undefined}
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
        <Suspense fallback={null}>
          {isReportsPanelOpen && currentUser ? <ReportsPanel currentUser={currentUser} data={data} onClose={() => setIsReportsPanelOpen(false)} /> : null}
          {isAdminPanelOpen && currentUser ? <AdminPanel currentUser={currentUser} onClose={() => setIsAdminPanelOpen(false)} /> : null}
          {isControlPointCollectorOpen && currentUser?.permissions.canOpenAdminPanel ? (
            <ControlPointCollector data={data} onClose={() => setIsControlPointCollectorOpen(false)} />
          ) : null}
        </Suspense>
        {isLoading || loadError || userError ? (
          <div className={`data-status ${loadError || userError ? "is-error" : ""}`} role={loadError || userError ? "alert" : "status"}>
            {isLoading && !loadError ? <p>Loading cemetery records...</p> : null}
            {loadError ? <p><strong>Cemetery data API:</strong> {loadError}</p> : null}
            {userError ? <p><strong>Current user API:</strong> {userError}</p> : null}
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
          isPickingMarkerPoint={isPickingMarkerPoint}
          onSelectGrave={selectGrave}
          onSelectLot={selectLot}
          onSelectHeadstone={selectHeadstone}
          onPickMarkerPoint={pickMarkerPoint}
        />
      </section>
      <DetailPanel
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
  );
}
