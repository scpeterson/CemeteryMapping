import { useState, type CSSProperties, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { GraveSpaceSummary, Headstone, HeadstoneGravesiteRelationship, HeadstoneLookups, SaveHeadstoneGravesiteRelationshipInput } from "../../types";
import { formatGraveLabel, statusColors, statusLabels } from "../../lib/format";

const relationshipTypes: Array<{ value: SaveHeadstoneGravesiteRelationshipInput["relationshipType"]; label: string }> = [
  { value: "primary", label: "Primary" }, { value: "spans", label: "Spans" },
  { value: "nearby", label: "Nearby" }, { value: "inferred", label: "Inferred" },
  { value: "footstone", label: "Footstone" }, { value: "secondary", label: "Secondary" },
];

export function MarkerGravesiteRelationshipManager({ headstone, graves, lookups, canUpdate, onSelectGrave, onSave, onUpdate, onDelete }: {
  headstone: Headstone;
  graves: GraveSpaceSummary[];
  lookups: HeadstoneLookups;
  canUpdate: boolean;
  onSelectGrave: (grave: GraveSpaceSummary) => void;
  onSave: (relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onUpdate: (id: string, relationship: SaveHeadstoneGravesiteRelationshipInput) => Promise<Headstone>;
  onDelete: (id: string, reason?: string) => Promise<void>;
}) {
  const relationships = headstone.gravesiteRelationships ?? [];
  const gravesById = new Map(graves.map((grave) => [grave.id, grave]));
  const linkedIds = new Set(relationships.map((relationship) => relationship.gravesiteUuid));
  const availableGravesites = lookups.gravesites.filter((grave) => !linkedIds.has(grave.id));
  const [form, setForm] = useState<SaveHeadstoneGravesiteRelationshipInput>({ gravesiteId: "", relationshipType: "secondary", notes: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.gravesiteId) return;
    setBusy(true); setMessage("");
    try { await onSave(form); setForm({ gravesiteId: "", relationshipType: "secondary", notes: "" }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to add gravesite relationship."); }
    finally { setBusy(false); }
  };
  const changeType = async (relationship: HeadstoneGravesiteRelationship, relationshipType: SaveHeadstoneGravesiteRelationshipInput["relationshipType"]) => {
    setBusy(true); setMessage("");
    try { await onUpdate(relationship.id, { gravesiteId: relationship.gravesiteUuid, relationshipType, notes: relationship.notes }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update gravesite relationship."); }
    finally { setBusy(false); }
  };
  const remove = async (relationship: HeadstoneGravesiteRelationship) => {
    const reason = window.prompt(`Why are you removing the link to ${relationship.gravesiteId}?`);
    if (reason === null) return;
    setBusy(true); setMessage("");
    try { await onDelete(relationship.id, reason || undefined); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to remove gravesite relationship."); }
    finally { setBusy(false); }
  };

  return <div className="stacked-form">
    {relationships.map((relationship) => <div className="associated-gravesite-row" key={relationship.id}>
      <div>
        {gravesById.has(relationship.gravesiteId) ? <button type="button" className="link-button" onClick={() => onSelectGrave(gravesById.get(relationship.gravesiteId)!)}><strong>{formatGraveLabel(gravesById.get(relationship.gravesiteId)!)}</strong></button> : <strong>Record ID {relationship.gravesiteId}</strong>}
        {relationship.gravesiteName && relationship.gravesiteName !== relationship.gravesiteId ? <span> — {relationship.gravesiteName}</span> : null}
        {relationship.notes ? <p className="muted">{relationship.notes}</p> : null}
      </div>
      {canUpdate ? <div className="inline-actions">
        <select aria-label={`Relationship to ${relationship.gravesiteId}`} disabled={busy} value={relationship.relationshipType} onChange={(event) => void changeType(relationship, event.target.value as SaveHeadstoneGravesiteRelationshipInput["relationshipType"])}>{relationshipTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        <button type="button" className="icon-button danger" disabled={busy} aria-label={`Remove link to ${relationship.gravesiteId}`} onClick={() => void remove(relationship)}><Trash2 size={15} aria-hidden="true" /></button>
      </div> : <span>{relationshipTypes.find((option) => option.value === relationship.relationshipType)?.label ?? relationship.relationshipType}</span>}
    </div>)}
    {!relationships.length ? <p className="muted">No gravesites are associated with this marker.</p> : null}
    {canUpdate && availableGravesites.length ? <form className="stacked-form" onSubmit={submit}>
      <label>Add gravesite<select required value={form.gravesiteId} onChange={(event) => setForm((current) => ({ ...current, gravesiteId: event.target.value }))}><option value="">Select a gravesite</option>{availableGravesites.map((grave) => <option key={grave.id} value={grave.id}>{grave.label}</option>)}</select></label>
      <label>Relationship<select value={form.relationshipType} onChange={(event) => setForm((current) => ({ ...current, relationshipType: event.target.value as SaveHeadstoneGravesiteRelationshipInput["relationshipType"] }))}>{relationshipTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      <button type="submit" className="primary-button" disabled={busy || !form.gravesiteId}>{busy ? "Saving…" : "Add gravesite link"}</button>
    </form> : null}
    {message ? <p className="form-error">{message}</p> : null}
  </div>;
}

export function AssociatedGravesiteList({ graves, emptyMessage, onSelectGrave }: { graves: GraveSpaceSummary[]; emptyMessage: string; onSelectGrave: (grave: GraveSpaceSummary) => void }) {
  if (!graves.length) return <p className="muted">{emptyMessage}</p>;
  return <div className="associated-gravesite-list">{graves.map((grave) => <button key={`${grave.cemeteryId}:${grave.id}`} type="button" className="associated-gravesite-row" onClick={() => onSelectGrave(grave)}><strong>{formatGraveLabel(grave)}</strong><span className="associated-gravesite-status" style={{ "--status-color": statusColors[grave.status] } as CSSProperties}>{statusLabels[grave.status]}</span></button>)}</div>;
}
