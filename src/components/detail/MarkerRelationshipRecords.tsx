import { LookupForm, LookupSelect, LookupSaveButton } from "./EditingOptions";
import { useDraftState } from "../../hooks/useDraftState";
import { FormEvent, useState } from "react";
import { Link2, Pencil, Trash2 } from "lucide-react";
import type { Headstone, HeadstoneLookups, HeadstoneRelationship, SaveHeadstoneRelationshipInput } from "../../types";

const markerRelationshipTypeOptions: Array<{ value: SaveHeadstoneRelationshipInput["relationshipType"]; label: string; description: string }> = [
  { value: "family_obelisk", label: "Family obelisk", description: "Connects a family obelisk or monument with an individual family marker." },
  { value: "references_marker", label: "References marker", description: "This marker refers to the other marker, such as through an inscription or documented reference." },
  { value: "common_base", label: "Common base", description: "The two markers share the same physical base." },
  { value: "foot_marker", label: "Foot marker", description: "Connects a foot marker with its corresponding head marker." },
  { value: "related_marker", label: "Related marker", description: "The markers are associated, but no more specific relationship is recorded." },
];

const markerRelationshipSourceOptions: Array<{ value: SaveHeadstoneRelationshipInput["sourceType"]; label: string; description: string }> = [
  { value: "manual", label: "Manual", description: "The relationship was entered manually from research or knowledge of the records." },
  { value: "nhg", label: "NHG", description: "North Hills Genealogists documentation is the source of this relationship." },
  { value: "field_observation", label: "Field observation", description: "The relationship was observed at the cemetery." },
  { value: "import", label: "Import", description: "The relationship came from imported data." },
];

const confidenceOptions: Array<{ value: SaveHeadstoneRelationshipInput["confidence"]; label: string; description: string }> = [
  { value: "high", label: "High", description: "Strong evidence supports this relationship." },
  { value: "medium", label: "Medium", description: "Some supporting evidence exists, but additional confirmation may be useful." },
  { value: "low", label: "Low", description: "Evidence is limited or uncertain." },
  { value: "review", label: "Needs review", description: "The confidence in this relationship still needs to be assessed." },
];

const relationshipStatusOptions: Array<{ value: SaveHeadstoneRelationshipInput["status"]; label: string; description: string }> = [
  { value: "active", label: "Active", description: "This is a current relationship." },
  { value: "needs_review", label: "Needs review", description: "This relationship requires review or confirmation." },
  { value: "retired", label: "Retired", description: "This relationship is retained for history and is no longer current." },
];

function selectedOptionTooltip(options: Array<{ value: string; label: string; description: string }>, value: string) {
  const option = options.find((option) => option.value === value);
  return option ? `${option.label}: ${option.description}` : "Choose an option.";
}

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
  const [form, setForm] = useDraftState<SaveHeadstoneRelationshipInput>(() =>
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
      setForm(form);
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
    <LookupForm className="headstone-record headstone-form" onSubmit={(event) => void save(event)}>
      <label>
        Related marker
        <LookupSelect title={`${headstoneOptions.find((option) => option.id === form.relatedHeadstoneId)?.label ?? "Related marker"}: Select the other physical marker to link to this marker.`} value={form.relatedHeadstoneId} onChange={(event) => setForm((current) => ({ ...current, relatedHeadstoneId: event.target.value }))}>
          {headstoneOptions.map((option) => (
            <option key={option.id} value={option.id} title={option.label}>
              {option.label}
            </option>
          ))}
        </LookupSelect>
      </label>
      <label>
        Relationship
        <LookupSelect
          title={selectedOptionTooltip(markerRelationshipTypeOptions, form.relationshipType)}
          value={form.relationshipType}
          onChange={(event) => setForm((current) => ({ ...current, relationshipType: event.target.value as SaveHeadstoneRelationshipInput["relationshipType"] }))}
        >
          {markerRelationshipTypeOptions.map((option) => (
            <option key={option.value} value={option.value} title={`${option.label}: ${option.description}`}>
              {option.label}
            </option>
          ))}
        </LookupSelect>
      </label>
      <label>
        Source
        <LookupSelect title={selectedOptionTooltip(markerRelationshipSourceOptions, form.sourceType)} value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as SaveHeadstoneRelationshipInput["sourceType"] }))}>
          {markerRelationshipSourceOptions.map((option) => (
            <option key={option.value} value={option.value} title={`${option.label}: ${option.description}`}>
              {option.label}
            </option>
          ))}
        </LookupSelect>
      </label>
      <label>
        Confidence
        <LookupSelect title={selectedOptionTooltip(confidenceOptions, form.confidence)} value={form.confidence} onChange={(event) => setForm((current) => ({ ...current, confidence: event.target.value as SaveHeadstoneRelationshipInput["confidence"] }))}>
          {confidenceOptions.map((option) => (
            <option key={option.value} value={option.value} title={`${option.label}: ${option.description}`}>
              {option.label}
            </option>
          ))}
        </LookupSelect>
      </label>
      <label>
        Status
        <LookupSelect title={selectedOptionTooltip(relationshipStatusOptions, form.status)} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SaveHeadstoneRelationshipInput["status"] }))}>
          {relationshipStatusOptions.map((option) => (
            <option key={option.value} value={option.value} title={`${option.label}: ${option.description}`}>
              {option.label}
            </option>
          ))}
        </LookupSelect>
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
      {error ? <p className="detail-message is-error" role="alert">{error}</p> : null}
      <div className="headstone-form-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        ) : null}
        <LookupSaveButton type="submit" disabled={isSaving || !form.relatedHeadstoneId}>
          <Link2 size={15} aria-hidden="true" />
          {isSaving ? "Saving..." : submitLabel}
        </LookupSaveButton>
      </div>
    </LookupForm>
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
      {deleteError ? <p className="detail-message is-error" role="alert">{deleteError}</p> : null}
    </div>
  );
}
