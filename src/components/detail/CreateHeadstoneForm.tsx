import { MapPinned } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type {
  GraveSpace,
  Headstone,
  HeadstoneLookups,
  SaveHeadstoneCreateInput
} from "../../types";
import { PickedMarkerPoint } from "./detailTypes";

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

export function CreateHeadstoneForm({
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
