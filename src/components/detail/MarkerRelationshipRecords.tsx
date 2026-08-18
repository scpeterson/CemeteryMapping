import { FormEvent, useState } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
import type { Headstone, HeadstoneLookups, HeadstoneRelationship, SaveHeadstoneRelationshipInput } from "../../types";

const markerRelationshipTypeOptions: Array<{ value: SaveHeadstoneRelationshipInput["relationshipType"]; label: string }> = [
  { value: "family_obelisk", label: "Family obelisk" },
  { value: "references_marker", label: "References marker" },
  { value: "common_base", label: "Common base" },
  { value: "foot_marker", label: "Foot marker" },
  { value: "related_marker", label: "Related marker" },
];

const markerRelationshipSourceOptions: Array<{ value: SaveHeadstoneRelationshipInput["sourceType"]; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "nhg", label: "NHG" },
  { value: "field_observation", label: "Field observation" },
  { value: "import", label: "Import" },
];

const confidenceOptions: Array<{ value: SaveHeadstoneRelationshipInput["confidence"]; label: string }> = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "review", label: "Needs review" },
];

const relationshipStatusOptions: Array<{ value: SaveHeadstoneRelationshipInput["status"]; label: string }> = [
  { value: "active", label: "Active" },
  { value: "needs_review", label: "Needs review" },
  { value: "retired", label: "Retired" },
];

function markerRelationshipTypeLabel(value: string) {
  return markerRelationshipTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function markerRelationshipSourceLabel(value: string) {
  return markerRelationshipSourceOptions.find((option) => option.value === value)?.label ?? value;
}

function markerRelationshipFormFromRecord(record: HeadstoneRelationship): SaveHeadstoneRelationshipInput {
  return {
    relatedHeadstoneId: record.relatedHeadstoneUuid,
    relationshipType: record.relationshipType,
    sourceType: record.sourceType,
    sourceText: record.sourceText,
    confidence: record.confidence,
    notes: record.notes,
    status: record.status,
    reason: "Update marker relationship",
  };
}

export function MarkerRelationshipForm({
  headstone,
  lookups,
  initialRelationship,
  submitLabel = "Add relationship",
  onCancel,
  onSave,
}: {
  headstone: Headstone;
  lookups: HeadstoneLookups;
  initialRelationship?: HeadstoneRelationship;
  submitLabel?: string;
  onCancel?: () => void;
  onSave: (relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
}) {
  const headstoneOptions = (lookups.headstones ?? []).filter((option) => option.id !== headstone.id);
  const [form, setForm] = useState<SaveHeadstoneRelationshipInput>(() =>
    initialRelationship
      ? markerRelationshipFormFromRecord(initialRelationship)
      : {
          relatedHeadstoneId: headstoneOptions[0]?.id ?? "",
          relationshipType: "references_marker",
          sourceType: "nhg",
          sourceText: "",
          confidence: "review",
          notes: "",
          status: "active",
          reason: "Add marker relationship",
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
      if (initialRelationship) {
        onCancel?.();
      } else {
        setMessage("Relationship recorded.");
        setForm((current) => ({ ...current, sourceText: "", notes: "" }));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save marker relationship.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!headstoneOptions.length) return <p className="muted">No other markers are available to link.</p>;

  return (
    <form className="headstone-record headstone-form" onSubmit={(event) => void save(event)}>
      <label>
        Related marker
        <select value={form.relatedHeadstoneId} onChange={(event) => setForm((current) => ({ ...current, relatedHeadstoneId: event.target.value }))}>
          {headstoneOptions.map((option) => (
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
          onChange={(event) => setForm((current) => ({ ...current, relationshipType: event.target.value as SaveHeadstoneRelationshipInput["relationshipType"] }))}
        >
          {markerRelationshipTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source
        <select value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as SaveHeadstoneRelationshipInput["sourceType"] }))}>
          {markerRelationshipSourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Confidence
        <select value={form.confidence} onChange={(event) => setForm((current) => ({ ...current, confidence: event.target.value as SaveHeadstoneRelationshipInput["confidence"] }))}>
          {confidenceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SaveHeadstoneRelationshipInput["status"] }))}>
          {relationshipStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
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
        <button type="submit" disabled={isSaving || !form.relatedHeadstoneId}>
          <Link2 size={15} aria-hidden="true" />
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function MarkerRelationshipList({
  headstone,
  relationships,
  lookups,
  canUpdate,
  onUpdate,
  onDelete,
}: {
  headstone: Headstone;
  relationships: HeadstoneRelationship[];
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  onUpdate: (relationshipId: string, relationship: SaveHeadstoneRelationshipInput) => Promise<Headstone>;
  onDelete: (relationshipId: string, reason?: string) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [deleteError, setDeleteError] = useState<string>();

  const deleteRelationship = async (relationship: HeadstoneRelationship) => {
    const reason = window.prompt("Reason for deleting this marker relationship?", "Recorded in error");
    if (reason === null) return;
    setDeletingId(relationship.id);
    setDeleteError(undefined);
    try {
      await onDelete(relationship.id, reason);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Unable to delete marker relationship.");
    } finally {
      setDeletingId(undefined);
    }
  };

  if (!relationships.length) return <p className="muted">No related markers are recorded.</p>;

  return (
    <div className="grave-feature-list">
      {relationships.map((relationship) => {
        if (editingId === relationship.id) {
          return (
            <article key={relationship.id} className="grave-feature-row">
              <MarkerRelationshipForm
                headstone={headstone}
                lookups={lookups}
                initialRelationship={relationship}
                submitLabel="Save relationship"
                onSave={(input) => onUpdate(relationship.id, input)}
                onCancel={() => setEditingId(undefined)}
              />
            </article>
          );
        }

        return (
          <article key={relationship.id} className="grave-feature-row">
            <div className="record-heading">
              <strong>{relationship.relatedHeadstoneId}</strong>
              <div className="record-actions">
                {canUpdate ? (
                  <button type="button" className="secondary-button compact-button" onClick={() => setEditingId(relationship.id)}>
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
                {canUpdate ? (
                  <button
                    type="button"
                    className="secondary-button compact-button danger-button"
                    onClick={() => void deleteRelationship(relationship)}
                    disabled={deletingId === relationship.id}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    {deletingId === relationship.id ? "Deleting..." : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
            <span>{markerRelationshipTypeLabel(relationship.relationshipType)}</span>
            <span>
              {markerRelationshipSourceLabel(relationship.sourceType)} | {relationship.confidence === "review" ? "Needs review" : relationship.confidence} | {relationship.status}
            </span>
            {relationship.direction === "incoming" ? <span>This marker is referenced by the related marker.</span> : null}
            {relationship.sourceText ? <p>{relationship.sourceText}</p> : null}
            {relationship.notes ? <p>{relationship.notes}</p> : null}
          </article>
        );
      })}
      {deleteError ? <p className="detail-message is-error">{deleteError}</p> : null}
    </div>
  );
}
