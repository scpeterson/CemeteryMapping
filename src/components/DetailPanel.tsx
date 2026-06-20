import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Camera, ChevronLeft, ChevronRight, FileText, Flag, History, Images, Info, Landmark, MapPinned, Pencil, Trash2, UserRound } from "lucide-react";
import type {
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
  OwnershipEventType,
  OwnershipTargetScope,
  SaveBurialInput,
  SaveGraveSpaceInput,
  SaveGraveFeatureInput,
  SaveHeadstoneInput,
  SaveMaintenanceRecordInput,
  SaveOwnershipEventInput,
  GeometryConfidence,
  GeometryType,
} from "../types";
import { apiBaseUrl } from "../config/environment";
import { burialNoteItems } from "../lib/burialNotes";
import { formatDate, formatGraveLabel, fullName, geometryConfidenceLabels, geometryTypeLabels, statusColors, statusLabels } from "../lib/format";

type DetailPanelProps = {
  owners: Owner[];
  summary?: GraveSpaceSummary;
  lot?: CemeteryLot;
  lotGraves?: GraveSpaceSummary[];
  lotRestrictedAreas?: LotRestrictedArea[];
  grave?: GraveSpace;
  standaloneHeadstoneSummary?: HeadstoneSummary;
  standaloneHeadstone?: Headstone;
  markerGraves?: GraveSpaceSummary[];
  canViewOwnership: boolean;
  canUpdateGravesites: boolean;
  canUpdateBurials: boolean;
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  onSaveGraveSpace: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onSaveBurial: (id: string, burial: SaveBurialInput) => Promise<Burial>;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSaveOwnershipEvent: (event: SaveOwnershipEventInput) => Promise<void>;
  onSelectLotGrave: (grave: GraveSpaceSummary) => void;
  onSelectMarkerGrave: (grave: GraveSpaceSummary) => void;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
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

const ownershipEventOptions: { value: OwnershipEventType; label: string }[] = [
  { value: "deed", label: "New deed" },
  { value: "sale", label: "Sale / transfer" },
  { value: "gift", label: "Gift" },
  { value: "church_council_action", label: "Church council action" },
  { value: "correction", label: "Correction" },
  { value: "release", label: "Release" },
];

const ownershipTargetOptions: { value: OwnershipTargetScope; label: string }[] = [
  { value: "selected_gravesite", label: "This gravesite" },
  { value: "selected_lot", label: "This whole lot" },
  { value: "listed_gravesites", label: "Listed gravesites" },
];

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
};

function headstoneRelationshipDetails(relationshipType: string) {
  return (
    headstoneRelationshipCopy[relationshipType] ?? {
      label: `Marker relationship: ${relationshipType}`,
      description: "This marker has a non-standard relationship to the selected gravesite.",
    }
  );
}

function blankOwnershipForm(grave: GraveSpace): SaveOwnershipEventInput {
  return {
    ownerDisplayName: "",
    eventType: "deed",
    targetScope: grave.lot ? "selected_lot" : "selected_gravesite",
    targetGravesiteIds: [],
    effectiveDate: new Date().toISOString().slice(0, 10),
    documentReference: "",
    notes: "",
    reason: "Ownership event update",
  };
}

function OwnershipEventForm({ grave, onSave }: { grave: GraveSpace; onSave: (event: SaveOwnershipEventInput) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveOwnershipEventInput>(() => blankOwnershipForm(grave));
  const [listedGravesites, setListedGravesites] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const startEditing = () => {
    setForm(blankOwnershipForm(grave));
    setListedGravesites("");
    setMessage(undefined);
    setError(undefined);
    setIsEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const targetGravesiteIds =
        form.targetScope === "listed_gravesites"
          ? listedGravesites
              .split(/[\s,]+/u)
              .map((value) => value.trim())
              .filter(Boolean)
          : [];
      await onSave({ ...form, targetGravesiteIds });
      setMessage("Ownership event recorded.");
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to record ownership event.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="ownership-action">
        {message ? <p className="detail-message is-success">{message}</p> : null}
        <button type="button" className="icon-text-button" onClick={startEditing} title="Record a deed, transfer, gift, correction, or release for this gravesite or lot.">
          <Pencil size={14} aria-hidden="true" />
          Record deed or transfer
        </button>
      </div>
    );
  }

  return (
    <form className="ownership-form" onSubmit={(event) => void save(event)}>
      <label className="ownership-wide-field">
        Owner or deed holder
        <input
          value={form.ownerDisplayName}
          onChange={(event) => setForm((current) => ({ ...current, ownerDisplayName: event.target.value }))}
          placeholder="Name, couple, family, church, or organization"
          required
        />
      </label>
      <label>
        Event
        <select value={form.eventType} onChange={(event) => setForm((current) => ({ ...current, eventType: event.target.value as OwnershipEventType }))}>
          {ownershipEventOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Applies to
        <select value={form.targetScope} onChange={(event) => setForm((current) => ({ ...current, targetScope: event.target.value as OwnershipTargetScope }))}>
          {ownershipTargetOptions.map((option) => (
            <option key={option.value} value={option.value} disabled={option.value === "selected_lot" && !grave.lot}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {form.targetScope === "listed_gravesites" ? (
        <label className="ownership-wide-field">
          Gravesite IDs
          <textarea
            value={listedGravesites}
            onChange={(event) => setListedGravesites(event.target.value)}
            rows={3}
            placeholder={`Example: ${formatGraveLabel(grave)}, G-050`}
            required
          />
        </label>
      ) : null}
      <label>
        Effective date
        <input type="date" value={form.effectiveDate} onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))} />
      </label>
      <label className="ownership-wide-field">
        Document reference
        <input
          value={form.documentReference}
          onChange={(event) => setForm((current) => ({ ...current, documentReference: event.target.value }))}
          placeholder="Deed book, scanned file, page, or source note"
        />
      </label>
      <label className="ownership-wide-field">
        Notes
        <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} />
      </label>
      {error ? <p className="detail-message is-error">{error}</p> : null}
      <div className="ownership-form-actions">
        <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" disabled={isSaving || !form.ownerDisplayName.trim() || (form.targetScope === "listed_gravesites" && !listedGravesites.trim())}>
          {isSaving ? "Recording..." : "Record ownership"}
        </button>
      </div>
    </form>
  );
}

function blankBurialForm(burial: Burial): SaveBurialInput {
  return {
    firstName: burial.person.firstName,
    lastName: burial.person.lastName === "Unknown" ? "" : burial.person.lastName,
    maidenName: burial.person.maidenName ?? "",
    birthDate: burial.person.birthDate ?? "",
    deathDate: burial.person.deathDate ?? "",
    burialDate: burial.burialDate ?? "",
    intermentType: burial.intermentType ?? "casket",
    recordStatusCode: burial.recordStatusCode ?? "interred",
    funeralHome: burial.funeralHome ?? "",
    veteran: burial.veteran ?? false,
    militaryBranchCode: burial.militaryBranchCode ?? "",
    militaryRankCode: burial.militaryRankCode ?? "",
    militaryWarServiceCode: burial.militaryWarServiceCode ?? "",
    notes: burial.recordNotes ?? "",
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
      ];
}

function burialRecordStatusOptions(lookups: HeadstoneLookups) {
  return lookups.burialRecordStatuses?.length
    ? lookups.burialRecordStatuses
    : [{ id: "legacy-interred", code: "interred", label: "Interred" }];
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

  const startEditing = () => {
    setForm(blankBurialForm(burial));
    setError(undefined);
    setIsEditing(true);
  };

  const setVeteran = (isVeteran: boolean) => {
    setForm((current) => ({
      ...current,
      veteran: isVeteran,
      militaryBranchCode: isVeteran ? current.militaryBranchCode : "",
      militaryRankCode: isVeteran ? current.militaryRankCode : "",
      militaryWarServiceCode: isVeteran ? current.militaryWarServiceCode : "",
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
          Birth date
          <input value={form.birthDate} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} />
        </label>
        <label>
          Death date
          <input value={form.deathDate} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, deathDate: event.target.value }))} />
        </label>
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
        <label className="burial-wide-field">
          Notes
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
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
      {burial.veteran || serviceText ? (
        <p className="burial-service">
          {burial.veteran ? <span className="burial-veteran-badge">Veteran</span> : null}
          {serviceText ? <span>{serviceText}</span> : null}
        </p>
      ) : null}
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

function GraveSpaceRecord({ grave, canUpdate, onSave }: { grave: GraveSpace; canUpdate: boolean; onSave: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveGraveSpaceInput>(() => blankGraveSpaceForm(grave));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

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

function mediaUrl(asset: MediaAsset) {
  if (/^https?:\/\//u.test(asset.fileUrl)) return asset.fileUrl;
  if (/^https?:\/\//u.test(apiBaseUrl)) return `${new URL(apiBaseUrl).origin}${asset.fileUrl}`;
  return asset.fileUrl;
}

function sortedMediaAssets(assets: MediaAsset[]) {
  return [...assets].sort((left, right) => {
    const leftOrder = left.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    const leftDate = Date.parse(left.capturedAt ?? left.uploadedAt ?? "");
    const rightDate = Date.parse(right.capturedAt ?? right.uploadedAt ?? "");
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
  });
}

function MediaGallery({
  assets,
  emptyMessage = "No photos are linked yet.",
  canDelete = false,
  onDelete,
  onMove,
}: {
  assets: MediaAsset[];
  emptyMessage?: string;
  canDelete?: boolean;
  onDelete?: (assetId: string, reason?: string) => Promise<void>;
  onMove?: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
}) {
  const sortedAssets = sortedMediaAssets(assets);
  const [deletingId, setDeletingId] = useState<string>();
  const [movingId, setMovingId] = useState<string>();
  const [error, setError] = useState<string>();
  if (!sortedAssets.length) return <p className="muted">{emptyMessage}</p>;

  const deleteAsset = async (asset: MediaAsset) => {
    if (!onDelete) return;
    const reason = window.prompt("Reason for deleting this photo?", "Replacing incorrect photo");
    if (reason === null) return;
    setDeletingId(asset.id);
    setError(undefined);
    try {
      await onDelete(asset.id, reason);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete photo.");
    } finally {
      setDeletingId(undefined);
    }
  };

  const moveAsset = async (asset: MediaAsset, direction: "earlier" | "later") => {
    if (!onMove) return;
    setMovingId(asset.id);
    setError(undefined);
    try {
      await onMove(asset, direction);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Unable to reorder photo.");
    } finally {
      setMovingId(undefined);
    }
  };

  return (
    <>
      <div className="media-gallery">
        {sortedAssets.map((asset, index) => (
          <div key={asset.id} className="media-gallery-card">
            <a className="media-gallery-item" href={mediaUrl(asset)} target="_blank" rel="noreferrer">
              <img src={mediaUrl(asset)} alt={asset.notes || asset.originalFilename || "Cemetery record photo"} loading="lazy" />
              <span>{asset.capturedAt ? `Date taken: ${formatDate(asset.capturedAt)}` : `Uploaded: ${formatDate(asset.uploadedAt)}`}</span>
            </a>
            {onMove && sortedAssets.length > 1 ? (
              <div className="media-order-controls" aria-label="Photo display order">
                <button
                  type="button"
                  onClick={() => void moveAsset(asset, "earlier")}
                  disabled={index === 0 || movingId === asset.id}
                  aria-label="Move photo earlier"
                  title="Move photo earlier"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void moveAsset(asset, "later")}
                  disabled={index === sortedAssets.length - 1 || movingId === asset.id}
                  aria-label="Move photo later"
                  title="Move photo later"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            {canDelete && onDelete ? (
              <button
                type="button"
                className="media-delete-button"
                onClick={() => void deleteAsset(asset)}
                disabled={deletingId === asset.id}
                aria-label={`Delete photo ${asset.originalFilename || asset.id}`}
                title="Delete photo"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <p className="detail-message is-error">{error}</p> : null}
    </>
  );
}

function PhotoUploadForm({
  headstones,
  fixedHeadstone,
  gravesiteOnly = false,
  onUpload,
}: {
  headstones: Headstone[];
  fixedHeadstone?: Headstone;
  gravesiteOnly?: boolean;
  onUpload: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
}) {
  const [file, setFile] = useState<File>();
  const [headstoneId, setHeadstoneId] = useState(fixedHeadstone?.id ?? "");
  const [capturedAt, setCapturedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0]);
    setMessage(undefined);
    setError(undefined);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!file) return;
    setIsSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onUpload({ file, headstoneId: fixedHeadstone?.id ?? (headstoneId || undefined), notes, capturedAt: capturedAt || undefined });
      setFile(undefined);
      setHeadstoneId(fixedHeadstone?.id ?? "");
      setCapturedAt("");
      setNotes("");
      setMessage("Photo uploaded and linked.");
      form.reset();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload photo.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="photo-upload-form" onSubmit={(event) => void submit(event)}>
      <label>
        Photo
        <input type="file" accept="image/*" capture="environment" onChange={chooseFile} />
      </label>
      {fixedHeadstone ? (
        <div className="photo-upload-linked-marker">
          <span>Linked marker</span>
          <strong>{fixedHeadstone.headstoneId}</strong>
        </div>
      ) : gravesiteOnly ? (
        <div className="photo-upload-linked-marker">
          <span>Linked record</span>
          <strong>Gravesite overview</strong>
        </div>
      ) : (
        <label>
          Link marker
          <select value={headstoneId} onChange={(event) => setHeadstoneId(event.target.value)}>
            <option value="">Gravesite overview</option>
            {headstones.map((headstone) => (
              <option key={headstone.id} value={headstone.id}>
                {headstone.headstoneId}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Date taken
        <input type="date" value={capturedAt} onChange={(event) => setCapturedAt(event.target.value)} />
      </label>
      <label className="headstone-wide-field">
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
      </label>
      {message ? <p className="detail-message is-success">{message}</p> : null}
      {error ? <p className="detail-message is-error">{error}</p> : null}
      <button type="submit" disabled={!file || isSaving}>
        <Camera size={15} aria-hidden="true" />
        {isSaving ? "Uploading..." : "Upload photo"}
      </button>
    </form>
  );
}

function blankHeadstoneForm(headstone: Headstone, markerTypeOptions?: LookupOption[]): SaveHeadstoneInput {
  const markerTypeId = markerTypeOptions?.some((option) => option.id === headstone.markerType.id) ? headstone.markerType.id : (markerTypeOptions?.[0]?.id ?? headstone.markerType.id);

  return {
    markerTypeId,
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
    reason: "Headstone detail update",
  };
}

function HeadstoneRecord({
  headstone,
  lookups,
  canUpdate,
  onSave,
  grave,
  sectionName,
  canDeletePhotos,
  canReorderPhotos,
  onDeletePhoto,
  onMovePhoto,
  canUploadPhotos,
  onUploadPhoto,
  onUpdateGraveFeature,
}: {
  headstone: Headstone;
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  onSave: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  grave?: GraveSpace;
  sectionName: string;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  canUploadPhotos: boolean;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
}) {
  const isSectionG = sectionName.toUpperCase() === "G";
  const markerTypeOptions = isSectionG ? lookups.markerTypes.filter((option) => option.code === "flat_marker") : lookups.markerTypes;
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveHeadstoneInput>(() => blankHeadstoneForm(headstone, markerTypeOptions));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const startEditing = () => {
    setForm(blankHeadstoneForm(headstone, markerTypeOptions));
    setError(undefined);
    setIsEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    try {
      await onSave(headstone.id, form);
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
        {error ? <p className="detail-message is-error">{error}</p> : null}
        <div className="headstone-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving || !form.markerTypeId || !form.materialId || !form.conditionId || markerTypeOptions.length === 0}>
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
      </dl>
      {headstone.vaseNotes ? <p className="note-box">Vase: {headstone.vaseNotes}</p> : null}
      {headstone.conditionNotes ? <p className="note-box">{headstone.conditionNotes}</p> : null}
      {headstone.inscription ? <p className="note-box inscription-box">{headstone.inscription}</p> : null}
      {headstone.designNotes ? <p className="note-box">Designs: {headstone.designNotes}</p> : null}
      {headstone.backDescription ? <p className="note-box">Back: {headstone.backDescription}</p> : null}
      {headstone.features?.length ? (
        <GraveFeatureList features={headstone.features} canUpdate={canUpdate} grave={grave} fixedHeadstone={headstone} lookups={lookups} onUpdate={onUpdateGraveFeature} />
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
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSelectMarkerGrave,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
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
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSelectMarkerGrave: (grave: GraveSpaceSummary) => void;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Marker</p>
          <h2>{summary.headstoneId}</h2>
          <p className="grave-cemetery">{summary.cemeteryName}</p>
        </div>
      </div>

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
            <h3>Marker</h3>
          </div>
          <div className="headstone-list">
            <HeadstoneRecord
              headstone={headstone}
              lookups={headstoneLookups}
              canUpdate={canUpdateHeadstones}
              onSave={onSaveHeadstone}
              sectionName=""
              canDeletePhotos={canDeletePhotos}
              canReorderPhotos={canReorderPhotos}
              onDeletePhoto={onDeletePhoto}
              onMovePhoto={onMovePhoto}
              canUploadPhotos={canUpdateHeadstones}
              onUploadPhoto={onUploadPhoto}
              onUpdateGraveFeature={onUpdateGraveFeature}
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
            <h3>Associated Gravesites</h3>
          </div>
          <AssociatedGravesiteList graves={markerGraves} emptyMessage="No gravesites are associated with this marker." onSelectGrave={onSelectMarkerGrave} />
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

function AssociatedGravesiteList({
  graves,
  emptyMessage,
  onSelectGrave,
}: {
  graves: GraveSpaceSummary[];
  emptyMessage: string;
  onSelectGrave: (grave: GraveSpaceSummary) => void;
}) {
  if (!graves.length) return <p className="muted">{emptyMessage}</p>;

  return (
    <div className="associated-gravesite-list">
      {graves.map((grave) => (
        <button key={`${grave.cemeteryId}:${grave.id}`} type="button" className="associated-gravesite-row" onClick={() => onSelectGrave(grave)}>
          <strong>{formatGraveLabel(grave)}</strong>
          <span className="associated-gravesite-status" style={{ "--status-color": statusColors[grave.status] } as CSSProperties}>
            {statusLabels[grave.status]}
          </span>
        </button>
      ))}
    </div>
  );
}

function graveFeatureFormFromRecord(feature: GraveFeature, grave?: GraveSpace, fixedHeadstone?: Headstone): SaveGraveFeatureInput {
  return {
    graveSpaceId: feature.gravesiteUuid && grave ? grave.id : "",
    headstoneId: feature.headstoneUuid ?? fixedHeadstone?.id ?? "",
    featureTypeId: feature.featureType.id,
    featureSubtypeId: feature.featureSubtype?.id ?? "",
    placementTypeId: feature.placement?.id ?? "",
    materialTypeId: feature.material?.id ?? "",
    symbolText: feature.symbolText ?? "",
    sourceType: feature.sourceType || "manual",
    sourceText: feature.sourceText ?? "",
    notes: feature.notes ?? "",
    status: feature.status,
    reason: "Update grave feature",
  };
}

function GraveFeatureList({
  features,
  emptyMessage = "No grave features are recorded.",
  canUpdate = false,
  grave,
  fixedHeadstone,
  lookups,
  onUpdate,
}: {
  features: GraveFeature[];
  emptyMessage?: string;
  canUpdate?: boolean;
  grave?: GraveSpace;
  fixedHeadstone?: Headstone;
  lookups?: HeadstoneLookups;
  onUpdate?: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
}) {
  const [editingId, setEditingId] = useState<string>();
  if (!features.length) return <p className="muted">{emptyMessage}</p>;

  return (
    <div className="grave-feature-list">
      {features.map((feature) => {
        const details = [feature.featureSubtype?.label, feature.placement?.label, feature.material?.label].filter(Boolean).join(" | ");
        if (editingId === feature.id && lookups && onUpdate) {
          return (
            <article key={feature.id} className="grave-feature-row">
              <GraveFeatureForm
                grave={grave}
                headstones={fixedHeadstone ? [fixedHeadstone] : []}
                fixedHeadstone={fixedHeadstone}
                lookups={lookups}
                initialFeature={feature}
                onSave={(input) => onUpdate(feature.id, input)}
                onCancel={() => setEditingId(undefined)}
                submitLabel="Save feature"
              />
            </article>
          );
        }
        return (
          <article key={feature.id} className="grave-feature-row">
            <div className="record-heading">
              <strong>{feature.featureType.label}</strong>
              {canUpdate && lookups && onUpdate ? (
                <button type="button" className="secondary-button compact-button" onClick={() => setEditingId(feature.id)}>
                  <Pencil size={14} aria-hidden="true" />
                  Edit
                </button>
              ) : null}
            </div>
            {details ? <span>{details}</span> : null}
            {feature.symbolText ? <span>Symbol: {feature.symbolText}</span> : null}
            {feature.sourceText ? <p>{feature.sourceText}</p> : null}
            {feature.notes ? <p>{feature.notes}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

function GraveFeatureForm({
  grave,
  headstones,
  fixedHeadstone,
  lookups,
  initialFeature,
  submitLabel = "Add feature",
  onCancel,
  onSave,
}: {
  grave?: GraveSpace;
  headstones: Headstone[];
  fixedHeadstone?: Headstone;
  lookups: HeadstoneLookups;
  initialFeature?: GraveFeature;
  submitLabel?: string;
  onCancel?: () => void;
  onSave: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
}) {
  const defaultTypeId = lookups.graveFeatureTypes.find((option) => option.code === "flag_holder")?.id ?? lookups.graveFeatureTypes[0]?.id ?? "";
  const defaultSubtypeId = lookups.graveFeatureSubtypes.find((option) => option.code === "us_veteran_star")?.id ?? "";
  const defaultPlacementId = lookups.graveFeaturePlacements.find((option) => option.code === "separate")?.id ?? "";
  const [form, setForm] = useState<SaveGraveFeatureInput>(() =>
    initialFeature
      ? graveFeatureFormFromRecord(initialFeature, grave, fixedHeadstone)
      : {
          graveSpaceId: grave?.id ?? "",
          headstoneId: fixedHeadstone?.id ?? "",
          featureTypeId: defaultTypeId,
          featureSubtypeId: defaultSubtypeId,
          placementTypeId: defaultPlacementId,
          materialTypeId: "",
          symbolText: "",
          sourceType: "nhg",
          sourceText: "",
          notes: "",
          status: "active",
          reason: "Add grave feature",
        },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const selectedFeatureTypeCode = lookups.graveFeatureTypes.find((option) => option.id === form.featureTypeId)?.code;
  const subtypeOptions = lookups.graveFeatureSubtypes.filter((option) => !option.featureTypeCode || !selectedFeatureTypeCode || option.featureTypeCode === selectedFeatureTypeCode);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onSave(form);
      if (initialFeature) {
        onCancel?.();
      } else {
        setMessage("Feature recorded.");
        setForm((current) => ({
          ...current,
          sourceText: "",
          notes: "",
        }));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save feature.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!lookups.graveFeatureTypes.length) return null;

  return (
    <form className="headstone-record headstone-form" onSubmit={(event) => void save(event)}>
      <label>
        Feature
        <select
          value={form.featureTypeId}
          onChange={(event) =>
            setForm((current) => {
              const nextFeatureTypeCode = lookups.graveFeatureTypes.find((option) => option.id === event.target.value)?.code;
              const subtypeStillApplies = lookups.graveFeatureSubtypes.some(
                (option) => option.id === current.featureSubtypeId && (!option.featureTypeCode || !nextFeatureTypeCode || option.featureTypeCode === nextFeatureTypeCode),
              );
              return {
                ...current,
                featureTypeId: event.target.value,
                featureSubtypeId: subtypeStillApplies ? current.featureSubtypeId : "",
              };
            })
          }
        >
          {lookups.graveFeatureTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Subtype
        <select value={form.featureSubtypeId} onChange={(event) => setForm((current) => ({ ...current, featureSubtypeId: event.target.value }))}>
          <option value="">Not recorded</option>
          {subtypeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Placement
        <select value={form.placementTypeId} onChange={(event) => setForm((current) => ({ ...current, placementTypeId: event.target.value }))}>
          <option value="">Not recorded</option>
          {lookups.graveFeaturePlacements.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Material
        <select value={form.materialTypeId} onChange={(event) => setForm((current) => ({ ...current, materialTypeId: event.target.value }))}>
          <option value="">Not recorded</option>
          {lookups.graveFeatureMaterials.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {fixedHeadstone ? (
        <div className="photo-upload-linked-marker">
          <span>Linked marker</span>
          <strong>{fixedHeadstone.headstoneId}</strong>
        </div>
      ) : (
        <label>
          Linked marker
          <select value={form.headstoneId} onChange={(event) => setForm((current) => ({ ...current, headstoneId: event.target.value }))}>
            <option value="">Gravesite only</option>
            {headstones.map((headstone) => (
              <option key={headstone.id} value={headstone.id}>
                {headstone.headstoneId}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Symbol
        <input value={form.symbolText} onChange={(event) => setForm((current) => ({ ...current, symbolText: event.target.value }))} />
      </label>
      <label>
        Source
        <select value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))}>
          <option value="nhg">NHG</option>
          <option value="photo">Photo</option>
          <option value="field_survey">Field survey</option>
          <option value="manual">Manual</option>
          <option value="import">Import</option>
        </select>
      </label>
      <label>
        Status
        <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SaveGraveFeatureInput["status"] }))}>
          <option value="active">Active</option>
          <option value="needs_review">Needs review</option>
          <option value="retired">Retired</option>
        </select>
      </label>
      <label className="headstone-wide-field">
        Source text
        <textarea value={form.sourceText} onChange={(event) => setForm((current) => ({ ...current, sourceText: event.target.value }))} rows={2} />
      </label>
      <label className="headstone-wide-field">
        Notes
        <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} />
      </label>
      {message ? <p className="detail-message is-success">{message}</p> : null}
      {error ? <p className="detail-message is-error">{error}</p> : null}
      <div className="headstone-form-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        ) : null}
        <button type="submit" disabled={isSaving || !form.featureTypeId || (!form.graveSpaceId && !form.headstoneId)}>
          <Flag size={15} aria-hidden="true" />
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

const maintenanceStatusLabels: Record<MaintenanceRecord["status"], string> = {
  open: "Open",
  scheduled: "Scheduled",
  completed: "Completed",
  deferred: "Deferred",
  not_needed: "Not needed",
};

const maintenanceSourceLabels: Record<SaveMaintenanceRecordInput["sourceType"], string> = {
  manual: "Manual",
  inspection: "Inspection",
  work_order: "Work order",
  photo: "Photo",
  import: "Import",
};

function maintenanceFormFromRecord(record: MaintenanceRecord, grave?: GraveSpace, fixedHeadstone?: Headstone): SaveMaintenanceRecordInput {
  return {
    targetType: record.headstoneUuid ? "headstone" : "gravesite",
    graveSpaceId: record.gravesiteUuid && grave ? grave.id : "",
    headstoneId: record.headstoneUuid ?? fixedHeadstone?.id ?? "",
    issueTypeId: record.issueType?.id ?? "",
    actionTypeId: record.actionType?.id ?? "",
    priorityTypeId: record.priority.id,
    status: record.status,
    observedAt: record.observedAt,
    completedAt: record.completedAt ?? "",
    performedBy: record.performedBy ?? "",
    sourceType: record.sourceType,
    notes: record.notes ?? "",
    reason: "Update maintenance record",
  };
}

function MaintenanceRecordList({
  records,
  canUpdate = false,
  grave,
  fixedHeadstone,
  lookups,
  onUpdate,
}: {
  records: MaintenanceRecord[];
  canUpdate?: boolean;
  grave?: GraveSpace;
  fixedHeadstone?: Headstone;
  lookups?: HeadstoneLookups;
  onUpdate?: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
}) {
  const [editingId, setEditingId] = useState<string>();
  if (!records.length) return <p className="muted">No maintenance records are recorded.</p>;

  return (
    <div className="maintenance-list">
      {records.map((record) => {
        const title = [record.issueType?.label, record.actionType?.label].filter(Boolean).join(" / ");
        const dateParts = [`Observed ${formatDate(record.observedAt)}`];
        if (record.completedAt) dateParts.push(`Completed ${formatDate(record.completedAt)}`);
        if (editingId === record.id && lookups && onUpdate) {
          return (
            <article key={record.id} className={`maintenance-row maintenance-row-${record.status}`}>
              <MaintenanceRecordForm
                grave={grave}
                fixedHeadstone={fixedHeadstone}
                lookups={lookups}
                initialRecord={record}
                onSave={(input) => onUpdate(record.id, input)}
                onCancel={() => setEditingId(undefined)}
                submitLabel="Save maintenance"
              />
            </article>
          );
        }
        return (
          <article key={record.id} className={`maintenance-row maintenance-row-${record.status}`}>
            <div>
              <div className="record-heading">
                <strong>{title || "Maintenance record"}</strong>
                {canUpdate && lookups && onUpdate ? (
                  <button type="button" className="secondary-button compact-button" onClick={() => setEditingId(record.id)}>
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
              </div>
              <span>{dateParts.join(" | ")}</span>
            </div>
            <div className="maintenance-row-meta">
              <span>{maintenanceStatusLabels[record.status]}</span>
              <span>{record.priority.label}</span>
            </div>
            {record.performedBy ? <p>By {record.performedBy}</p> : null}
            {record.notes ? <p>{record.notes}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

function MaintenanceRecordForm({
  grave,
  fixedHeadstone,
  lookups,
  initialRecord,
  submitLabel = "Add maintenance",
  onCancel,
  onSave,
}: {
  grave?: GraveSpace;
  fixedHeadstone?: Headstone;
  lookups: HeadstoneLookups;
  initialRecord?: MaintenanceRecord;
  submitLabel?: string;
  onCancel?: () => void;
  onSave: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultPriorityId = lookups.maintenancePriorities.find((option) => option.code === "normal")?.id ?? lookups.maintenancePriorities[0]?.id ?? "";
  const [form, setForm] = useState<SaveMaintenanceRecordInput>(() =>
    initialRecord
      ? maintenanceFormFromRecord(initialRecord, grave, fixedHeadstone)
      : {
          targetType: fixedHeadstone ? "headstone" : "gravesite",
          graveSpaceId: fixedHeadstone ? "" : (grave?.id ?? ""),
          headstoneId: fixedHeadstone?.id ?? "",
          issueTypeId: lookups.maintenanceIssueTypes[0]?.id ?? "",
          actionTypeId: "",
          priorityTypeId: defaultPriorityId,
          status: "open",
          observedAt: today,
          completedAt: "",
          performedBy: "",
          sourceType: "manual",
          notes: "",
          reason: "Record maintenance",
        },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onSave(form);
      if (initialRecord) {
        onCancel?.();
      } else {
        setMessage("Maintenance recorded.");
        setForm((current) => ({
          ...current,
          issueTypeId: lookups.maintenanceIssueTypes[0]?.id ?? "",
          actionTypeId: "",
          status: "open",
          completedAt: "",
          notes: "",
        }));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save maintenance record.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!lookups.maintenancePriorities.length || (!lookups.maintenanceIssueTypes.length && !lookups.maintenanceActionTypes.length)) return null;

  return (
    <form className="headstone-record headstone-form maintenance-form" onSubmit={(event) => void save(event)}>
      <label>
        Issue
        <select value={form.issueTypeId} onChange={(event) => setForm((current) => ({ ...current, issueTypeId: event.target.value }))}>
          <option value="">No issue</option>
          {lookups.maintenanceIssueTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Action
        <select value={form.actionTypeId} onChange={(event) => setForm((current) => ({ ...current, actionTypeId: event.target.value }))}>
          <option value="">No action</option>
          {lookups.maintenanceActionTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SaveMaintenanceRecordInput["status"] }))}>
          {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select value={form.priorityTypeId} onChange={(event) => setForm((current) => ({ ...current, priorityTypeId: event.target.value }))}>
          {lookups.maintenancePriorities.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Observed
        <input type="date" value={form.observedAt} onChange={(event) => setForm((current) => ({ ...current, observedAt: event.target.value }))} />
      </label>
      <label>
        Completed
        <input type="date" value={form.completedAt} onChange={(event) => setForm((current) => ({ ...current, completedAt: event.target.value }))} />
      </label>
      <label>
        Source
        <select value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as SaveMaintenanceRecordInput["sourceType"] }))}>
          {Object.entries(maintenanceSourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Performed by
        <input value={form.performedBy} onChange={(event) => setForm((current) => ({ ...current, performedBy: event.target.value }))} />
      </label>
      <label className="headstone-wide-field">
        Notes
        <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} />
      </label>
      {message ? <p className="detail-message is-success">{message}</p> : null}
      {error ? <p className="detail-message is-error">{error}</p> : null}
      <div className="headstone-form-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        ) : null}
        <button type="submit" disabled={isSaving || !form.priorityTypeId || (!form.issueTypeId && !form.actionTypeId)}>
          <History size={15} aria-hidden="true" />
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
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
  headstones,
  northHillsEvidence,
  mediaAssets,
  canViewOwnership,
  canUpdateGravesites,
  canUpdateBurials,
  canUpdateHeadstones,
  headstoneLookups,
  onSaveGraveSpace,
  onSaveBurial,
  onSaveHeadstone,
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSaveOwnershipEvent,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  canDeletePhotos,
  canReorderPhotos,
  isLoading,
  error,
  onRetry,
}: {
  ownersById: Map<string, Owner>;
  summary: GraveSpaceSummary;
  grave?: GraveSpace;
  headstones: Headstone[];
  northHillsEvidence: NorthHillsLinkedEvidence[];
  mediaAssets: MediaAsset[];
  canViewOwnership: boolean;
  canUpdateGravesites: boolean;
  canUpdateBurials: boolean;
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  onSaveGraveSpace: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onSaveBurial: (id: string, burial: SaveBurialInput) => Promise<Burial>;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onSaveGraveFeature: (feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onUpdateGraveFeature: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onSaveMaintenanceRecord: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onUpdateMaintenanceRecord: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
  onSaveOwnershipEvent: (event: SaveOwnershipEventInput) => Promise<void>;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string; capturedAt?: string }) => Promise<void>;
  onDeletePhoto: (assetId: string, reason?: string) => Promise<void>;
  onMovePhoto: (asset: MediaAsset, direction: "earlier" | "later") => Promise<void>;
  canDeletePhotos: boolean;
  canReorderPhotos: boolean;
  isLoading: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  const title = formatGraveLabel(summary);

  return (
    <aside className="detail-panel">
      <div className="grave-title-row">
        <div>
          <p className="eyebrow">Grave site</p>
          <h2>{title}</h2>
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
          <section className="detail-section">
            <div className="section-title">
              <MapPinned size={17} aria-hidden="true" />
              <h3>Gravesite</h3>
            </div>
            <GraveSpaceRecord grave={grave} canUpdate={canUpdateGravesites} onSave={onSaveGraveSpace} />
          </section>

          {canViewOwnership ? (
            <section className="detail-section">
              <div className="section-title">
                <Landmark size={17} aria-hidden="true" />
                <h3>Current Owner</h3>
              </div>
              <div className="owner-list">
                {grave.currentOwnerIds.length ? (
                  grave.currentOwnerIds.map((id) => {
                    const owner = ownersById.get(id);
                    return (
                      <div key={id} className="owner-row">
                        <strong>{owner?.displayName ?? "Unknown owner"}</strong>
                        {owner?.contactNote ? <span>{owner.contactNote}</span> : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="muted">No current ownership is recorded.</p>
                )}
              </div>
              {canUpdateGravesites ? <OwnershipEventForm grave={grave} onSave={onSaveOwnershipEvent} /> : null}
            </section>
          ) : null}

          <section className="detail-section">
            <div className="section-title">
              <UserRound size={17} aria-hidden="true" />
              <h3>Burials</h3>
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
                    sectionName={summary.section}
                    canDeletePhotos={canDeletePhotos}
                    canReorderPhotos={canReorderPhotos}
                    onDeletePhoto={onDeletePhoto}
                    onMovePhoto={onMovePhoto}
                    canUploadPhotos={canUpdateHeadstones}
                    onUploadPhoto={onUploadPhoto}
                    onUpdateGraveFeature={onUpdateGraveFeature}
                  />
                ))}
              </div>
            ) : (
              <p className="muted">No markers are recorded for this grave site.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="section-title">
              <Flag size={17} aria-hidden="true" />
              <h3>Grave Features</h3>
            </div>
            <GraveFeatureList features={grave.features ?? []} canUpdate={canUpdateHeadstones} grave={grave} lookups={headstoneLookups} onUpdate={onUpdateGraveFeature} />
            {canUpdateHeadstones ? <GraveFeatureForm grave={grave} headstones={headstones} lookups={headstoneLookups} onSave={onSaveGraveFeature} /> : null}
          </section>

          <section className="detail-section">
            <div className="section-title">
              <History size={17} aria-hidden="true" />
              <h3>Maintenance</h3>
            </div>
            <MaintenanceRecordList records={grave.maintenanceRecords ?? []} canUpdate={canUpdateGravesites} grave={grave} lookups={headstoneLookups} onUpdate={onUpdateMaintenanceRecord} />
            {canUpdateGravesites ? <MaintenanceRecordForm grave={grave} lookups={headstoneLookups} onSave={onSaveMaintenanceRecord} /> : null}
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

          {northHillsEvidence.length ? (
            <section className="detail-section">
              <div className="section-title">
                <FileText size={17} aria-hidden="true" />
                <h3>North Hills Evidence</h3>
              </div>
              <NorthHillsEvidenceList evidence={northHillsEvidence} />
            </section>
          ) : null}

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
                      <span>{event.ownerIds.map((id) => ownerName(ownersById, id)).join(", ")}</span>
                      <small>{event.recordedBy}</small>
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

          {grave.notes ? (
            <section className="detail-section">
              <div className="section-title">
                <FileText size={17} aria-hidden="true" />
                <h3>Notes</h3>
              </div>
              <p className="note-box">{grave.notes}</p>
            </section>
          ) : null}

          <section className="detail-section">
            <div className="section-title">
              <MapPinned size={17} aria-hidden="true" />
              <h3>Geometry</h3>
            </div>
            <GraveGeometryMetadata grave={grave} />
          </section>
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
  lotRestrictedAreas = [],
  grave,
  standaloneHeadstoneSummary,
  standaloneHeadstone,
  markerGraves = [],
  canViewOwnership,
  canUpdateGravesites,
  canUpdateBurials,
  canUpdateHeadstones,
  headstoneLookups,
  onSaveGraveSpace,
  onSaveBurial,
  onSaveHeadstone,
  onSaveGraveFeature,
  onUpdateGraveFeature,
  onSaveMaintenanceRecord,
  onUpdateMaintenanceRecord,
  onSaveOwnershipEvent,
  onSelectLotGrave,
  onSelectMarkerGrave,
  onUploadPhoto,
  onDeletePhoto,
  onMovePhoto,
  canDeletePhotos,
  canReorderPhotos,
  isLoading = false,
  error,
  onRetry,
}: DetailPanelProps) {
  const ownersById = useMemo(() => new Map(owners.map((owner) => [owner.id, owner])), [owners]);
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
        onSaveGraveFeature={onSaveGraveFeature}
        onUpdateGraveFeature={onUpdateGraveFeature}
        onSaveMaintenanceRecord={onSaveMaintenanceRecord}
        onUpdateMaintenanceRecord={onUpdateMaintenanceRecord}
        onSelectMarkerGrave={onSelectMarkerGrave}
        onUploadPhoto={onUploadPhoto}
        onDeletePhoto={onDeletePhoto}
        onMovePhoto={onMovePhoto}
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
      headstones={headstones}
      northHillsEvidence={northHillsEvidence}
      mediaAssets={mediaAssets}
      canViewOwnership={canViewOwnership}
      canUpdateGravesites={canUpdateGravesites}
      canUpdateBurials={canUpdateBurials}
      canUpdateHeadstones={canUpdateHeadstones}
      headstoneLookups={headstoneLookups}
      onSaveGraveSpace={onSaveGraveSpace}
      onSaveBurial={onSaveBurial}
      onSaveHeadstone={onSaveHeadstone}
      onSaveGraveFeature={onSaveGraveFeature}
      onUpdateGraveFeature={onUpdateGraveFeature}
      onSaveMaintenanceRecord={onSaveMaintenanceRecord}
      onUpdateMaintenanceRecord={onUpdateMaintenanceRecord}
      onSaveOwnershipEvent={onSaveOwnershipEvent}
      onUploadPhoto={onUploadPhoto}
      onDeletePhoto={onDeletePhoto}
      onMovePhoto={onMovePhoto}
      canDeletePhotos={canDeletePhotos}
      canReorderPhotos={canReorderPhotos}
      isLoading={isLoading}
      error={error}
      onRetry={onRetry}
    />
  );
}
