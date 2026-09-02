import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileText, Flag, History, Images, Info, Landmark, Link2, MapPinned, Pencil, UserRound } from "lucide-react";
import type {
  AreaGeometry,
  Burial,
  CemeteryLot,
  GraveSpace,
  GraveFeature,
  GraveSpaceSummary,
  GraveStatus,
  Headstone,
  HeadstoneLookups,
  HeadstoneSummary,
  LotRestrictedArea,
  LookupOption,
  MaintenanceRecord,
  MediaAsset,
  NorthHillsLinkedEvidence,
  Owner,
  SaveBurialInput,
  SaveGraveSpaceInput,
  SaveGraveFeatureInput,
  SaveHeadstoneCreateInput,
  SaveHeadstoneGravesiteRelationshipInput,
  SaveHeadstoneInput,
  SaveHeadstoneRelationshipInput,
  SaveMaintenanceRecordInput,
  SaveOwnershipEventInput,
  UpdateOwnerInput,
  GeometryConfidence,
  GeometryType,
  GeographicPlaceCandidate,
  VerifiedPlace,
} from "../types";
import { importVerifiedPlace, searchGeographicPlaces } from "../api/cemeteryApi";
import { burialNoteItems } from "../lib/burialNotes";
import { formatDate, formatGraveLabel, fullName, geometryConfidenceLabels, geometryTypeLabels } from "../lib/format";
import { MediaGallery, PhotoUploadForm } from "./detail/MediaRecords";
import { OwnerRecord, OwnershipEventForm } from "./detail/OwnershipRecords";
import { GraveFeatureForm, GraveFeatureList } from "./detail/GraveFeatureRecords";
import { MaintenanceRecordForm, MaintenanceRecordList } from "./detail/MaintenanceRecords";
import { MarkerRelationshipForm, MarkerRelationshipList } from "./detail/MarkerRelationshipRecords";
import { AssociatedGravesiteList, MarkerGravesiteRelationshipManager } from "./detail/MarkerGravesiteRecords";

type DetailPanelProps = {
  owners: Owner[];
  summary?: GraveSpaceSummary;
  lot?: CemeteryLot;
  lotGraves?: GraveSpaceSummary[];
  cemeteryGraves?: GraveSpaceSummary[];
  cemeteryLots?: CemeteryLot[];
  cemeteryHeadstones?: HeadstoneSummary[];
  lotRestrictedAreas?: LotRestrictedArea[];
  grave?: GraveSpace;
  standaloneHeadstoneSummary?: HeadstoneSummary;
  standaloneHeadstone?: Headstone;
  markerGraves?: GraveSpaceSummary[];
  canViewOwnership: boolean;
  canUpdateGravesites: boolean;
  canManageLotAssignment: boolean;
  canUpdateBurials: boolean;
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  pickedMarkerPoint?: PickedMarkerPoint;
  isPickingMarkerPoint: boolean;
  onSaveGraveSpace: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onSaveBurial: (id: string, burial: SaveBurialInput) => Promise<Burial>;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onCreateHeadstone: (grave: GraveSpace, headstone: SaveHeadstoneCreateInput) => Promise<Headstone>;
  onSaveHeadstoneRelationship: (headstoneId: string, relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
  onUpdateHeadstoneRelationship: (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
  onDeleteHeadstoneRelationship: (headstoneId: string, relationshipId: string, reason?: string) => Promise<void>;
  onSaveHeadstoneGravesiteRelationship: (headstoneId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onUpdateHeadstoneGravesiteRelationship: (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onDeleteHeadstoneGravesiteRelationship: (headstoneId: string, relationshipId: string, reason?: string) => Promise<void>;
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSaveOwnershipEvent: (event: SaveOwnershipEventInput) => Promise<void>;
  onUpdateOwner: (partyId: string, eventId: string, owner: UpdateOwnerInput) => Promise<void>;
  onRemoveOwnershipConnection: (rightId: string) => Promise<void>;
  onUpdateGraveLot: (lotId: string) => Promise<void>;
  onSelectLotGrave: (grave: GraveSpaceSummary) => void;
  onSelectMarkerGrave: (grave: GraveSpaceSummary) => void;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  onStartMarkerPointPick: () => void;
  onCancelMarkerPointPick: () => void;
  canDeleteGraveFeatures: boolean;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

type PickedMarkerPoint = {
  latitude: number;
  longitude: number;
  pickedAt: number;
};

function GeometryMetadataList({
  type,
  source,
  confidence,
  notes,
}: {
  type?: GeometryType;
  source?: string;
  confidence?: GeometryConfidence;
  notes?: string;
}) {
  const geometryType = type ?? "operational";
  const geometryConfidence = confidence ?? "estimated";

  return (
    <dl className="geometry-metadata">
      <div>
        <dt>Geometry type</dt>
        <dd>{geometryTypeLabels[geometryType]}</dd>
      </div>
      <div>
        <dt>Confidence</dt>
        <dd>{geometryConfidenceLabels[geometryConfidence]}</dd>
      </div>
      <div>
        <dt>Source</dt>
        <dd>{source || "Not recorded"}</dd>
      </div>
      <div>
        <dt>Review notes</dt>
        <dd>{notes || "None"}</dd>
      </div>
    </dl>
  );
}

const ownerName = (ownersById: Map<string, Owner>, ownerId: string) => ownersById.get(ownerId)?.displayName ?? "Unknown owner";
const graveStatusOptions: { value: GraveStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "occupied", label: "Occupied" },
  { value: "sold", label: "Sold" },
  { value: "needs_review", label: "Needs review" },
  { value: "unknown", label: "Unknown" },
];

function pointInRing([x, y]: GeoJSON.Position, ring: GeoJSON.Position[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInArea(point: GeoJSON.Position, geometry: AreaGeometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => pointInRing(point, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(point, hole)));
}

function areaCenter(geometry: AreaGeometry): GeoJSON.Position | undefined {
  const ring = geometry.type === "Polygon" ? geometry.coordinates[0] : geometry.coordinates[0]?.[0];
  if (!ring?.length) return undefined;
  const points = ring.slice(0, -1);
  return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length];
}

function inferredLotForGrave(grave: GraveSpace, lots: CemeteryLot[], headstones: HeadstoneSummary[]) {
  if (grave.lot) return undefined;
  const markerPoints = headstones.filter((marker) => marker.gravesiteId === grave.id).map((marker) => marker.geometry.coordinates);
  const markerMatches = lots.filter((lot) => markerPoints.some((point) => pointInArea(point, lot.geometry)));
  if (markerMatches.length === 1) return { lot: markerMatches[0], source: "marker location", confidence: "high" as const };
  const center = areaCenter(grave.geometry);
  const graveMatches = center ? lots.filter((lot) => pointInArea(center, lot.geometry)) : [];
  if (graveMatches.length === 1) return { lot: graveMatches[0], source: "gravesite center", confidence: "review" as const };
  return undefined;
}

const headstoneRelationshipCopy: Record<string, { label: string; description: string }> = {
  primary: {
    label: "Primary marker for this gravesite",
    description: "This is the normal marker relationship: the marker belongs primarily to this gravesite.",
  },
  spans: {
    label: "Marker spans multiple gravesites",
    description: "One physical marker or headstone is shared by this gravesite and at least one neighboring gravesite, such as a two-person headstone centered between burial spaces.",
  },
  nearby: {
    label: "Marker is nearby",
    description: "The marker is near this gravesite, but the exact relationship is not confirmed.",
  },
  inferred: {
    label: "Marker relationship inferred",
    description: "The marker relationship was inferred from imported records, location, or other available evidence and may need field confirmation.",
  },
  footstone: {
    label: "Footstone for this gravesite",
    description: "A smaller secondary marker is placed at the foot of this gravesite.",
  },
  secondary: {
    label: "Secondary marker for this gravesite",
    description: "A second marker belongs to this gravesite, separate from the primary headstone or monument.",
  },
};


function headstoneRelationshipDetails(relationshipType: string) {
  return (
    headstoneRelationshipCopy[relationshipType] ?? {
      label: `Marker relationship: ${relationshipType}`,
      description: "This marker has a non-standard relationship to the selected gravesite.",
    }
  );
}

function blankBurialForm(burial: Burial): SaveBurialInput {
  return {
    firstName: burial.person.firstName,
    lastName: burial.person.lastName === "Unknown" ? "" : burial.person.lastName,
    maidenName: burial.person.maidenName ?? "",
    nameSuffix: burial.person.nameSuffix ?? "",
    birthDate: burial.person.birthDate ?? "",
    deathDate: burial.person.deathDate ?? "",
    deathPlaceId: burial.deathPlace?.id ?? "",
    burialDate: burial.burialDate ?? "",
    intermentType: burial.intermentType ?? "unknown",
    recordStatusCode: burial.recordStatusCode ?? "interred",
    funeralHome: burial.funeralHome ?? "",
    sourceUrl: burial.sourceUrl ?? "",
    veteran: burial.veteran ?? false,
    militaryBranchCode: burial.militaryBranchCode ?? "",
    militaryRankCode: burial.militaryRankCode ?? "",
    militaryWarServiceCode: burial.militaryWarServiceCode ?? "",
    militaryDecorationCodes: (burial.militaryDecorations ?? []).map((decoration) => decoration.code),
    militaryEnlistedDate: burial.militaryEnlistedDate ?? "",
    militaryDischargedDate: burial.militaryDischargedDate ?? "",
    notes: burial.recordNotes ?? "",
    dataConfidence: burial.dataConfidence ?? "unknown",
    reviewStatus: burial.reviewStatus ?? "unreviewed",
    reviewNotes: burial.reviewNotes ?? "",
    sourceConflict: burial.sourceConflict ?? false,
    reason: "Burial detail update",
  };
}

function militaryServiceText(burial: Burial) {
  const rankLabel =
    burial.militaryRankAbbreviation && burial.militaryRank
      ? `${burial.militaryRankAbbreviation} (${burial.militaryRank})`
      : burial.militaryRankAbbreviation || burial.militaryRank;
  const details = [rankLabel, burial.militaryBranch, burial.militaryWars].filter(Boolean).join(" | ");
  return details;
}

function intermentTypeOptions(lookups: HeadstoneLookups) {
  return lookups.intermentTypes.length
    ? lookups.intermentTypes
    : [
        { id: "legacy-casket", code: "casket", label: "Casket" },
        { id: "legacy-urn", code: "urn", label: "Funeral urn" },
        { id: "legacy-unknown", code: "unknown", label: "Unknown or not applicable" },
      ];
}

function burialRecordStatusOptions(lookups: HeadstoneLookups) {
  return lookups.burialRecordStatuses?.length
    ? lookups.burialRecordStatuses
    : [{ id: "legacy-interred", code: "interred", label: "Interred" }];
}

const dataConfidenceOptions = [
  { value: "unknown", label: "Unknown" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

const reviewStatusOptions = [
  { value: "unreviewed", label: "Unreviewed" },
  { value: "needs_review", label: "Needs review" },
  { value: "reviewed", label: "Reviewed" },
  { value: "conflict", label: "Source conflict" },
] as const;

function dataConfidenceLabel(value?: string) {
  return dataConfidenceOptions.find((option) => option.value === value)?.label ?? "Unknown";
}

function reviewStatusLabel(value?: string) {
  return reviewStatusOptions.find((option) => option.value === value)?.label ?? "Unreviewed";
}

function ReviewBadgeGroup({
  dataConfidence,
  reviewStatus,
  sourceConflict,
  reviewNotes,
}: {
  dataConfidence?: string;
  reviewStatus?: string;
  sourceConflict?: boolean;
  reviewNotes?: string;
}) {
  const shouldShow = dataConfidence === "low" || dataConfidence === "medium" || reviewStatus === "needs_review" || reviewStatus === "conflict" || sourceConflict || Boolean(reviewNotes);
  if (!shouldShow) return null;

  return (
    <div className="record-review-badges" aria-label="Data review status">
      {dataConfidence && dataConfidence !== "unknown" ? <span className={`record-review-badge confidence-${dataConfidence}`}>{dataConfidenceLabel(dataConfidence)} confidence</span> : null}
      {reviewStatus && reviewStatus !== "unreviewed" ? <span className={`record-review-badge review-${reviewStatus}`}>{reviewStatusLabel(reviewStatus)}</span> : null}
      {sourceConflict ? <span className="record-review-badge review-conflict">Source conflict</span> : null}
      {reviewNotes ? <p>{reviewNotes}</p> : null}
    </div>
  );
}

function BurialRecord({
  burial,
  canUpdate,
  lookups,
  onSave,
}: {
  burial: Burial;
  canUpdate: boolean;
  lookups: HeadstoneLookups;
  onSave: (id: string, burial: SaveBurialInput) => Promise<Burial>;
}) {
  const noteItems = burialNoteItems(burial.notes);
  const serviceText = militaryServiceText(burial);
  const intermentOptions = intermentTypeOptions(lookups);
  const recordStatusOptions = burialRecordStatusOptions(lookups);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveBurialInput>(() => blankBurialForm(burial));
  const militaryRankOptions = lookups.militaryRanks.filter((option) => option.militaryBranchCode === form.militaryBranchCode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeCandidates, setPlaceCandidates] = useState<GeographicPlaceCandidate[]>([]);
  const [placeSearchMessage, setPlaceSearchMessage] = useState<string>();
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isImportingPlace, setIsImportingPlace] = useState(false);
  const [importedPlace, setImportedPlace] = useState<VerifiedPlace>();

  const startEditing = () => {
    setForm(blankBurialForm(burial));
    setError(undefined);
    setPlaceQuery("");
    setPlaceCandidates([]);
    setPlaceSearchMessage(undefined);
    setImportedPlace(undefined);
    setIsEditing(true);
  };

  const searchPlaces = async () => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      setPlaceCandidates([]);
      setPlaceSearchMessage("Enter at least two characters to search.");
      return;
    }
    setIsSearchingPlaces(true);
    setPlaceSearchMessage(undefined);
    try {
      const response = await searchGeographicPlaces(query);
      setPlaceCandidates(response.results);
      setPlaceSearchMessage(response.available ? (response.results.length ? undefined : "No matching places found.") : response.message);
    } catch {
      setPlaceCandidates([]);
      setPlaceSearchMessage("Geographic search is temporarily unavailable. Existing verified places remain available.");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const choosePlace = async (candidate: GeographicPlaceCandidate) => {
    setIsImportingPlace(true);
    setPlaceSearchMessage(undefined);
    try {
      const place = await importVerifiedPlace(candidate);
      setImportedPlace(place);
      setForm((current) => ({ ...current, deathPlaceId: place.id }));
      setPlaceCandidates([]);
      setPlaceSearchMessage(`${place.displayName} is verified and selected.`);
    } catch {
      setPlaceSearchMessage("That place could not be verified right now. Existing verified places remain available.");
    } finally {
      setIsImportingPlace(false);
    }
  };

  const setVeteran = (isVeteran: boolean) => {
    setForm((current) => ({
      ...current,
      veteran: isVeteran,
      militaryBranchCode: isVeteran ? current.militaryBranchCode : "",
      militaryRankCode: isVeteran ? current.militaryRankCode : "",
      militaryWarServiceCode: isVeteran ? current.militaryWarServiceCode : "",
      militaryDecorationCodes: isVeteran ? current.militaryDecorationCodes : [],
      militaryEnlistedDate: isVeteran ? current.militaryEnlistedDate : "",
      militaryDischargedDate: isVeteran ? current.militaryDischargedDate : "",
    }));
  };

  const setMilitaryBranch = (militaryBranchCode: string) => {
    setForm((current) => {
      const selectedRank = lookups.militaryRanks.find((option) => option.code === current.militaryRankCode && option.militaryBranchCode === militaryBranchCode);
      return {
        ...current,
        militaryBranchCode,
        militaryRankCode: selectedRank ? current.militaryRankCode : "",
      };
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    try {
      await onSave(burial.id, form);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save burial.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <form className="burial-record burial-form" onSubmit={(event) => void save(event)}>
        <label>
          First name
          <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
        </label>
        <label>
          Last name
          <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
        </label>
        <label>
          Maiden name
          <input value={form.maidenName} onChange={(event) => setForm((current) => ({ ...current, maidenName: event.target.value }))} />
        </label>
        <label>
          Title / credentials
          <input
            value={form.nameSuffix}
            placeholder="M.D., Ph.D., Jr."
            onChange={(event) => setForm((current) => ({ ...current, nameSuffix: event.target.value }))}
          />
        </label>
        <label>
          Birth date
          <input value={form.birthDate} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} />
        </label>
        <label>
          Death date
          <input value={form.deathDate} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, deathDate: event.target.value }))} />
        </label>
        <label className="burial-wide-field">
          Death location
          <select value={form.deathPlaceId} onChange={(event) => setForm((current) => ({ ...current, deathPlaceId: event.target.value }))}>
            <option value="">Unknown / not recorded</option>
            {lookups.verifiedPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label}
              </option>
            ))}
            {importedPlace && !lookups.verifiedPlaces.some((place) => place.id === importedPlace.id) ? (
              <option value={importedPlace.id}>{importedPlace.displayName}</option>
            ) : null}
          </select>
          <small>Only places verified against an authoritative geographic registry are available.</small>
        </label>
        <div className="burial-wide-field">
          <label>
            Find another verified death location
            <input
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="City, state, or country"
              disabled={isSearchingPlaces || isImportingPlace}
            />
          </label>
          <button type="button" className="secondary-button" onClick={() => void searchPlaces()} disabled={isSearchingPlaces || isImportingPlace || placeQuery.trim().length < 2}>
            {isSearchingPlaces ? "Searching..." : "Search geographic registry"}
          </button>
          {placeSearchMessage ? <p className="detail-message" role="status">{placeSearchMessage}</p> : null}
          {placeCandidates.length ? (
            <ul className="burial-notes" aria-label="Geographic search results">
              {placeCandidates.map((candidate) => (
                <li key={`${candidate.provider}-${candidate.providerId}`}>
                  <button type="button" className="secondary-button" onClick={() => void choosePlace(candidate)} disabled={isImportingPlace}>
                    Use {candidate.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <label>
          Burial date
          <input type="date" value={form.burialDate} onChange={(event) => setForm((current) => ({ ...current, burialDate: event.target.value }))} />
        </label>
        <label>
          Interment
          <select value={form.intermentType} onChange={(event) => setForm((current) => ({ ...current, intermentType: event.target.value }))}>
            {intermentOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Record status
          <select value={form.recordStatusCode} onChange={(event) => setForm((current) => ({ ...current, recordStatusCode: event.target.value }))}>
            {recordStatusOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="burial-wide-field">
          Funeral home
          <input value={form.funeralHome} onChange={(event) => setForm((current) => ({ ...current, funeralHome: event.target.value }))} />
        </label>
        <label className="burial-wide-field">
          Information source URL
          <input
            type="url"
            value={form.sourceUrl}
            placeholder="https://www.findagrave.com/memorial/..."
            onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
          />
          <small>Optional web page supporting information recorded for this person.</small>
        </label>
        <label className="burial-checkbox-field">
          <input type="checkbox" checked={form.veteran} onChange={(event) => setVeteran(event.target.checked)} />
          Veteran
        </label>
        <label>
          Military branch
          <select value={form.militaryBranchCode} onChange={(event) => setMilitaryBranch(event.target.value)} disabled={!form.veteran}>
            <option value="">Unknown / not recorded</option>
            {lookups.militaryBranches.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rank
          <select
            value={form.militaryRankCode}
            onChange={(event) => setForm((current) => ({ ...current, militaryRankCode: event.target.value }))}
            disabled={!form.veteran || !form.militaryBranchCode}
          >
            <option value="">Unknown / not recorded</option>
            {militaryRankOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.abbreviation ? `${option.abbreviation} - ${option.label}${option.payGrade ? ` (${option.payGrade})` : ""}` : option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          War service
          <select
            value={form.militaryWarServiceCode}
            onChange={(event) => setForm((current) => ({ ...current, militaryWarServiceCode: event.target.value }))}
            disabled={!form.veteran}
          >
            <option value="">Unknown / not recorded</option>
            {lookups.militaryWarServices.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="burial-wide-field burial-decoration-field" disabled={!form.veteran}>
          <legend>Military decorations</legend>
          {lookups.militaryDecorations.map((decoration) => (
            <label key={decoration.id} className="burial-checkbox-field">
              <input
                type="checkbox"
                checked={form.militaryDecorationCodes.includes(decoration.code)}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  militaryDecorationCodes: event.target.checked
                    ? [...current.militaryDecorationCodes, decoration.code]
                    : current.militaryDecorationCodes.filter((code) => code !== decoration.code),
                }))}
              />
              {decoration.label}
            </label>
          ))}
        </fieldset>
        {form.veteran ? (
          <>
            <label>
              Enlisted date
              <input
                type="date"
                value={form.militaryEnlistedDate}
                onChange={(event) => setForm((current) => ({ ...current, militaryEnlistedDate: event.target.value }))}
              />
            </label>
            <label>
              Discharged date
              <input
                type="date"
                value={form.militaryDischargedDate}
                min={form.militaryEnlistedDate || undefined}
                onChange={(event) => setForm((current) => ({ ...current, militaryDischargedDate: event.target.value }))}
              />
            </label>
          </>
        ) : null}
        <label className="burial-wide-field">
          Notes
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
        </label>
        <label>
          Data confidence
          <select value={form.dataConfidence} onChange={(event) => setForm((current) => ({ ...current, dataConfidence: event.target.value as SaveBurialInput["dataConfidence"] }))}>
            {dataConfidenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review status
          <select value={form.reviewStatus} onChange={(event) => setForm((current) => ({ ...current, reviewStatus: event.target.value as SaveBurialInput["reviewStatus"] }))}>
            {reviewStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="burial-checkbox-field">
          <input type="checkbox" checked={form.sourceConflict} onChange={(event) => setForm((current) => ({ ...current, sourceConflict: event.target.checked }))} />
          Source conflict
        </label>
        <label className="burial-wide-field">
          Review notes
          <textarea value={form.reviewNotes} onChange={(event) => setForm((current) => ({ ...current, reviewNotes: event.target.value }))} rows={3} />
        </label>
        {error ? <p className="detail-message is-error">{error}</p> : null}
        <div className="burial-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save burial"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="burial-record">
      <div className="burial-record-header">
        <strong>{fullName(burial.person)}</strong>
        {canUpdate ? (
          <button type="button" className="icon-text-button" onClick={startEditing} aria-label={`Edit burial ${fullName(burial.person)}`}>
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>
      <dl>
        <div>
          <dt>Born</dt>
          <dd>{formatDate(burial.person.birthDate)}</dd>
        </div>
        <div>
          <dt>Died</dt>
          <dd>{formatDate(burial.person.deathDate)}</dd>
        </div>
        {burial.deathPlace ? (
          <div>
            <dt>Death location</dt>
            <dd>
              <a href={burial.deathPlace.authorityUrl} target="_blank" rel="noreferrer">
                {burial.deathPlace.displayName}
              </a>{" "}
              <span title={`${burial.deathPlace.authorityName}: ${burial.deathPlace.authorityIdentifier}`}>Verified</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Buried</dt>
          <dd>{formatDate(burial.burialDate)}</dd>
        </div>
        <div>
          <dt>Interment</dt>
          <dd>{burial.intermentTypeLabel ?? intermentOptions.find((option) => option.code === burial.intermentType)?.label ?? "Casket"}</dd>
        </div>
        <div>
          <dt>Record</dt>
          <dd>{burial.recordStatusLabel ?? recordStatusOptions.find((option) => option.code === burial.recordStatusCode)?.label ?? "Interred"}</dd>
        </div>
      </dl>
      {burial.sourceUrl ? (
        <p className="burial-source-link">
          <a href={burial.sourceUrl} target="_blank" rel="noreferrer">View information source</a>
        </p>
      ) : null}
      {burial.veteran || serviceText || burial.militaryDecorations?.length ? (
        <p className="burial-service">
          {burial.veteran ? <span className="burial-veteran-badge">Veteran</span> : null}
          {(burial.militaryDecorations ?? []).map((decoration) => (
            <span key={decoration.id} className={decoration.code === "purple_heart" ? "burial-decoration-badge is-purple-heart" : "burial-decoration-badge"}>
              {decoration.label}
            </span>
          ))}
          {serviceText ? <span>{serviceText}</span> : null}
          {burial.militaryEnlistedDate ? <span>Enlisted {formatDate(burial.militaryEnlistedDate)}</span> : null}
          {burial.militaryDischargedDate ? <span>Discharged {formatDate(burial.militaryDischargedDate)}</span> : null}
        </p>
      ) : null}
      <ReviewBadgeGroup dataConfidence={burial.dataConfidence} reviewStatus={burial.reviewStatus} sourceConflict={burial.sourceConflict} reviewNotes={burial.reviewNotes} />
      {noteItems.length ? (
        <ul className="burial-notes">
          {noteItems.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function blankGraveSpaceForm(grave: GraveSpace): SaveGraveSpaceInput {
  return {
    name: grave.name,
    status: grave.status,
    cost: grave.cost === undefined ? "" : String(grave.cost),
    reason: "Gravesite detail update",
  };
}

function GraveSpaceRecord({ grave, lots, inferredLot, canUpdate, canManageLot, onSave, onUpdateLot }: {
  grave: GraveSpace;
  lots: CemeteryLot[];
  inferredLot?: { lot: CemeteryLot; source: string; confidence: "high" | "review" };
  canUpdate: boolean;
  canManageLot: boolean;
  onSave: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onUpdateLot: (lotId: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveGraveSpaceInput>(() => blankGraveSpaceForm(grave));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [lotValue, setLotValue] = useState(grave.lot);
  const [isSavingLot, setIsSavingLot] = useState(false);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);

  const startEditing = () => {
    setForm(blankGraveSpaceForm(grave));
    setError(undefined);
    setIsEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    try {
      await onSave(form);
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save gravesite.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveLot = async (nextLotId: string) => {
    setIsSavingLot(true);
    setError(undefined);
    try {
      await onUpdateLot(nextLotId);
      setLotValue(nextLotId);
      setIsConfirmingUnlink(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update lot assignment.");
    } finally {
      setIsSavingLot(false);
    }
  };

  if (isEditing) {
    return (
      <form className="grave-record grave-form" onSubmit={(event) => void save(event)}>
        <label className="grave-wide-field">
          Name
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label>
          Status
          <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as GraveStatus }))}>
            {graveStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cost
          <input inputMode="decimal" value={form.cost} onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))} />
        </label>
        {error ? <p className="detail-message is-error">{error}</p> : null}
        <div className="grave-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save gravesite"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <article className="grave-record">
      <div className="grave-record-header">
        <strong>{grave.name || formatGraveLabel(grave)}</strong>
        {canUpdate ? (
          <button type="button" className="icon-text-button" onClick={startEditing} aria-label={`Edit gravesite ${formatGraveLabel(grave)}`}>
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>
      <dl>
        <div>
          <dt>Record ID</dt>
          <dd>{grave.id}</dd>
        </div>
        <div>
          <dt>Section</dt>
          <dd>{grave.section || "Unknown"}</dd>
        </div>
        <div>
          <dt>Lot</dt>
          <dd>{grave.lot || "Unknown"}</dd>
        </div>
        <div>
          <dt>Space</dt>
          <dd>{grave.space || "Unknown"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{graveStatusOptions.find((option) => option.value === grave.status)?.label ?? "Unknown"}</dd>
        </div>
        {grave.cost !== undefined ? (
          <div>
            <dt>Cost</dt>
            <dd>${grave.cost.toFixed(2)}</dd>
          </div>
        ) : null}
      </dl>
      {!grave.lot && inferredLot ? (
        <p className="inferred-lot-note"><strong>Suggested lot {inferredLot.lot.id}</strong> — inferred from {inferredLot.source}. Review against the paper map before assigning.</p>
      ) : null}
      {canManageLot ? (
        <div className="grave-lot-assignment">
          <label>
            Assigned lot
            <select value={lotValue} onChange={(event) => setLotValue(event.target.value)}>
              <option value="">No assigned lot</option>
              {lots.slice().sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map((lot) => <option key={lot.id} value={lot.id}>{lot.section ? `${lot.section}-${lot.id}` : lot.id}</option>)}
            </select>
          </label>
          {inferredLot && !grave.lot ? <button type="button" className="secondary-button" onClick={() => setLotValue(inferredLot.lot.id)}>Use suggested lot</button> : null}
          <button type="button" disabled={isSavingLot || lotValue === grave.lot} onClick={() => void saveLot(lotValue)}>{isSavingLot ? "Saving..." : "Save lot assignment"}</button>
          {grave.lot && !isConfirmingUnlink ? (
            <button type="button" className="text-button grave-lot-unlink" disabled={isSavingLot} onClick={() => setIsConfirmingUnlink(true)}>Unlink from lot {grave.lot}</button>
          ) : null}
          {isConfirmingUnlink ? (
            <div className="grave-lot-unlink-confirmation">
              <p>This removes the explicit lot assignment. A spatially inferred suggestion may still appear for review.</p>
              <div><button type="button" className="secondary-button" onClick={() => setIsConfirmingUnlink(false)} disabled={isSavingLot}>Cancel</button><button type="button" className="danger-button" onClick={() => void saveLot("")} disabled={isSavingLot}>{isSavingLot ? "Unlinking..." : "Confirm unlink"}</button></div>
            </div>
          ) : null}
        </div>
      ) : null}
      {error && !isEditing ? <p className="detail-message is-error">{error}</p> : null}
    </article>
  );
}

function GraveGeometryMetadata({ grave }: { grave: GraveSpace }) {
  return (
    <div className="grave-record">
      <section className="geometry-metadata-group" aria-label="Gravesite geometry metadata">
        <h4>Gravesite geometry</h4>
        <GeometryMetadataList type={grave.geometryType} source={grave.geometrySource} confidence={grave.geometryConfidence} notes={grave.geometryNotes} />
      </section>
      {grave.lot ? (
        <section className="geometry-metadata-group" aria-label="Lot geometry metadata">
          <h4>Lot geometry</h4>
          <GeometryMetadataList type={grave.lotGeometryType} source={grave.lotGeometrySource} confidence={grave.lotGeometryConfidence} notes={grave.lotGeometryNotes} />
        </section>
      ) : null}
    </div>
  );
}

function northHillsLocation(evidence: NorthHillsLinkedEvidence) {
  return [
    evidence.sourcePageNumber ? `page ${evidence.sourcePageNumber}` : undefined,
    evidence.parsedSectionName ? `Section ${evidence.parsedSectionName}` : undefined,
    evidence.parsedRowNumber ? `row ${evidence.parsedRowNumber}` : undefined,
    evidence.parsedPositionNumber ? `#${evidence.parsedPositionNumber}` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

function NorthHillsEvidenceList({ evidence }: { evidence: NorthHillsLinkedEvidence[] }) {
  if (!evidence.length) return null;

  return (
    <div className="north-hills-evidence-list">
      {evidence.map((item) => (
        <article key={item.id} className="north-hills-evidence">
          <strong>{item.nameText || "North Hills reading"}</strong>
          <small>{northHillsLocation(item)}</small>
          <p>{item.rawText}</p>
          {item.reviewNotes ? <small>Review notes: {item.reviewNotes}</small> : null}
        </article>
      ))}
    </div>
  );
}

function blankHeadstoneForm(headstone: Headstone, markerTypeOptions?: LookupOption[], cemeteryName = ""): SaveHeadstoneInput {
  const markerTypeId = markerTypeOptions?.some((option) => option.id === headstone.markerType.id) ? headstone.markerType.id : (markerTypeOptions?.[0]?.id ?? headstone.markerType.id);
  const isTrinity = cemeteryName === "Trinity Lutheran Church Cemetery";

  return {
    markerTypeId,
    markerScopeId: headstone.markerScope.id,
    materialId: headstone.material.id,
    conditionId: headstone.condition.id,
    vaseTypeId: headstone.vaseType?.id ?? "",
    vaseMaterialId: headstone.vaseMaterial?.id ?? "",
    vasePlacementId: headstone.vasePlacement?.id ?? "",
    vaseNotes: headstone.vaseNotes ?? "",
    conditionNotes: headstone.conditionNotes ?? "",
    inscription: headstone.inscription ?? "",
    designNotes: headstone.designNotes ?? "",
    backDescription: headstone.backDescription ?? "",
    photoUrl: headstone.photoUrl ?? "",
    lastInspectedAt: headstone.lastInspectedAt ?? "",
    dataConfidence: headstone.dataConfidence ?? "unknown",
    reviewStatus: headstone.reviewStatus ?? "unreviewed",
    reviewNotes: headstone.reviewNotes ?? "",
    sourceConflict: headstone.sourceConflict ?? false,
    nhgInclusion: !headstone.nhgInclusionRecorded && isTrinity ? "listed" : (headstone.nhgInclusion ?? "not_checked"),
    provenanceVerificationSource: headstone.provenanceVerificationSource ?? "manual_review",
    provenanceVerifiedAt: headstone.provenanceVerifiedAt ?? "",
    applyNhgInclusionToBurials: false,
    reason: "Headstone detail update",
  };
}

function blankCreateHeadstoneForm(grave: GraveSpace, headstones: Headstone[], lookups: HeadstoneLookups): SaveHeadstoneCreateInput {
  const footstoneType = lookups.markerTypes.find((option) => option.code === "footstone");
  const defaultMarkerType = footstoneType ?? lookups.markerTypes.find((option) => option.code === "flat_marker") ?? lookups.markerTypes[0];
  const defaultMarkerScope = lookups.markerScopes.find((option) => option.code === "unknown") ?? lookups.markerScopes[0];
  const defaultMaterial = lookups.materials.find((option) => option.code === "unknown") ?? lookups.materials[0];
  const defaultCondition = lookups.conditions.find((option) => option.code === "unknown") ?? lookups.conditions[0];
  const primaryMarkerId = headstones[0]?.headstoneId;
  const defaultHeadstoneId = primaryMarkerId ? `${primaryMarkerId}-FS` : `${grave.id}-MARKER`;

  return {
    headstoneId: defaultHeadstoneId,
    graveSpaceId: grave.id,
    relationshipType: footstoneType ? "footstone" : "secondary",
    relationshipNotes: footstoneType ? "Footstone linked to this gravesite." : "Secondary marker linked to this gravesite.",
    markerTypeId: defaultMarkerType?.id ?? "",
    markerScopeId: defaultMarkerScope?.id ?? "",
    materialId: defaultMaterial?.id ?? "",
    conditionId: defaultCondition?.id ?? "",
    vaseTypeId: "",
    vaseMaterialId: "",
    vasePlacementId: "",
    vaseNotes: "",
    conditionNotes: "",
    inscription: "",
    designNotes: "",
    backDescription: "",
    photoUrl: "",
    lastInspectedAt: "",
    dataConfidence: "unknown",
    reviewStatus: "needs_review",
    reviewNotes: "",
    sourceConflict: false,
    nhgInclusion: grave.cemeteryName === "Trinity Lutheran Church Cemetery" ? "listed" : "not_checked",
    provenanceVerificationSource: "manual_review",
    provenanceVerifiedAt: "",
    applyNhgInclusionToBurials: false,
    latitude: "",
    longitude: "",
    reason: "Add gravesite marker",
  };
}

function CreateHeadstoneForm({
  grave,
  headstones,
  lookups,
  sectionName,
  pickedMarkerPoint,
  isPickingMarkerPoint,
  onSave,
  onStartMarkerPointPick,
  onCancelMarkerPointPick,
}: {
  grave: GraveSpace;
  headstones: Headstone[];
  lookups: HeadstoneLookups;
  sectionName: string;
  pickedMarkerPoint?: PickedMarkerPoint;
  isPickingMarkerPoint: boolean;
  onSave: (headstone: SaveHeadstoneCreateInput) => Promise<Headstone>;
  onStartMarkerPointPick: () => void;
  onCancelMarkerPointPick: () => void;
}) {
  const isSectionG = sectionName.toUpperCase() === "G";
  const markerTypeOptions = isSectionG ? lookups.markerTypes.filter((option) => option.code === "flat_marker") : lookups.markerTypes;
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<SaveHeadstoneCreateInput>(() => blankCreateHeadstoneForm(grave, headstones, { ...lookups, markerTypes: markerTypeOptions }));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const open = () => {
    setForm(blankCreateHeadstoneForm(grave, headstones, { ...lookups, markerTypes: markerTypeOptions }));
    setMessage(undefined);
    setError(undefined);
    setIsAdding(true);
  };

  useEffect(() => {
    if (!isAdding || !pickedMarkerPoint) return;
    setForm((current) => ({
      ...current,
      latitude: pickedMarkerPoint.latitude.toFixed(8),
      longitude: pickedMarkerPoint.longitude.toFixed(8),
    }));
  }, [isAdding, pickedMarkerPoint]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const saved = await onSave(form);
      setMessage(`Marker ${saved.headstoneId} added.`);
      setIsAdding(false);
      onCancelMarkerPointPick();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to add marker.");
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = () => {
    onCancelMarkerPointPick();
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <div className="headstone-form-actions">
        <button type="button" className="secondary-button" onClick={open}>
          <MapPinned size={15} aria-hidden="true" />
          Add marker
        </button>
        {message ? <p className="detail-message is-success">{message}</p> : null}
        {error ? <p className="detail-message is-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <form className="headstone-record headstone-form" onSubmit={(event) => void save(event)}>
      <div className="headstone-record-header">
        <strong>New marker</strong>
      </div>
      <label>
        Marker ID
        <input value={form.headstoneId} onChange={(event) => setForm((current) => ({ ...current, headstoneId: event.target.value }))} />
      </label>
      <label>
        Marker type
        <select
          value={form.markerTypeId}
          onChange={(event) => {
            const selectedType = markerTypeOptions.find((option) => option.id === event.target.value);
            setForm((current) => ({
              ...current,
              markerTypeId: event.target.value,
              relationshipType: selectedType?.code === "footstone" ? "footstone" : current.relationshipType,
            }));
          }}
        >
          {markerTypeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Marker scope
        <select value={form.markerScopeId} onChange={(event) => setForm((current) => ({ ...current, markerScopeId: event.target.value }))}>
          {lookups.markerScopes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Relationship
        <select
          value={form.relationshipType}
          onChange={(event) => setForm((current) => ({ ...current, relationshipType: event.target.value as SaveHeadstoneCreateInput["relationshipType"] }))}
        >
          <option value="footstone">Footstone</option>
          <option value="secondary">Secondary marker</option>
          <option value="primary">Primary marker</option>
          <option value="spans">Spans gravesites</option>
          <option value="nearby">Nearby</option>
          <option value="inferred">Inferred</option>
        </select>
      </label>
      <label>
        Material
        <select value={form.materialId} onChange={(event) => setForm((current) => ({ ...current, materialId: event.target.value }))}>
          {lookups.materials.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Condition
        <select value={form.conditionId} onChange={(event) => setForm((current) => ({ ...current, conditionId: event.target.value }))}>
          {lookups.conditions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Latitude
        <input inputMode="decimal" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} />
      </label>
      <label>
        Longitude
        <input inputMode="decimal" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} />
      </label>
      <div className="headstone-form-actions headstone-wide-field marker-point-picker">
        {isPickingMarkerPoint ? (
          <button type="button" className="secondary-button" onClick={onCancelMarkerPointPick} disabled={isSaving}>
            Cancel pick
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={onStartMarkerPointPick} disabled={isSaving}>
          <MapPinned size={15} aria-hidden="true" />
          {isPickingMarkerPoint ? "Click map to place marker" : "Pick point on map"}
        </button>
      </div>
      <label className="headstone-wide-field">
        Inscription
        <textarea value={form.inscription} onChange={(event) => setForm((current) => ({ ...current, inscription: event.target.value }))} rows={3} />
      </label>
      <label className="headstone-wide-field">
        Relationship notes
        <textarea value={form.relationshipNotes} onChange={(event) => setForm((current) => ({ ...current, relationshipNotes: event.target.value }))} rows={2} />
      </label>
      <label className="headstone-wide-field">
        Condition notes
        <textarea value={form.conditionNotes} onChange={(event) => setForm((current) => ({ ...current, conditionNotes: event.target.value }))} rows={2} />
      </label>
      <label className="headstone-wide-field">
        Review notes
        <textarea value={form.reviewNotes} onChange={(event) => setForm((current) => ({ ...current, reviewNotes: event.target.value }))} rows={2} />
      </label>
      {isSectionG ? <p className="muted headstone-wide-field">Section G allows only flat markers.</p> : null}
      {error ? <p className="detail-message is-error">{error}</p> : null}
      <div className="headstone-form-actions">
        <button type="button" className="secondary-button" onClick={cancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving || !form.headstoneId.trim() || !form.markerTypeId || !form.markerScopeId || !form.materialId || !form.conditionId || markerTypeOptions.length === 0}>
          <MapPinned size={15} aria-hidden="true" />
          {isSaving ? "Saving..." : "Save marker"}
        </button>
      </div>
    </form>
  );
}

function HeadstoneRecord({
  headstone,
  lookups,
  canUpdate,
  onSave,
  grave,
  cemeteryName,
  sectionName,
  canDeletePhotos,
  canReorderPhotos,
  onDeletePhoto,
  onMovePhoto,
  canUploadPhotos,
  onUploadPhoto,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  canDeleteGraveFeatures,
}: {
  headstone: Headstone;
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  onSave: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  grave?: GraveSpace;
  cemeteryName: string;
  sectionName: string;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  canUploadPhotos: boolean;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  canDeleteGraveFeatures: boolean;
}) {
  const isSectionG = sectionName.toUpperCase() === "G";
  const markerTypeOptions = isSectionG ? lookups.markerTypes.filter((option) => option.code === "flat_marker") : lookups.markerTypes;
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveHeadstoneInput>(() => blankHeadstoneForm(headstone, markerTypeOptions, cemeteryName));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [provenanceMessage, setProvenanceMessage] = useState<string>();

  const startEditing = () => {
    setForm(blankHeadstoneForm(headstone, markerTypeOptions, cemeteryName));
    setError(undefined);
    setProvenanceMessage(undefined);
    setIsEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    try {
      const saved = await onSave(headstone.id, form);
      if (saved.burialNhgPropagation) {
        const { updated, skipped } = saved.burialNhgPropagation;
        setProvenanceMessage(
          `${updated} associated burial${updated === 1 ? "" : "s"} updated.${skipped ? ` ${skipped} skipped because linked NHG evidence was preserved.` : ""}`,
        );
      }
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save headstone.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <form className="headstone-record headstone-form" onSubmit={(event) => void save(event)}>
        <div className="headstone-record-header">
          <strong>{headstone.headstoneId}</strong>
        </div>
        <label>
          Marker type
          <select value={form.markerTypeId} onChange={(event) => setForm((current) => ({ ...current, markerTypeId: event.target.value }))}>
            {markerTypeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {isSectionG ? <p className="muted headstone-wide-field">Section G allows only flat markers.</p> : null}
        <label>
          Marker scope
          <select value={form.markerScopeId} onChange={(event) => setForm((current) => ({ ...current, markerScopeId: event.target.value }))}>
            {lookups.markerScopes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Material
          <select value={form.materialId} onChange={(event) => setForm((current) => ({ ...current, materialId: event.target.value }))}>
            {lookups.materials.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Condition
          <select value={form.conditionId} onChange={(event) => setForm((current) => ({ ...current, conditionId: event.target.value }))}>
            {lookups.conditions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vase type
          <select value={form.vaseTypeId} onChange={(event) => setForm((current) => ({ ...current, vaseTypeId: event.target.value }))}>
            <option value="">Not recorded</option>
            {lookups.vaseTypes.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vase material
          <select value={form.vaseMaterialId} onChange={(event) => setForm((current) => ({ ...current, vaseMaterialId: event.target.value }))}>
            <option value="">Not recorded</option>
            {lookups.vaseMaterials.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Vase placement
          <select value={form.vasePlacementId} onChange={(event) => setForm((current) => ({ ...current, vasePlacementId: event.target.value }))}>
            <option value="">Not recorded</option>
            {lookups.vasePlacements.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Last inspected
          <input type="date" value={form.lastInspectedAt} onChange={(event) => setForm((current) => ({ ...current, lastInspectedAt: event.target.value }))} />
        </label>
        <label className="headstone-wide-field">
          Vase notes
          <textarea value={form.vaseNotes} onChange={(event) => setForm((current) => ({ ...current, vaseNotes: event.target.value }))} rows={2} />
        </label>
        <label className="headstone-wide-field">
          Condition notes
          <textarea value={form.conditionNotes} onChange={(event) => setForm((current) => ({ ...current, conditionNotes: event.target.value }))} rows={3} />
        </label>
        <label className="headstone-wide-field">
          Inscription
          <textarea value={form.inscription} onChange={(event) => setForm((current) => ({ ...current, inscription: event.target.value }))} rows={3} />
        </label>
        <label className="headstone-wide-field">
          Flourishes or designs
          <textarea value={form.designNotes} onChange={(event) => setForm((current) => ({ ...current, designNotes: event.target.value }))} rows={3} />
        </label>
        <label className="headstone-wide-field">
          Back of stone
          <textarea value={form.backDescription} onChange={(event) => setForm((current) => ({ ...current, backDescription: event.target.value }))} rows={3} />
        </label>
        <label>
          Data confidence
          <select value={form.dataConfidence} onChange={(event) => setForm((current) => ({ ...current, dataConfidence: event.target.value as SaveHeadstoneInput["dataConfidence"] }))}>
            {dataConfidenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review status
          <select value={form.reviewStatus} onChange={(event) => setForm((current) => ({ ...current, reviewStatus: event.target.value as SaveHeadstoneInput["reviewStatus"] }))}>
            {reviewStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          NHG inclusion
          <select value={form.nhgInclusion} onChange={(event) => setForm((current) => ({ ...current, nhgInclusion: event.target.value as SaveHeadstoneInput["nhgInclusion"] }))}>
            <option value="not_checked">Not yet checked</option>
            <option value="listed">Listed in NHG</option>
            <option value="not_listed">Not listed in NHG</option>
            <option value="unclear">Unclear</option>
          </select>
        </label>
        <label>
          Verification source
          <select
            value={form.provenanceVerificationSource}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                provenanceVerificationSource: event.target.value as SaveHeadstoneInput["provenanceVerificationSource"],
              }))
            }
          >
            <option value="field_survey">Field survey</option>
            <option value="documentary_record">Documentary record</option>
            <option value="manual_review">Manual review</option>
            <option value="import">Imported source</option>
          </select>
        </label>
        <label>
          Source information verified on
          <input
            type="date"
            value={form.provenanceVerifiedAt}
            onChange={(event) => setForm((current) => ({ ...current, provenanceVerifiedAt: event.target.value }))}
          />
        </label>
        <label className="headstone-checkbox-field headstone-wide-field">
          <input
            type="checkbox"
            checked={form.applyNhgInclusionToBurials}
            onChange={(event) => setForm((current) => ({ ...current, applyNhgInclusionToBurials: event.target.checked }))}
          />
          Apply this NHG inclusion status to associated burials
        </label>
        <p className="muted headstone-wide-field">
          Burials with genuine linked NHG evidence are preserved and skipped.
        </p>
        <label className="headstone-checkbox-field">
          <input type="checkbox" checked={form.sourceConflict} onChange={(event) => setForm((current) => ({ ...current, sourceConflict: event.target.checked }))} />
          Source conflict
        </label>
        <label className="headstone-wide-field">
          Review notes
          <textarea value={form.reviewNotes} onChange={(event) => setForm((current) => ({ ...current, reviewNotes: event.target.value }))} rows={3} />
        </label>
        {error ? <p className="detail-message is-error">{error}</p> : null}
        <div className="headstone-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving || !form.markerTypeId || !form.markerScopeId || !form.materialId || !form.conditionId || markerTypeOptions.length === 0}>
            {isSaving ? "Saving..." : "Save marker"}
          </button>
        </div>
      </form>
    );
  }

  const relationshipDetails = headstoneRelationshipDetails(headstone.relationshipType);
  const relationshipTitle = headstone.relationshipNotes ? `${relationshipDetails.description} Notes: ${headstone.relationshipNotes}` : relationshipDetails.description;

  return (
    <article className="headstone-record">
      <div className="headstone-record-header">
        <strong>{headstone.headstoneId}</strong>
        {canUpdate ? (
          <button type="button" className="icon-text-button" onClick={startEditing} aria-label={`Edit marker ${headstone.headstoneId}`}>
            <Pencil size={14} aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{headstone.markerType.label}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{headstone.markerScope.label}</dd>
        </div>
        <div>
          <dt>Material</dt>
          <dd>{headstone.material.label}</dd>
        </div>
        <div>
          <dt>Condition</dt>
          <dd>{headstone.condition.label}</dd>
        </div>
        {headstone.vaseType ? (
          <div>
            <dt>Vase</dt>
            <dd>{headstone.vaseType.label}</dd>
          </div>
        ) : null}
        {headstone.vaseMaterial ? (
          <div>
            <dt>Vase material</dt>
            <dd>{headstone.vaseMaterial.label}</dd>
          </div>
        ) : null}
        {headstone.vasePlacement ? (
          <div>
            <dt>Vase placement</dt>
            <dd>{headstone.vasePlacement.label}</dd>
          </div>
        ) : null}
        <div>
          <dt>Last inspected</dt>
          <dd>{formatDate(headstone.lastInspectedAt)}</dd>
        </div>
        <div>
          <dt>NHG inclusion</dt>
          <dd>
            {headstone.nhgInclusion === "listed"
              ? "Listed in NHG"
              : headstone.nhgInclusion === "not_listed"
                ? "Not listed in NHG"
                : headstone.nhgInclusion === "unclear"
                  ? "Unclear"
                  : "Not yet checked"}
          </dd>
        </div>
      </dl>
      {headstone.vaseNotes ? <p className="note-box">Vase: {headstone.vaseNotes}</p> : null}
      {headstone.conditionNotes ? <p className="note-box">{headstone.conditionNotes}</p> : null}
      <ReviewBadgeGroup dataConfidence={headstone.dataConfidence} reviewStatus={headstone.reviewStatus} sourceConflict={headstone.sourceConflict} reviewNotes={headstone.reviewNotes} />
      {provenanceMessage ? <p className="detail-message is-success" role="status">{provenanceMessage}</p> : null}
      {headstone.inscription ? <p className="note-box inscription-box">{headstone.inscription}</p> : null}
      {headstone.designNotes ? <p className="note-box">Designs: {headstone.designNotes}</p> : null}
      {headstone.backDescription ? <p className="note-box">Back: {headstone.backDescription}</p> : null}
      {headstone.features?.length ? (
        <GraveFeatureList
          features={headstone.features}
          canUpdate={canUpdate}
          canDelete={canDeleteGraveFeatures}
          grave={grave}
          fixedHeadstone={headstone}
          lookups={lookups}
          onUpdate={onUpdateGraveFeature}
          onDelete={onDeleteGraveFeature}
        />
      ) : null}
      {headstone.mediaAssets?.length ? (
        <MediaGallery assets={headstone.mediaAssets} canDelete={canDeletePhotos} onDelete={onDeletePhoto} onMove={canReorderPhotos ? onMovePhoto : undefined} />
      ) : null}
      {canUploadPhotos ? <PhotoUploadForm headstones={[headstone]} fixedHeadstone={headstone} onUpload={onUploadPhoto} /> : null}
      {headstone.relationshipType !== "primary" || headstone.relationshipNotes ? (
        <p className="marker-relationship" title={relationshipTitle} aria-label={relationshipTitle}>
          <Info size={14} aria-hidden="true" />
          <span>
            {relationshipDetails.label} <span className="marker-relationship-code">({headstone.relationshipType})</span>
            {headstone.relationshipNotes ? ` - ${headstone.relationshipNotes}` : ""}
          </span>
        </p>
      ) : null}
      <NorthHillsEvidenceList evidence={headstone.northHillsEvidence ?? []} />
    </article>
  );
}

function MarkerDetailPanel({
  summary,
  headstone,
  markerGraves,
  canUpdateHeadstones,
  headstoneLookups,
  onSaveHeadstone,
  onSaveHeadstoneRelationship,
  onUpdateHeadstoneRelationship,
  onDeleteHeadstoneRelationship,
  onSaveHeadstoneGravesiteRelationship,
  onUpdateHeadstoneGravesiteRelationship,
  onDeleteHeadstoneGravesiteRelationship,
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSelectMarkerGrave,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  canDeleteGraveFeatures,
  canDeletePhotos,
  canReorderPhotos,
  isLoading,
  error,
  onRetry,
}: {
  summary: HeadstoneSummary;
  headstone?: Headstone;
  markerGraves: GraveSpaceSummary[];
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onSaveHeadstoneRelationship: (headstoneId: string, relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
  onUpdateHeadstoneRelationship: (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
  onDeleteHeadstoneRelationship: (headstoneId: string, relationshipId: string, reason?: string) => Promise<void>;
  onSaveHeadstoneGravesiteRelationship: (headstoneId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onUpdateHeadstoneGravesiteRelationship: (headstoneId: string, relationshipId: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onDeleteHeadstoneGravesiteRelationship: (headstoneId: string, relationshipId: string, reason?: string) => Promise<void>;
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSelectMarkerGrave: (grave: GraveSpaceSummary) => void;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  canDeleteGraveFeatures: boolean;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const isMonolith = headstone?.markerScope.code === "monolith";
  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Marker</p>
          <div className="marker-title-with-badge">
            <h2>{summary.headstoneId}</h2>
            {isMonolith ? <span className="monolith-badge">Monolith</span> : null}
          </div>
          <p className="grave-cemetery">{summary.cemeteryName}</p>
        </div>
      </div>

      {isMonolith ? (
        <div className="monolith-notice">
          <Landmark size={18} aria-hidden="true" />
          <div>
            <strong>Shared monolith marker</strong>
            <p>This marker does not represent a gravesite at its location. It is linked to the regular markers and gravesites listed below.</p>
          </div>
        </div>
      ) : null}

      {isLoading && !headstone ? (
        <div className="detail-message" role="status">
          Loading marker details...
        </div>
      ) : null}

      {error ? (
        <div className="detail-message is-error" role="alert">
          <p>Unable to load marker details: {error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Landmark size={17} aria-hidden="true" />
            <h3>{isMonolith ? "Monolith Marker" : "Marker"}</h3>
          </div>
          <div className="headstone-list">
            <HeadstoneRecord
              headstone={headstone}
              lookups={headstoneLookups}
              canUpdate={canUpdateHeadstones}
              onSave={onSaveHeadstone}
              cemeteryName={summary.cemeteryName}
              sectionName=""
              canDeletePhotos={canDeletePhotos}
              canReorderPhotos={canReorderPhotos}
              onDeletePhoto={onDeletePhoto}
              onMovePhoto={onMovePhoto}
              canUploadPhotos={canUpdateHeadstones}
              onUploadPhoto={onUploadPhoto}
              onUpdateGraveFeature={onUpdateGraveFeature}
              onDeleteGraveFeature={onDeleteGraveFeature}
              canDeleteGraveFeatures={canDeleteGraveFeatures}
            />
          </div>
        </section>
      )}

      {!headstone || error || !canUpdateHeadstones ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Flag size={17} aria-hidden="true" />
            <h3>Marker Features</h3>
          </div>
          <GraveFeatureForm headstones={[headstone]} fixedHeadstone={headstone} lookups={headstoneLookups} onSave={onSaveGraveFeature} />
        </section>
      )}

      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <Link2 size={17} aria-hidden="true" />
            <h3>{isMonolith ? "Regular Markers Linked to This Monolith" : "Related Markers"}</h3>
          </div>
          <MarkerRelationshipList
            headstone={headstone}
            relationships={headstone.relationships ?? []}
            lookups={headstoneLookups}
            canUpdate={canUpdateHeadstones}
            onUpdate={(relationshipId, relationship) => onUpdateHeadstoneRelationship(headstone.id, relationshipId, relationship)}
            onDelete={(relationshipId, reason) => onDeleteHeadstoneRelationship(headstone.id, relationshipId, reason)}
          />
          {canUpdateHeadstones ? (
            <MarkerRelationshipForm headstone={headstone} lookups={headstoneLookups} onSave={(relationship) => onSaveHeadstoneRelationship(headstone.id, relationship)} />
          ) : null}
        </section>
      )}

      {!headstone || error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <History size={17} aria-hidden="true" />
            <h3>Maintenance</h3>
          </div>
          <MaintenanceRecordList
            records={headstone.maintenanceRecords ?? []}
            canUpdate={canUpdateHeadstones}
            lookups={headstoneLookups}
            fixedHeadstone={headstone}
            onUpdate={onUpdateMaintenanceRecord}
          />
          {canUpdateHeadstones ? <MaintenanceRecordForm fixedHeadstone={headstone} lookups={headstoneLookups} onSave={onSaveMaintenanceRecord} /> : null}
        </section>
      )}

      {error ? null : (
        <section className="detail-section">
          <div className="section-title">
            <MapPinned size={17} aria-hidden="true" />
            <h3>{isMonolith ? "Gravesites Spanned by This Monolith" : "Associated Gravesites"}</h3>
          </div>
          {headstone ? (
            <MarkerGravesiteRelationshipManager
              headstone={headstone}
              graves={markerGraves}
              lookups={headstoneLookups}
              canUpdate={canUpdateHeadstones}
              onSelectGrave={onSelectMarkerGrave}
              onSave={(relationship) => onSaveHeadstoneGravesiteRelationship(headstone.id, relationship)}
              onUpdate={(relationshipId, relationship) => onUpdateHeadstoneGravesiteRelationship(headstone.id, relationshipId, relationship)}
              onDelete={(relationshipId, reason) => onDeleteHeadstoneGravesiteRelationship(headstone.id, relationshipId, reason)}
            />
          ) : null}
        </section>
      )}
    </aside>
  );
}

function EmptyDetailPanel() {
  return (
    <aside className="detail-panel empty-state">
      <MapPinned size={28} aria-hidden="true" />
      <h2>Select a grave site, lot, or marker</h2>
      <p>Click a mapped grave space, lot, marker, or choose a search result to view cemetery records.</p>
    </aside>
  );
}

const lotBurialUseLabels = {
  standard: "Standard lot",
  non_burial: "Gravesites and markers prohibited",
  partially_restricted: "Partially restricted",
} satisfies Record<NonNullable<CemeteryLot["burialUseStatus"]>, string>;

function LotDetailPanel({
  lot,
  graves,
  restrictedAreas,
  onSelectGrave,
}: {
  lot: CemeteryLot;
  graves: GraveSpaceSummary[];
  restrictedAreas: LotRestrictedArea[];
  onSelectGrave: (grave: GraveSpaceSummary) => void;
}) {
  const burialUseStatus = lot.burialUseStatus ?? "standard";
  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Lot</p>
          <h2>
            {lot.section ? `${lot.section}-` : ""}
            {lot.id}
          </h2>
          <p className="grave-cemetery">{lot.name}</p>
        </div>
      </div>

      <section className="detail-section">
        <div className="section-title">
          <MapPinned size={17} aria-hidden="true" />
          <h3>Lot</h3>
        </div>
        <article className="grave-record">
          <dl>
            <div>
              <dt>Section</dt>
              <dd>{lot.section || "Unknown"}</dd>
            </div>
            <div>
              <dt>Lot</dt>
              <dd>{lot.id || "Unknown"}</dd>
            </div>
            {lot.block ? (
              <div>
                <dt>Block</dt>
                <dd>{lot.block}</dd>
              </div>
            ) : null}
            <div>
              <dt>Name</dt>
              <dd>{lot.name || "Unknown"}</dd>
            </div>
            <div>
              <dt>Burial use</dt>
              <dd>{lotBurialUseLabels[burialUseStatus]}</dd>
            </div>
          </dl>
          {lot.burialUseNotes ? <p className="lot-use-note">{lot.burialUseNotes}</p> : null}
        </article>
      </section>

      {burialUseStatus !== "standard" || restrictedAreas.length ? (
        <section className="detail-section">
          <div className="section-title">
            <Info size={17} aria-hidden="true" />
            <h3>Lot Restrictions</h3>
          </div>
          <article className="grave-record">
            {restrictedAreas.length ? (
              <div className="lot-restriction-list">
                {restrictedAreas.map((area) => (
                  <div key={area.id} className="lot-restriction-row">
                    <strong>{area.name}</strong>
                    <span>{area.notes || "This area cannot contain gravesites or markers."}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="lot-use-note">This lot cannot contain gravesites or markers.</p>
            )}
          </article>
        </section>
      ) : null}

      <section className="detail-section">
        <div className="section-title">
          <MapPinned size={17} aria-hidden="true" />
          <h3>Gravesites</h3>
        </div>
        <AssociatedGravesiteList graves={graves} emptyMessage="No gravesites are associated with this lot." onSelectGrave={onSelectGrave} />
      </section>

      <section className="detail-section">
        <div className="section-title">
          <MapPinned size={17} aria-hidden="true" />
          <h3>Lot Geometry</h3>
        </div>
        <article className="grave-record">
          <section className="geometry-metadata-group" aria-label="Lot geometry metadata">
            <GeometryMetadataList type={lot.geometryType} source={lot.geometrySource} confidence={lot.geometryConfidence} notes={lot.geometryNotes} />
          </section>
        </article>
      </section>
    </aside>
  );
}

function GraveDetailPanel({
  ownersById,
  summary,
  grave,
  cemeteryGraves,
  cemeteryLots,
  cemeteryHeadstones,
  headstones,
  northHillsEvidence,
  mediaAssets,
  canViewOwnership,
  canUpdateGravesites,
  canManageLotAssignment,
  canUpdateBurials,
  canUpdateHeadstones,
  headstoneLookups,
  pickedMarkerPoint,
  isPickingMarkerPoint,
  onSaveGraveSpace,
  onSaveBurial,
  onSaveHeadstone,
  onCreateHeadstone,
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSaveOwnershipEvent,
  onUpdateOwner,
  onRemoveOwnershipConnection,
  onUpdateGraveLot,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  onStartMarkerPointPick,
  onCancelMarkerPointPick,
  canDeleteGraveFeatures,
  canDeletePhotos,
  canReorderPhotos,
  isLoading,
  error,
  onRetry,
}: {
  ownersById: Map<string, Owner>;
  summary: GraveSpaceSummary;
  grave?: GraveSpace;
  cemeteryGraves: GraveSpaceSummary[];
  cemeteryLots: CemeteryLot[];
  cemeteryHeadstones: HeadstoneSummary[];
  headstones: Headstone[];
  northHillsEvidence: NorthHillsLinkedEvidence[];
  mediaAssets: MediaAsset[];
  canViewOwnership: boolean;
  canUpdateGravesites: boolean;
  canManageLotAssignment: boolean;
  canUpdateBurials: boolean;
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  pickedMarkerPoint?: PickedMarkerPoint;
  isPickingMarkerPoint: boolean;
  onSaveGraveSpace: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onSaveBurial: (id: string, burial: SaveBurialInput) => Promise<Burial>;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onCreateHeadstone: (grave: GraveSpace, headstone: SaveHeadstoneCreateInput) => Promise<Headstone>;
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDeleteGraveFeature: (id: string, reason?: string) => Promise<void>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSaveOwnershipEvent: (event: SaveOwnershipEventInput) => Promise<void>;
  onUpdateOwner: (partyId: string, eventId: string, owner: UpdateOwnerInput) => Promise<void>;
  onRemoveOwnershipConnection: (rightId: string) => Promise<void>;
  onUpdateGraveLot: (lotId: string) => Promise<void>;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  onStartMarkerPointPick: () => void;
  onCancelMarkerPointPick: () => void;
  canDeleteGraveFeatures: boolean;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const title = formatGraveLabel(summary);
  const [activeTab, setActiveTab] = useState<"overview" | "people" | "monuments" | "records" | "location">("overview");

  const inferredLot = grave ? inferredLotForGrave(grave, cemeteryLots, cemeteryHeadstones) : undefined;
  const detailTabs: { id: "overview" | "people" | "monuments" | "records" | "location"; label: string; description: string; count?: number }[] = grave ? [
    { id: "overview", label: "Overview", description: "Overview" },
    { id: "people", label: "People", description: "People and ownership", count: grave.burials.length + (canViewOwnership ? grave.currentOwnerIds.length : 0) },
    { id: "monuments", label: "Monuments", description: "Monuments and photos", count: headstones.length + (grave.features?.length ?? 0) + mediaAssets.length },
    { id: "records", label: "Maint.", description: "Maintenance records and evidence", count: (grave.maintenanceRecords?.length ?? 0) + northHillsEvidence.length },
    { id: "location", label: "Location", description: "Location and geometry" },
  ] : [];

  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Grave site</p>
          <h2>{title}</h2>
          <p className="grave-record-id">Record ID: {summary.id}</p>
          <p className="grave-cemetery">{summary.cemeteryName}</p>
        </div>
      </div>

      {isLoading && !grave ? (
        <div className="detail-message" role="status">
          Loading grave details...
        </div>
      ) : null}

      {error ? (
        <div className="detail-message is-error" role="alert">
          <p>Unable to load grave details: {error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {!grave || error ? null : (
        <>
          <div className="detail-tabs" role="tablist" aria-label="Gravesite details">
            {detailTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`grave-detail-tab-${tab.id}`}
                aria-controls={`grave-detail-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-label={tab.description}
                title={tab.description}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={activeTab === tab.id ? "is-active" : undefined}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const currentIndex = detailTabs.findIndex((candidate) => candidate.id === activeTab);
                  const nextIndex = event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? detailTabs.length - 1
                      : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + detailTabs.length) % detailTabs.length;
                  setActiveTab(detailTabs[nextIndex].id);
                  document.getElementById(`grave-detail-tab-${detailTabs[nextIndex].id}`)?.focus();
                }}
              >
                <span>{tab.label}</span>
                {tab.count ? <span className="detail-tab-count" aria-label={`${tab.count} items`}>{tab.count}</span> : null}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`grave-detail-panel-${activeTab}`}
            aria-labelledby={`grave-detail-tab-${activeTab}`}
            className="detail-tab-panel"
          >
          {activeTab === "overview" ? <>
          <section className="detail-section">
            <div className="section-title">
              <MapPinned size={17} aria-hidden="true" />
              <h3>Gravesite</h3>
            </div>
            <GraveSpaceRecord grave={grave} lots={cemeteryLots} inferredLot={inferredLot} canUpdate={canUpdateGravesites} canManageLot={canManageLotAssignment} onSave={onSaveGraveSpace} onUpdateLot={onUpdateGraveLot} />
          </section>

          {grave.notes ? (
            <section className="detail-section">
              <div className="section-title">
                <FileText size={17} aria-hidden="true" />
                <h3>Notes</h3>
              </div>
              <p className="note-box">{grave.notes}</p>
            </section>
          ) : null}
          </> : null}

          {activeTab === "people" ? <>
          {canViewOwnership ? (
            <section className="detail-section">
              <div className="section-title">
                <Landmark size={17} aria-hidden="true" />
                <h3>Current Owner</h3>
              </div>
              <div className="owner-list">
                {grave.currentOwnerIds.length ? (
                  grave.currentOwnerIds.map((id, index) => {
                    const owner = ownersById.get(id);
                    const isFirstOwnerForRight = owner?.ownershipEventRightId
                      ? grave.currentOwnerIds.findIndex((candidateId) => ownersById.get(candidateId)?.ownershipEventRightId === owner.ownershipEventRightId) === index
                      : false;
                    return owner ? <OwnerRecord key={id} owner={owner} canUpdate={canUpdateGravesites} canRemove={canManageLotAssignment && isFirstOwnerForRight} onSave={onUpdateOwner} onRemove={onRemoveOwnershipConnection} /> : null;
                  })
                ) : (
                  <p className="muted">No current ownership is recorded.</p>
                )}
              </div>
              {canUpdateGravesites ? (
                <OwnershipEventForm grave={grave} cemeteryGraves={cemeteryGraves} onSave={onSaveOwnershipEvent} />
              ) : null}
            </section>
          ) : null}

          <section className="detail-section">
            <div className="section-title burial-section-title">
              <UserRound size={17} aria-hidden="true" />
              <h3>Burials</h3>
              <span className="burial-gravesite-id">Gravesite {title} · Record ID {summary.id}</span>
            </div>
            {grave.burials.length ? (
              <div className="burial-list">
                {grave.burials.map((burial) => (
                  <BurialRecord key={burial.id} burial={burial} canUpdate={canUpdateBurials} lookups={headstoneLookups} onSave={onSaveBurial} />
                ))}
              </div>
            ) : (
              <p className="muted">No burials are recorded for this grave site.</p>
            )}
          </section>

          {canViewOwnership ? (
            <section className="detail-section">
              <div className="section-title">
                <History size={17} aria-hidden="true" />
                <h3>Ownership Timeline</h3>
              </div>
              <ol className="timeline">
                {[...grave.ownershipHistory]
                  .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
                  .map((event) => (
                    <li key={event.id}>
                      <time>{formatDate(event.effectiveDate)}</time>
                      <strong>{event.eventType}</strong>
                      {event.fromOwnerNames.length ? (
                        <div className="ownership-transfer-flow">
                          <span><small>From</small>{event.fromOwnerNames.join(", ")}</span>
                          <span aria-hidden="true">→</span>
                          <span><small>To</small>{event.toOwnerNames.join(", ")}</span>
                        </div>
                      ) : <span>{event.ownerIds.map((id) => ownerName(ownersById, id)).join(", ")}</span>}
                      <small><span className="timeline-field-label">Recorded by</span>{event.recordedBy}</small>
                      {event.documentReference ? (
                        <span className="document-ref">
                          <FileText size={13} aria-hidden="true" />
                          {event.documentReference}
                        </span>
                      ) : null}
                      {event.notes ? <p>{event.notes}</p> : null}
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}
          </> : null}

          {activeTab === "monuments" ? <>
          <section className="detail-section">
            <div className="section-title">
              <Landmark size={17} aria-hidden="true" />
              <h3>Markers</h3>
            </div>
            {headstones.length ? (
              <div className="headstone-list">
                {headstones.map((headstone) => (
                  <HeadstoneRecord
                    key={headstone.id}
                    headstone={headstone}
                    lookups={headstoneLookups}
                    canUpdate={canUpdateHeadstones}
                    onSave={onSaveHeadstone}
                    grave={grave}
                    cemeteryName={summary.cemeteryName}
                    sectionName={summary.section}
                    canDeletePhotos={canDeletePhotos}
                    canReorderPhotos={canReorderPhotos}
                    onDeletePhoto={onDeletePhoto}
                    onMovePhoto={onMovePhoto}
                    canUploadPhotos={canUpdateHeadstones}
                    onUploadPhoto={onUploadPhoto}
                    onUpdateGraveFeature={onUpdateGraveFeature}
                    onDeleteGraveFeature={onDeleteGraveFeature}
                    canDeleteGraveFeatures={canDeleteGraveFeatures}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">No markers are recorded for this grave site.</p>
            )}
            {canUpdateHeadstones ? (
              <CreateHeadstoneForm
                grave={grave}
                headstones={headstones}
                lookups={headstoneLookups}
                sectionName={summary.section}
                pickedMarkerPoint={pickedMarkerPoint}
                isPickingMarkerPoint={isPickingMarkerPoint}
                onSave={(headstone) => onCreateHeadstone(grave, headstone)}
                onStartMarkerPointPick={onStartMarkerPointPick}
                onCancelMarkerPointPick={onCancelMarkerPointPick}
              />
            ) : null}
          </section>

          <section className="detail-section">
            <div className="section-title">
              <Flag size={17} aria-hidden="true" />
              <h3>Grave Features</h3>
            </div>
            <GraveFeatureList
              features={grave.features ?? []}
              canUpdate={canUpdateHeadstones}
              canDelete={canDeleteGraveFeatures}
              grave={grave}
              lookups={headstoneLookups}
              onUpdate={onUpdateGraveFeature}
              onDelete={onDeleteGraveFeature}
            />
            {canUpdateHeadstones ? <GraveFeatureForm grave={grave} headstones={headstones} lookups={headstoneLookups} onSave={onSaveGraveFeature} /> : null}
          </section>

          <section className="detail-section">
            <div className="section-title">
              <Images size={17} aria-hidden="true" />
              <h3>Gravesite Photos</h3>
            </div>
            <MediaGallery
              assets={mediaAssets}
              emptyMessage="No gravesite overview photos are linked yet."
              canDelete={canDeletePhotos}
              onDelete={onDeletePhoto}
              onMove={canReorderPhotos ? onMovePhoto : undefined}
            />
            {canUpdateHeadstones ? <PhotoUploadForm headstones={headstones} gravesiteOnly onUpload={onUploadPhoto} /> : null}
          </section>
          </> : null}

          {activeTab === "records" ? <>
          <section className="detail-section">
            <div className="section-title">
              <History size={17} aria-hidden="true" />
              <h3>Maintenance</h3>
            </div>
            <MaintenanceRecordList records={grave.maintenanceRecords ?? []} canUpdate={canUpdateGravesites} grave={grave} lookups={headstoneLookups} onUpdate={onUpdateMaintenanceRecord} />
            {canUpdateGravesites ? <MaintenanceRecordForm grave={grave} lookups={headstoneLookups} onSave={onSaveMaintenanceRecord} /> : null}
          </section>

          {northHillsEvidence.length ? (
            <section className="detail-section">
              <div className="section-title">
                <FileText size={17} aria-hidden="true" />
                <h3>North Hills Genealogical (NHG) Evidence</h3>
              </div>
              <NorthHillsEvidenceList evidence={northHillsEvidence} />
            </section>
          ) : null}
          </> : null}

          {activeTab === "location" ? (
          <section className="detail-section">
            <div className="section-title">
              <MapPinned size={17} aria-hidden="true" />
              <h3>Geometry</h3>
            </div>
            <GraveGeometryMetadata grave={grave} />
          </section>
          ) : null}
          </div>
        </>
      )}
    </aside>
  );
}

export function DetailPanel({
  owners,
  summary,
  lot,
  lotGraves = [],
  cemeteryGraves = [],
  cemeteryLots = [],
  cemeteryHeadstones = [],
  lotRestrictedAreas = [],
  grave,
  standaloneHeadstoneSummary,
  standaloneHeadstone,
  markerGraves = [],
  canViewOwnership,
  canUpdateGravesites,
  canManageLotAssignment,
  canUpdateBurials,
  canUpdateHeadstones,
  headstoneLookups,
  pickedMarkerPoint,
  isPickingMarkerPoint,
  onSaveGraveSpace,
  onSaveBurial,
  onSaveHeadstone,
  onCreateHeadstone,
  onSaveHeadstoneRelationship,
  onUpdateHeadstoneRelationship,
  onDeleteHeadstoneRelationship,
  onSaveHeadstoneGravesiteRelationship,
  onUpdateHeadstoneGravesiteRelationship,
  onDeleteHeadstoneGravesiteRelationship,
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onDeleteGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSaveOwnershipEvent,
  onUpdateOwner,
  onRemoveOwnershipConnection,
  onUpdateGraveLot,
  onSelectLotGrave,
  onSelectMarkerGrave,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  onStartMarkerPointPick,
  onCancelMarkerPointPick,
  canDeleteGraveFeatures,
  canDeletePhotos,
  canReorderPhotos,
  isLoading = false,
  error,
  onRetry,
}: DetailPanelProps) {
  const ownersById = useMemo(
    () => new Map([...(grave?.owners ?? []), ...owners].map((owner) => [owner.id, owner])),
    [grave?.owners, owners],
  );
  const headstones = useMemo(() => grave?.headstones ?? [], [grave?.headstones]);
  const northHillsEvidence = grave?.northHillsEvidence ?? [];
  const headstoneMediaIds = useMemo(() => new Set(headstones.flatMap((headstone) => (headstone.mediaAssets ?? []).map((asset) => asset.id))), [headstones]);
  const mediaAssets = useMemo(() => (grave?.mediaAssets ?? []).filter((asset) => !headstoneMediaIds.has(asset.id)), [grave?.mediaAssets, headstoneMediaIds]);

  if (standaloneHeadstoneSummary) {
    return (
      <MarkerDetailPanel
        summary={standaloneHeadstoneSummary}
        headstone={standaloneHeadstone}
        markerGraves={markerGraves}
        canUpdateHeadstones={canUpdateHeadstones}
        headstoneLookups={headstoneLookups}
        onSaveHeadstone={onSaveHeadstone}
        onSaveHeadstoneRelationship={onSaveHeadstoneRelationship}
        onUpdateHeadstoneRelationship={onUpdateHeadstoneRelationship}
        onDeleteHeadstoneRelationship={onDeleteHeadstoneRelationship}
        onSaveHeadstoneGravesiteRelationship={onSaveHeadstoneGravesiteRelationship}
        onUpdateHeadstoneGravesiteRelationship={onUpdateHeadstoneGravesiteRelationship}
        onDeleteHeadstoneGravesiteRelationship={onDeleteHeadstoneGravesiteRelationship}
        onSaveGraveFeature={onSaveGraveFeature}
        onUpdateGraveFeature={onUpdateGraveFeature}
        onDeleteGraveFeature={onDeleteGraveFeature}
        onSaveMaintenanceRecord={onSaveMaintenanceRecord}
        onUpdateMaintenanceRecord={onUpdateMaintenanceRecord}
        onSelectMarkerGrave={onSelectMarkerGrave}
        onUploadPhoto={onUploadPhoto}
        onDeletePhoto={onDeletePhoto}
        onMovePhoto={onMovePhoto}
        canDeleteGraveFeatures={canDeleteGraveFeatures}
        canDeletePhotos={canDeletePhotos}
        canReorderPhotos={canReorderPhotos}
        isLoading={isLoading}
        error={error}
        onRetry={onRetry}
      />
    );
  }

  if (lot) {
    return <LotDetailPanel lot={lot} graves={lotGraves} restrictedAreas={lotRestrictedAreas} onSelectGrave={onSelectLotGrave} />;
  }

  if (!summary) {
    return <EmptyDetailPanel />;
  }

  return (
    <GraveDetailPanel
      ownersById={ownersById}
      summary={summary}
      grave={grave}
      cemeteryGraves={cemeteryGraves}
      cemeteryLots={cemeteryLots}
      cemeteryHeadstones={cemeteryHeadstones}
      headstones={headstones}
      northHillsEvidence={northHillsEvidence}
      mediaAssets={mediaAssets}
      canViewOwnership={canViewOwnership}
      canUpdateGravesites={canUpdateGravesites}
      canManageLotAssignment={canManageLotAssignment}
      canUpdateBurials={canUpdateBurials}
      canUpdateHeadstones={canUpdateHeadstones}
      headstoneLookups={headstoneLookups}
      pickedMarkerPoint={pickedMarkerPoint}
      isPickingMarkerPoint={isPickingMarkerPoint}
      onSaveGraveSpace={onSaveGraveSpace}
      onSaveBurial={onSaveBurial}
      onSaveHeadstone={onSaveHeadstone}
      onCreateHeadstone={onCreateHeadstone}
      onSaveGraveFeature={onSaveGraveFeature}
      onUpdateGraveFeature={onUpdateGraveFeature}
      onDeleteGraveFeature={onDeleteGraveFeature}
      onSaveMaintenanceRecord={onSaveMaintenanceRecord}
      onUpdateMaintenanceRecord={onUpdateMaintenanceRecord}
      onSaveOwnershipEvent={onSaveOwnershipEvent}
      onUpdateOwner={onUpdateOwner}
      onRemoveOwnershipConnection={onRemoveOwnershipConnection}
      onUpdateGraveLot={onUpdateGraveLot}
      onUploadPhoto={onUploadPhoto}
      onDeletePhoto={onDeletePhoto}
      onMovePhoto={onMovePhoto}
      onStartMarkerPointPick={onStartMarkerPointPick}
      onCancelMarkerPointPick={onCancelMarkerPointPick}
      canDeleteGraveFeatures={canDeleteGraveFeatures}
      canDeletePhotos={canDeletePhotos}
      canReorderPhotos={canReorderPhotos}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
    />
  );
}
