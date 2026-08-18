import { type FormEvent, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { fetchDeedRegistrySuggestions } from "../../api/cemeteryApi";
import { formatGraveLabel } from "../../lib/format";
import type {
  DeedRegistrySuggestion,
  GraveSpace,
  GraveSpaceSummary,
  Owner,
  OwnershipEventType,
  OwnershipPartyInput,
  OwnershipTargetScope,
  SaveOwnershipEventInput,
  UpdateOwnerInput,
} from "../../types";

const ownershipEventOptions: { value: OwnershipEventType; label: string }[] = [
  { value: "deed", label: "Deed (new or historical)" },
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

const stateOptions = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"],
  ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
  ["AS", "American Samoa"], ["GU", "Guam"], ["MP", "Northern Mariana Islands"], ["PR", "Puerto Rico"], ["VI", "U.S. Virgin Islands"],
] as const;



function blankOwnershipForm(grave: GraveSpace): SaveOwnershipEventInput {
  return {
    owners: [blankOwnershipParty()],
    previousOwners: [blankOwnershipParty()],
    eventType: "deed",
    targetScope: grave.lot ? "selected_lot" : "selected_gravesite",
    targetGravesiteIds: [],
    effectiveDate: new Date().toISOString().slice(0, 10),
    deedOnFile: false,
    deedRegisterOnFile: false,
    documentReference: "",
    notes: "",
    reason: "Ownership event update",
  };
}

function blankOwnershipParty(): OwnershipPartyInput {
  return { firstName: "", lastName: "", fullAddress: "", municipality: "", state: "", zip: "", shareNumerator: "", shareDenominator: "" };
}

function OwnershipPartyFields({
  title,
  parties,
  onChange,
}: {
  title: string;
  parties: OwnershipPartyInput[];
  onChange: (parties: OwnershipPartyInput[]) => void;
}) {
  const update = (index: number, patch: Partial<OwnershipPartyInput>) => onChange(parties.map((party, partyIndex) => partyIndex === index ? { ...party, ...patch } : party));
  return (
    <fieldset className="ownership-wide-field ownership-party-list">
      <legend>{title}</legend>
      {parties.map((party, index) => (
        <section className="ownership-party-card" key={index}>
          <header>
            <strong>{title.replace(/s$/u, "")} {index + 1}</strong>
            {parties.length > 1 ? <button type="button" className="text-button" onClick={() => onChange(parties.filter((_, partyIndex) => partyIndex !== index))}>Remove</button> : null}
          </header>
          <label>First name<input value={party.firstName} onChange={(event) => update(index, { firstName: event.target.value })} /></label>
          <label>Last name<input value={party.lastName} onChange={(event) => update(index, { lastName: event.target.value })} /></label>
          <label className="ownership-wide-field">Street address<input value={party.fullAddress} onChange={(event) => update(index, { fullAddress: event.target.value })} /></label>
          <label>City<input value={party.municipality} onChange={(event) => update(index, { municipality: event.target.value })} /></label>
          <label>
            State
            <select value={party.state} onChange={(event) => update(index, { state: event.target.value })}>
              <option value="">Select a state</option>
              {stateOptions.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
            </select>
          </label>
          <label>ZIP<input value={party.zip} maxLength={10} onChange={(event) => update(index, { zip: event.target.value })} /></label>
          <div className="ownership-share-fields">
            <label>Share<input inputMode="numeric" value={party.shareNumerator} placeholder="1" onChange={(event) => update(index, { shareNumerator: event.target.value })} /></label>
            <span>/</span>
            <label>Total<input inputMode="numeric" value={party.shareDenominator} placeholder="2" onChange={(event) => update(index, { shareDenominator: event.target.value })} /></label>
          </div>
        </section>
      ))}
      <button type="button" className="secondary-button ownership-add-party" onClick={() => onChange([...parties, blankOwnershipParty()])}>Add another person</button>
    </fieldset>
  );
}

export function OwnershipEventForm({ grave, cemeteryGraves, onSave }: { grave: GraveSpace; cemeteryGraves: GraveSpaceSummary[]; onSave: (event: SaveOwnershipEventInput) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SaveOwnershipEventInput>(() => blankOwnershipForm(grave));
  const [selectedGravesiteIds, setSelectedGravesiteIds] = useState<string[]>([]);
  const [gravesiteFilter, setGravesiteFilter] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [registrySuggestions, setRegistrySuggestions] = useState<DeedRegistrySuggestion[]>([]);
  const [isSearchingRegistry, setIsSearchingRegistry] = useState(false);
  const [hasSearchedRegistry, setHasSearchedRegistry] = useState(false);

  const startEditing = () => {
    setForm(blankOwnershipForm(grave));
    setSelectedGravesiteIds([]);
    setGravesiteFilter("");
    setMessage(undefined);
    setError(undefined);
    setRegistrySuggestions([]);
    setHasSearchedRegistry(false);
    setIsEditing(true);
  };

  const searchRegistry = async () => {
    const ownerNames = form.owners.map((owner) => [owner.firstName, owner.lastName].filter(Boolean).join(" ")).filter(Boolean).join(" ");
    setIsSearchingRegistry(true);
    setError(undefined);
    try {
      setRegistrySuggestions(await fetchDeedRegistrySuggestions(grave.cemeteryId, ownerNames));
      setHasSearchedRegistry(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Unable to search the imported deed registry.");
    } finally {
      setIsSearchingRegistry(false);
    }
  };

  const applyRegistrySuggestion = (suggestion: DeedRegistrySuggestion) => {
    setForm((current) => ({
      ...current,
      effectiveDate: suggestion.effectiveDate || current.effectiveDate,
      deedOnFile: suggestion.deedOnFile,
      deedRegisterOnFile: suggestion.deedRegisterOnFile,
      documentReference: suggestion.documentReference,
      notes: suggestion.notes,
      owners: current.owners.length === 1 ? current.owners.map((owner) => ({
        ...owner,
        fullAddress: owner.fullAddress || suggestion.address,
        municipality: owner.municipality || suggestion.city,
        state: owner.state || suggestion.state,
      })) : current.owners,
    }));
    setRegistrySuggestions([]);
    setHasSearchedRegistry(false);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(undefined);
    setError(undefined);
    try {
      const targetGravesiteIds = form.targetScope === "listed_gravesites" ? selectedGravesiteIds : [];
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

  const normalizedFilter = gravesiteFilter.trim().toLowerCase();
  const gravesiteOptions = [...cemeteryGraves]
    .sort((a, b) => formatGraveLabel(a).localeCompare(formatGraveLabel(b), undefined, { numeric: true }))
    .filter((candidate) => !normalizedFilter || `${candidate.id} ${formatGraveLabel(candidate)}`.toLowerCase().includes(normalizedFilter));
  const toggleGravesite = (id: string) => {
    setSelectedGravesiteIds((current) => (current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]));
  };

  return (
    <form className="ownership-form" onSubmit={(event) => void save(event)}>
      {["sale", "gift"].includes(form.eventType) ? (
        <OwnershipPartyFields title="Previous owners (from)" parties={form.previousOwners} onChange={(previousOwners) => setForm((current) => ({ ...current, previousOwners }))} />
      ) : null}
      <OwnershipPartyFields title={["sale", "gift"].includes(form.eventType) ? "New owners (to)" : "Owners"} parties={form.owners} onChange={(owners) => setForm((current) => ({ ...current, owners }))} />
      {form.eventType === "deed" ? (
        <section className="ownership-registry-assist ownership-wide-field">
          <div>
            <strong>Imported registry</strong>
            <span>Reuse the source, tab lines, remarks, date, deed-file status, and available address from the 2017 and Updated 2022 tabs.</span>
          </div>
          <button type="button" className="secondary-button" onClick={() => void searchRegistry()} disabled={isSearchingRegistry || form.owners.every((owner) => !owner.firstName.trim() && !owner.lastName.trim())}>
            {isSearchingRegistry ? "Searching..." : "Find imported record"}
          </button>
          {!hasSearchedRegistry && !isSearchingRegistry ? null : (
            <div className="ownership-registry-results">
              {registrySuggestions.map((suggestion) => (
                <article key={suggestion.id}>
                  <div>
                    <strong>{suggestion.ownerDisplayName}</strong>
                    <span>{suggestion.notes.replace(/\n/gu, " · ")}</span>
                    <span>Date: {suggestion.effectiveDate || "not recorded"} · Historical location: {[suggestion.modernSection && `Section ${suggestion.modernSection}`, suggestion.lotText && `Lot ${suggestion.lotText}`].filter(Boolean).join(", ") || "not recorded"}</span>
                  </div>
                  <button type="button" onClick={() => applyRegistrySuggestion(suggestion)}>Use this record</button>
                </article>
              ))}
              {!isSearchingRegistry && registrySuggestions.length === 0 ? <p>No imported owner matched those names.</p> : null}
            </div>
          )}
        </section>
      ) : null}
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
      {form.eventType === "deed" ? (
        <p className="ownership-event-guidance">Entering an old deed? Use its original date as the effective date below.</p>
      ) : null}
      {form.targetScope === "listed_gravesites" ? (
        <fieldset className="ownership-wide-field ownership-gravesite-picker">
          <legend>Gravesites</legend>
          <input value={gravesiteFilter} onChange={(event) => setGravesiteFilter(event.target.value)} placeholder="Filter by section, lot, space, or ID" aria-label="Filter gravesites" />
          <div className="ownership-gravesite-options">
            {gravesiteOptions.map((candidate) => (
              <label key={candidate.id}>
                <input type="checkbox" checked={selectedGravesiteIds.includes(candidate.id)} onChange={() => toggleGravesite(candidate.id)} />
                <span>{formatGraveLabel(candidate)}</span>
              </label>
            ))}
            {gravesiteOptions.length === 0 ? <p>No matching gravesites.</p> : null}
          </div>
          <small>{selectedGravesiteIds.length} selected</small>
        </fieldset>
      ) : null}
      <label>
        Effective date
        <input
          value={form.effectiveDate}
          placeholder="YYYY, YYYY-MM, or exact date"
          onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))}
        />
      </label>
      <div className="ownership-file-status-fields">
        <label className="ownership-checkbox-field">
          <input type="checkbox" checked={form.deedOnFile} onChange={(event) => setForm((current) => ({ ...current, deedOnFile: event.target.checked }))} />
          Deed on file
        </label>
        <label className="ownership-checkbox-field">
          <input type="checkbox" checked={form.deedRegisterOnFile} onChange={(event) => setForm((current) => ({ ...current, deedRegisterOnFile: event.target.checked }))} />
          Deed register on file
        </label>
      </div>
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
        <button type="submit" disabled={isSaving || form.owners.some((party) => !party.firstName.trim() && !party.lastName.trim()) || (["sale", "gift"].includes(form.eventType) && form.previousOwners.some((party) => !party.firstName.trim() && !party.lastName.trim())) || (form.targetScope === "listed_gravesites" && selectedGravesiteIds.length === 0)}>
          {isSaving ? "Recording..." : "Record ownership"}
        </button>
      </div>
    </form>
  );
}

export function OwnerRecord({ owner, canUpdate, canRemove, onSave, onRemove }: { owner: Owner; canUpdate: boolean; canRemove: boolean; onSave: (partyId: string, eventId: string, update: UpdateOwnerInput) => Promise<void>; onRemove: (rightId: string) => Promise<void> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState<UpdateOwnerInput>({
    firstName: owner.firstName, lastName: owner.lastName, fullAddress: owner.fullAddress,
    municipality: owner.municipality, state: owner.state, zip: owner.zip,
    effectiveDate: owner.effectiveDate ?? "", deedOnFile: owner.deedOnFile, deedRegisterOnFile: owner.deedRegisterOnFile,
    reason: "Owner information update",
  });
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!owner.ownershipEventId) return;
    setIsSaving(true); setError(undefined);
    try { await onSave(owner.id, owner.ownershipEventId, form); setIsEditing(false); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to update owner."); }
    finally { setIsSaving(false); }
  };
  const remove = async () => {
    if (!owner.ownershipEventRightId) return;
    setIsSaving(true); setError(undefined);
    try { await onRemove(owner.ownershipEventRightId); }
    catch (removeError) { setError(removeError instanceof Error ? removeError.message : "Unable to remove ownership connection."); setIsConfirmingRemoval(false); }
    finally { setIsSaving(false); }
  };
  if (!isEditing) return (
    <div className="owner-row">
      <div className="owner-row-header">
        <strong>{owner.displayName}</strong>
        <div className="owner-row-actions">
          {canUpdate && owner.ownershipEventId ? <button type="button" className="icon-text-button" onClick={() => setIsEditing(true)}><Pencil size={14} aria-hidden="true" />Edit</button> : null}
          {canRemove && owner.ownershipEventRightId && owner.ownershipTargetType === "gravesite" ? <button type="button" className="icon-text-button is-danger" onClick={() => setIsConfirmingRemoval(true)}><Trash2 size={14} aria-hidden="true" />Remove</button> : null}
        </div>
      </div>
      {owner.contactNote ? <span>{owner.contactNote}</span> : null}
      <span>Date: {owner.effectiveDate || "Not recorded"}</span>
      <label className="owner-deed-register-status"><input type="checkbox" checked={owner.deedOnFile} readOnly />Deed on file</label>
      <label className="owner-deed-register-status"><input type="checkbox" checked={owner.deedRegisterOnFile} readOnly />Deed register on file</label>
      {isConfirmingRemoval ? (
        <div className="owner-remove-confirmation">
          <span>Remove this deed’s connection to this gravesite? Other gravesites on the deed will not change.</span>
          <div><button type="button" className="secondary-button" onClick={() => setIsConfirmingRemoval(false)} disabled={isSaving}>Cancel</button><button type="button" className="danger-button" onClick={() => void remove()} disabled={isSaving}>{isSaving ? "Removing..." : "Remove connection"}</button></div>
        </div>
      ) : null}
      {error ? <p className="detail-message is-error">{error}</p> : null}
    </div>
  );
  return (
    <form className="owner-edit-form ownership-party-card" onSubmit={(event) => void save(event)}>
      <label>First name<input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} /></label>
      <label>Last name<input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} /></label>
      <label className="ownership-wide-field">Street address<input value={form.fullAddress} onChange={(event) => setForm((current) => ({ ...current, fullAddress: event.target.value }))} /></label>
      <label>City<input value={form.municipality} onChange={(event) => setForm((current) => ({ ...current, municipality: event.target.value }))} /></label>
      <label>State<select value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}><option value="">Select a state</option>{stateOptions.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}</select></label>
      <label>ZIP<input value={form.zip} onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))} /></label>
      <label>Effective date<input value={form.effectiveDate} placeholder="YYYY, YYYY-MM, or exact date" onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))} /></label>
      <div className="ownership-file-status-fields ownership-wide-field">
        <label className="ownership-checkbox-field"><input type="checkbox" checked={form.deedOnFile} onChange={(event) => setForm((current) => ({ ...current, deedOnFile: event.target.checked }))} />Deed on file</label>
        <label className="ownership-checkbox-field"><input type="checkbox" checked={form.deedRegisterOnFile} onChange={(event) => setForm((current) => ({ ...current, deedRegisterOnFile: event.target.checked }))} />Deed register on file</label>
      </div>
      {error ? <p className="detail-message is-error ownership-wide-field">{error}</p> : null}
      <div className="ownership-form-actions ownership-wide-field"><button type="button" className="secondary-button" onClick={() => setIsEditing(false)}>Cancel</button><button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save owner"}</button></div>
    </form>
  );
}
