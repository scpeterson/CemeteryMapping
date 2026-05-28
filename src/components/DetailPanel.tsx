import { FormEvent, useMemo, useState } from "react";
import { FileText, History, Landmark, MapPinned, Pencil, UserRound } from "lucide-react";
import type { Burial, GraveSpace, GraveSpaceSummary, Headstone, HeadstoneLookups, Owner, SaveHeadstoneInput } from "../types";
import { burialNoteItems } from "../lib/burialNotes";
import { formatDate, formatGraveLabel, fullName } from "../lib/format";

type DetailPanelProps = {
  owners: Owner[];
  summary?: GraveSpaceSummary;
  grave?: GraveSpace;
  canViewOwnership: boolean;
  canUpdateHeadstones: boolean;
  headstoneLookups: HeadstoneLookups;
  onSaveHeadstone: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
};

const ownerName = (ownersById: Map<string, Owner>, ownerId: string) => ownersById.get(ownerId)?.displayName ?? "Unknown owner";

function BurialRecord({ burial }: { burial: Burial }) {
  const noteItems = burialNoteItems(burial.notes);

  return (
    <article className="burial-record">
      <strong>{fullName(burial.person)}</strong>
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

function blankHeadstoneForm(headstone: Headstone): SaveHeadstoneInput {
  return {
    markerTypeId: headstone.markerType.id,
    materialId: headstone.material.id,
    conditionId: headstone.condition.id,
    conditionNotes: headstone.conditionNotes,
    inscription: headstone.inscription,
    photoUrl: headstone.photoUrl,
    lastInspectedAt: headstone.lastInspectedAt ?? "",
    reason: "Headstone detail update",
  };
}

function HeadstoneRecord({
  headstone,
  lookups,
  canUpdate,
  onSave,
}: {
  headstone: Headstone;
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  onSave: (id: string, headstone: SaveHeadstoneInput) => Promise<Headstone>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveHeadstoneInput>(() => blankHeadstoneForm(headstone));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const startEditing = () => {
    setForm(blankHeadstoneForm(headstone));
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
            {lookups.markerTypes.map((option) => (
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
          Photo URL
          <input value={form.photoUrl} onChange={(event) => setForm((current) => ({ ...current, photoUrl: event.target.value }))} />
        </label>
        {error ? <p className="detail-message is-error">{error}</p> : null}
        <div className="headstone-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving || !form.markerTypeId || !form.materialId || !form.conditionId}>
            {isSaving ? "Saving..." : "Save marker"}
          </button>
        </div>
      </form>
    );
  }

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
      {headstone.inscription ? <p className="note-box">{headstone.inscription}</p> : null}
      {headstone.relationshipType !== "primary" || headstone.relationshipNotes ? (
        <p className="muted">
          Relationship: {headstone.relationshipType}
          {headstone.relationshipNotes ? ` - ${headstone.relationshipNotes}` : ""}
        </p>
      ) : null}
    </article>
  );
}

export function DetailPanel({
  owners,
  summary,
  grave,
  canViewOwnership,
  canUpdateHeadstones,
  headstoneLookups,
  onSaveHeadstone,
  isLoading = false,
  error,
  onRetry,
}: DetailPanelProps) {
  const ownersById = useMemo(() => new Map(owners.map((owner) => [owner.id, owner])), [owners]);
  const headstones = grave?.headstones ?? [];

  if (!summary) {
    return (
      <aside className="detail-panel empty-state">
        <MapPinned size={28} aria-hidden="true" />
        <h2>Select a grave site</h2>
        <p>Click a mapped grave space or choose a search result to view burial status and record history.</p>
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

      {canViewOwnership ? (
      <section className="detail-section">
        <div className="section-title">
          <Landmark size={17} aria-hidden="true" />
          <h3>Current Owner</h3>
        </div>
        <div className="owner-list">
          {grave.currentOwnerIds.map((id) => {
            const owner = ownersById.get(id);
            return (
              <div key={id} className="owner-row">
                <strong>{owner?.displayName ?? "Unknown owner"}</strong>
                {owner?.contactNote ? <span>{owner.contactNote}</span> : null}
              </div>
            );
          })}
        </div>
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
              <BurialRecord key={burial.id} burial={burial} />
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
              />
            ))}
          </div>
        ) : (
          <p className="muted">No markers are recorded for this grave site.</p>
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
