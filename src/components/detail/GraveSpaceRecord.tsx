import { useDraftState } from "../../hooks/useDraftState";
import { Pencil } from "lucide-react";
import { FormEvent, useState } from "react";
import { ApiError } from "../../api/apiClient";
import { fetchGraveSpace } from "../../api/cemeteryApi";
import { formatGraveLabel } from "../../lib/format";
import type {
  CemeteryLot,
  GraveSpace,
  GraveStatus,
  SaveGraveSpaceInput
} from "../../types";

const graveStatusOptions: { value: GraveStatus; label: string }[] = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "occupied", label: "Occupied" },
  { value: "sold", label: "Sold" },
  { value: "needs_review", label: "Needs review" },
  { value: "unknown", label: "Unknown" },
];

function blankGraveSpaceForm(grave: GraveSpace): SaveGraveSpaceInput {
  return {
    name: grave.name,
    expectedVersion: grave.version,
    status: grave.status,
    cost: grave.cost === undefined ? "" : String(grave.cost),
    reason: "Gravesite detail update",
  };
}

export function GraveSpaceRecord({ grave, lots, inferredLot, canUpdate, canManageLot, onSave, onUpdateLot }: {
  grave: GraveSpace;
  lots: CemeteryLot[];
  inferredLot?: { lot: CemeteryLot; source: string; confidence: "high" | "review" };
  canUpdate: boolean;
  canManageLot: boolean;
  onSave: (graveSpace: SaveGraveSpaceInput) => Promise<GraveSpace>;
  onUpdateLot: (lotId: string) => Promise<void>;
}) {
  const [hasConflict, setHasConflict] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useDraftState<SaveGraveSpaceInput>(() => blankGraveSpaceForm(grave));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [lotValue, setLotValue] = useState(grave.lot);
  const [isSavingLot, setIsSavingLot] = useState(false);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);

  const startEditing = () => {
    setForm(blankGraveSpaceForm(grave));
    setHasConflict(false);
    setError(undefined);
    setIsEditing(true);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    try {
      await onSave(form);
      setForm(form);
      setIsEditing(false);
    } catch (saveError) {
      setHasConflict(saveError instanceof ApiError && saveError.status === 409);
      setError(saveError instanceof Error ? saveError.message : "Unable to save gravesite.");
    } finally {
      setIsSaving(false);
    }
  };

  const reloadLatest = async () => {
    setIsSaving(true);
    try {
      const latest = await fetchGraveSpace(grave.cemeteryId, grave.id);
      setForm(blankGraveSpaceForm(latest));
      setHasConflict(false);
      setError(undefined);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to reload gravesite.");
    } finally { setIsSaving(false); }
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
        {hasConflict ? <button type="button" disabled={isSaving} onClick={() => void reloadLatest()}>Reload latest values (discard edits)</button> : null}
        <div className="grave-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving || hasConflict}>
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
