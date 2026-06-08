import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { Camera, FileText, History, Images, Info, Landmark, MapPinned, Pencil, UserRound } from "lucide-react";
import type {
  Burial,
  GraveSpace,
  GraveSpaceSummary,
  GraveStatus,
  Headstone,
  HeadstoneLookups,
  HeadstoneSummary,
  LookupOption,
  MediaAsset,
  NorthHillsLinkedEvidence,
  Owner,
  OwnershipEventType,
  OwnershipTargetScope,
  SaveBurialInput,
  SaveGraveSpaceInput,
  SaveHeadstoneInput,
  SaveOwnershipEventInput,
} from "../types";
import { apiBaseUrl } from "../config/environment";
import { burialNoteItems } from "../lib/burialNotes";
import { formatDate, formatGraveLabel, fullName } from "../lib/format";

type DetailPanelProps = {
  owners: Owner[];
  summary?: GraveSpaceSummary;
  grave?: GraveSpace;
  standaloneHeadstoneSummary?: HeadstoneSummary;
  standaloneHeadstone?: Headstone;
  canViewOwnership: boolean;
  canUpdateGravesites: boolean;
  canUpdateBurials: boolean;
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  onSaveGraveSpace: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onSaveBurial: (id: string, burial: SaveBurialInput) => Promise<Burial>;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  onSaveOwnershipEvent: (event: SaveOwnershipEventInput) => Promise<void>;
  onUploadPhoto: (input: { file: File; headstoneId?: string; notes?: string }) => Promise<void>;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

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
    birthDate: burial.person.birthDate ?? "",
    deathDate: burial.person.deathDate ?? "",
    burialDate: burial.burialDate ?? "",
    intermentType: burial.intermentType ?? "casket",
    funeralHome: burial.funeralHome ?? "",
    notes: burial.recordNotes ?? "",
    reason: "Burial detail update",
  };
}

function BurialRecord({ burial, canUpdate, onSave }: { burial: Burial; canUpdate: boolean; onSave: (id: string, burial: SaveBurialInput) => Promise<Burial> }) {
  const noteItems = burialNoteItems(burial.notes);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveBurialInput>(() => blankBurialForm(burial));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const startEditing = () => {
    setForm(blankBurialForm(burial));
    setError(undefined);
    setIsEditing(true);
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
          Birth date
          <input type="date" value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} />
        </label>
        <label>
          Death date
          <input type="date" value={form.deathDate} onChange={(event) => setForm((current) => ({ ...current, deathDate: event.target.value }))} />
        </label>
        <label>
          Burial date
          <input type="date" value={form.burialDate} onChange={(event) => setForm((current) => ({ ...current, burialDate: event.target.value }))} />
        </label>
        <label>
          Interment
          <select value={form.intermentType} onChange={(event) => setForm((current) => ({ ...current, intermentType: event.target.value as "casket" | "urn" }))}>
            <option value="casket">Casket</option>
            <option value="urn">Funeral urn</option>
          </select>
        </label>
        <label className="burial-wide-field">
          Funeral home
          <input value={form.funeralHome} onChange={(event) => setForm((current) => ({ ...current, funeralHome: event.target.value }))} />
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
          <dd>{burial.intermentType === "urn" ? "Funeral urn" : "Casket"}</dd>
        </div>
      </dl>
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

function newestMediaAsset(assets: MediaAsset[]) {
  return [...assets].sort((left, right) => {
    const leftDate = Date.parse(left.capturedAt ?? left.uploadedAt ?? "");
    const rightDate = Date.parse(right.capturedAt ?? right.uploadedAt ?? "");
    return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
  })[0];
}

function MediaGallery({ assets, emptyMessage = "No photos are linked yet." }: { assets: MediaAsset[]; emptyMessage?: string }) {
  const asset = newestMediaAsset(assets);
  if (!asset) return <p className="muted">{emptyMessage}</p>;

  return (
    <div className="media-gallery">
      <a className="media-gallery-item" href={mediaUrl(asset)} target="_blank" rel="noreferrer">
        <img src={mediaUrl(asset)} alt={asset.notes || asset.originalFilename || "Cemetery record photo"} loading="lazy" />
        <span>{asset.capturedAt ? formatDate(asset.capturedAt) : formatDate(asset.uploadedAt)}</span>
      </a>
    </div>
  );
}

function PhotoUploadForm({
  headstones,
  onUpload,
}: {
  headstones: Headstone[];
  onUpload: (input: { file: File; headstoneId?: string; notes?: string }) => Promise<void>;
}) {
  const [file, setFile] = useState<File>();
  const [headstoneId, setHeadstoneId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0]);
    setMessage(undefined);
    setError(undefined);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setIsSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onUpload({ file, headstoneId: headstoneId || undefined, notes });
      setFile(undefined);
      setHeadstoneId("");
      setNotes("");
      setMessage("Photo uploaded and linked.");
      (event.currentTarget as HTMLFormElement).reset();
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
  sectionName,
}: {
  headstone: Headstone;
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  onSave: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  sectionName: string;
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
          Last inspected
          <input type="date" value={form.lastInspectedAt} onChange={(event) => setForm((current) => ({ ...current, lastInspectedAt: event.target.value }))} />
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
        <div>
          <dt>Last inspected</dt>
          <dd>{formatDate(headstone.lastInspectedAt)}</dd>
        </div>
      </dl>
      {headstone.conditionNotes ? <p className="note-box">{headstone.conditionNotes}</p> : null}
      {headstone.inscription ? <p className="note-box inscription-box">{headstone.inscription}</p> : null}
      {headstone.designNotes ? <p className="note-box">Designs: {headstone.designNotes}</p> : null}
      {headstone.backDescription ? <p className="note-box">Back: {headstone.backDescription}</p> : null}
      {headstone.mediaAssets?.length ? <MediaGallery assets={headstone.mediaAssets} /> : null}
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

export function DetailPanel({
  owners,
  summary,
  grave,
  standaloneHeadstoneSummary,
  standaloneHeadstone,
  canViewOwnership,
  canUpdateGravesites,
  canUpdateBurials,
  canUpdateHeadstones,
  headstoneLookups,
  onSaveGraveSpace,
  onSaveBurial,
  onSaveHeadstone,
  onSaveOwnershipEvent,
  onUploadPhoto,
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
      <aside className="detail-panel">
        <div className="grave-title-row">
          <div>
            <p className="eyebrow">Marker</p>
            <h2>{standaloneHeadstoneSummary.headstoneId}</h2>
            <p className="grave-cemetery">{standaloneHeadstoneSummary.cemeteryName}</p>
          </div>
        </div>

        {isLoading ? (
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

        {!standaloneHeadstone || isLoading || error ? null : (
          <>
            <section className="detail-section">
              <div className="section-title">
                <Landmark size={17} aria-hidden="true" />
                <h3>Marker</h3>
              </div>
              <div className="headstone-list">
                <HeadstoneRecord
                  headstone={standaloneHeadstone}
                  lookups={headstoneLookups}
                  canUpdate={canUpdateHeadstones}
                  onSave={onSaveHeadstone}
                  sectionName=""
                />
              </div>
            </section>
          </>
        )}
      </aside>
    );
  }

  if (!summary) {
    return (
      <aside className="detail-panel empty-state">
        <MapPinned size={28} aria-hidden="true" />
        <h2>Select a grave site or marker</h2>
        <p>Click a mapped grave space, marker, or choose a search result to view cemetery records.</p>
      </aside>
    );
  }

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

      {isLoading ? (
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

      {!grave || isLoading || error ? null : (
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
              <BurialRecord key={burial.id} burial={burial} canUpdate={canUpdateBurials} onSave={onSaveBurial} />
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
                sectionName={summary.section}
              />
            ))}
          </div>
        ) : (
          <p className="muted">No markers are recorded for this grave site.</p>
        )}
      </section>

      <section className="detail-section">
        <div className="section-title">
          <Images size={17} aria-hidden="true" />
          <h3>Gravesite Photos</h3>
        </div>
        <MediaGallery assets={mediaAssets} emptyMessage="No gravesite overview photos are linked yet." />
        {canUpdateHeadstones ? <PhotoUploadForm headstones={headstones} onUpload={onUploadPhoto} /> : null}
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
        </>
      )}
    </aside>
  );
}
