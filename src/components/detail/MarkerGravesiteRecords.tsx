import { useDraftState } from "../../hooks/useDraftState";
import { useId, useState, type CSSProperties, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import type { GraveSpaceSummary, Headstone, HeadstoneGravesiteRelationship, HeadstoneLookups, SaveHeadstoneGravesiteRelationshipInput } from "../../types";
import { formatGraveLabel, statusColors, statusLabels } from "../../lib/format";

const relationshipTypes: Array<{ value: SaveHeadstoneGravesiteRelationshipInput["relationshipType"]; label: string; description: string }> = [
  { value: "primary", label: "Primary / main marker", description: "The main marker or memorial for this gravesite." },
  { value: "spans", label: "Shared across gravesites", description: "One shared marker commemorates people in multiple gravesites; it need not physically cover the graves." },
  { value: "nearby", label: "Nearby / unconfirmed", description: "The marker is nearby, but its connection to this gravesite has not been confirmed." },
  { value: "inferred", label: "Inferred from records", description: "Records or import evidence suggest this connection; it still needs confirmation." },
  { value: "footstone", label: "Footstone", description: "A smaller marker placed at the foot of this grave." },
  { value: "secondary", label: "Secondary / additional marker", description: "An additional marker or monument associated with this gravesite, separate from its main marker." },
];

function relationshipOptions(isMonolith: boolean, currentType?: string) {
  return relationshipTypes
    .filter((option) => !isMonolith || option.value !== "footstone" || currentType === "footstone")
    .map((option) => isMonolith && option.value === "secondary"
      ? { ...option, label: "Secondary / family monument", description: "A separate family monument associated with the person buried in this gravesite." }
      : option);
}

function relationshipTooltip(isMonolith: boolean, value: string, saved = false) {
  const option = relationshipOptions(isMonolith, value).find((option) => option.value === value);
  return option
    ? `${option.label}: ${option.description}${saved ? " Changing this selection saves immediately." : ""}`
    : "Choose how this marker relates to the gravesite.";
}

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
  const isMonolith = headstone.markerScope.code === "monolith";
  const options = relationshipOptions(isMonolith);
  const relationshipHelpId = useId();
  const relationships = headstone.gravesiteRelationships ?? [];
  const gravesById = new Map(graves.map((grave) => [grave.id, grave]));
  const linkedIds = new Set(relationships.map((relationship) => relationship.gravesiteUuid));
  const availableGravesites = lookups.gravesites.filter((grave) => !linkedIds.has(grave.id));
  const [form, setForm] = useDraftState<SaveHeadstoneGravesiteRelationshipInput>({ gravesiteId: "", relationshipType: "secondary", notes: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.gravesiteId) return;
    setBusy(true); setMessage("");
    try { await onSave(form);
      setForm(form); setForm({ gravesiteId: "", relationshipType: "secondary", notes: "" }); }
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

  return <div className="marker-gravesite-manager">
    {relationships.map((relationship) => <div className="associated-gravesite-row" key={relationship.id}>
      <div>
        {gravesById.has(relationship.gravesiteId) ? <button type="button" className="link-button" onClick={() => onSelectGrave(gravesById.get(relationship.gravesiteId)!)}><strong>{formatGraveLabel(gravesById.get(relationship.gravesiteId)!)}</strong></button> : <strong>Record ID {relationship.gravesiteId}</strong>}
        {relationship.gravesiteName && relationship.gravesiteName !== relationship.gravesiteId ? <span> — {relationship.gravesiteName}</span> : null}
        {relationship.notes ? <p className="muted">{relationship.notes}</p> : null}
      </div>
      {canUpdate ? <div className="inline-actions">
        <select title={relationshipTooltip(isMonolith, relationship.relationshipType, true)} aria-label={`Relationship to ${relationship.gravesiteId}`} disabled={busy} value={relationship.relationshipType} onChange={(event) => void changeType(relationship, event.target.value as SaveHeadstoneGravesiteRelationshipInput["relationshipType"])}>{relationshipOptions(isMonolith, relationship.relationshipType).map((option) => <option key={option.value} value={option.value} title={option.description}>{option.label}</option>)}</select>
        <button type="button" className="icon-button danger" disabled={busy} aria-label={`Remove link to ${relationship.gravesiteId}`} onClick={() => void remove(relationship)}><Trash2 size={15} aria-hidden="true" /></button>
      </div> : <span title={relationshipTypes.find((option) => option.value === relationship.relationshipType)?.description}>{relationshipOptions(isMonolith, relationship.relationshipType).find((option) => option.value === relationship.relationshipType)?.label ?? relationship.relationshipType}</span>}
    </div>)}
    {!relationships.length ? <p className="muted">No gravesites are associated with this marker.</p> : null}
    {canUpdate && availableGravesites.length ? <form className="headstone-form marker-gravesite-form" onSubmit={submit}>
      <label className="headstone-wide-field">Add gravesite<select title={form.gravesiteId ? `${availableGravesites.find((grave) => grave.id === form.gravesiteId)?.label ?? "Selected gravesite"}. Add a link between this marker and this gravesite.` : "Select the gravesite to associate with this marker. Gravesites already linked are excluded."} required value={form.gravesiteId} onChange={(event) => setForm((current) => ({ ...current, gravesiteId: event.target.value }))}><option value="">Select a gravesite</option>{availableGravesites.map((grave) => <option key={grave.id} value={grave.id} title={grave.label}>{grave.label}</option>)}</select></label>
      <label className="headstone-wide-field">Relationship<select aria-describedby={relationshipHelpId} title={relationshipTooltip(isMonolith, form.relationshipType)} value={form.relationshipType} onChange={(event) => setForm((current) => ({ ...current, relationshipType: event.target.value as SaveHeadstoneGravesiteRelationshipInput["relationshipType"] }))}>{options.map((option) => <option key={option.value} value={option.value} title={option.description}>{option.label}</option>)}</select><small id={relationshipHelpId} className="marker-gravesite-help">{options.find((option) => option.value === form.relationshipType)?.description}</small></label>
      <label className="headstone-wide-field">Notes<textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      <div className="headstone-form-actions"><button type="submit" disabled={busy || !form.gravesiteId}>{busy ? "Saving…" : "Add gravesite link"}</button></div>
    </form> : null}
    {message ? <p className="form-error" role="alert">{message}</p> : null}
  </div>;
}

export function AssociatedGravesiteList({ graves, emptyMessage, onSelectGrave }: { graves: GraveSpaceSummary[]; emptyMessage: string; onSelectGrave: (grave: GraveSpaceSummary) => void }) {
  if (!graves.length) return <p className="muted">{emptyMessage}</p>;
  return <div className="associated-gravesite-list">{graves.map((grave) => <button key={`${grave.cemeteryId}:${grave.id}`} type="button" className="associated-gravesite-row" onClick={() => onSelectGrave(grave)}><strong>{formatGraveLabel(grave)}</strong><span className="associated-gravesite-status" style={{ "--status-color": statusColors[grave.status] } as CSSProperties}>{statusLabels[grave.status]}</span></button>)}</div>;
}
