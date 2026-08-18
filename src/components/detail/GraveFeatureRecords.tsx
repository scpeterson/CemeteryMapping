import { FormEvent, useState } from "react";
import { Flag, Pencil, Trash2 } from "lucide-react";
import type { GraveFeature, GraveSpace, Headstone, HeadstoneLookups, SaveGraveFeatureInput } from "../../types";

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

export function GraveFeatureList({
  features,
  emptyMessage = "No grave features are recorded.",
  canUpdate = false,
  canDelete = false,
  grave,
  fixedHeadstone,
  lookups,
  onUpdate,
  onDelete,
}: {
  features: GraveFeature[];
  emptyMessage?: string;
  canUpdate?: boolean;
  canDelete?: boolean;
  grave?: GraveSpace;
  fixedHeadstone?: Headstone;
  lookups?: HeadstoneLookups;
  onUpdate?: (id: string, feature: SaveGraveFeatureInput) => Promise<GraveFeature>;
  onDelete?: (id: string, reason?: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();
  if (!features.length) return <p className="muted">{emptyMessage}</p>;

  const deleteFeature = async (feature: GraveFeature) => {
    if (!onDelete) return;
    const reason = window.prompt("Reason for deleting this grave feature?", "Recorded in error");
    if (reason === null) return;
    setDeletingId(feature.id);
    setDeleteError(undefined);
    try {
      await onDelete(feature.id, reason);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete grave feature.");
    } finally {
      setDeletingId(undefined);
    }
  };

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
              <div className="record-actions">
                {canUpdate && lookups && onUpdate ? (
                  <button type="button" className="secondary-button compact-button" onClick={() => setEditingId(feature.id)}>
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
                {canDelete && onDelete ? (
                  <button
                    type="button"
                    className="secondary-button compact-button danger-button"
                    onClick={() => void deleteFeature(feature)}
                    disabled={deletingId === feature.id}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {deletingId === feature.id ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
            {details ? <span>{details}</span> : null}
            {feature.symbolText ? <span>Symbol: {feature.symbolText}</span> : null}
            {feature.sourceText ? <p>{feature.sourceText}</p> : null}
            {feature.notes ? <p>{feature.notes}</p> : null}
          </article>
        );
      })}
      {deleteError ? <p className="detail-message is-error">{deleteError}</p> : null}
    </div>
  );
}

export function GraveFeatureForm({
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

