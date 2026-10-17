import { LookupForm, LookupSelect, LookupSaveButton } from "./EditingOptions";
import { useId } from "react";
import { useDraftState } from "../../hooks/useDraftState";
import { Pencil } from "lucide-react";
import { FormEvent, useState } from "react";
import BurialPlaceField from "./BurialPlaceField";
import { burialNoteItems } from "../../lib/burialNotes";
import { formatDate, fullName } from "../../lib/format";
import type {
  Burial,
  HeadstoneLookups,
  SaveBurialInput,
} from "../../types";
import { ReviewBadgeGroup } from "./RecordReview";
import { dataConfidenceOptions, reviewStatusOptions } from "./reviewOptions";

import BurialNameFields from "./BurialNameFields";

function blankBurialForm(burial: Burial): SaveBurialInput {
  return {
    firstName: burial.person.firstName,
    givenNameStatus: burial.person.givenNameStatus ?? (burial.person.firstName.trim() ? "recorded" : "unknown"),
    displayName: burial.person.displayName ?? "",
    lastName: burial.person.lastName === "Unknown" ? "" : burial.person.lastName,
    maidenName: burial.person.maidenName ?? "",
    namePrefix: burial.person.namePrefix ?? "",
    nameSuffix: burial.person.nameSuffix ?? "",
    birthDate: burial.person.birthDate ?? "",
    deathDate: burial.person.deathDate ?? "",
    birthPlaceId: burial.birthPlace?.id ?? "",
    deathPlaceId: burial.deathPlace?.id ?? "",
    burialDate: burial.burialDate ?? "",
    intermentType: burial.intermentType ?? "unknown",
    recordStatusCode: burial.recordStatusCode ?? "interred",
    funeralHome: burial.funeralHome ?? "",
    sourceUrl: burial.sourceUrl ?? "",
    veteran: burial.veteran ?? false,
    militaryBranchCode: burial.militaryBranchCode ?? "",
    militaryRankCode: burial.militaryRankCode ?? "",
    militaryWarServiceCode: burial.militaryWarServiceCode ?? "",
    militaryDecorationCodes: (burial.militaryDecorations ?? []).map((decoration) => decoration.code),
    militaryEnlistedDate: burial.militaryEnlistedDate ?? "",
    militaryDischargedDate: burial.militaryDischargedDate ?? "",
    notes: burial.recordNotes ?? "",
    dataConfidence: burial.dataConfidence ?? "unknown",
    reviewStatus: burial.reviewStatus ?? "unreviewed",
    reviewNotes: burial.reviewNotes ?? "",
    sourceConflict: burial.sourceConflict ?? false,
    reason: "Burial detail update",
  };
}

function militaryServiceText(burial: Burial) {
  const rankLabel =
    burial.militaryRankAbbreviation && burial.militaryRank
      ? `${burial.militaryRankAbbreviation} (${burial.militaryRank})`
      : burial.militaryRankAbbreviation || burial.militaryRank;
  const details = [rankLabel, burial.militaryBranch, burial.militaryWars].filter(Boolean).join(" | ");
  return details;
}

function intermentTypeOptions(lookups: HeadstoneLookups) {
  return lookups.intermentTypes.length
    ? lookups.intermentTypes
    : [
        { id: "legacy-casket", code: "casket", label: "Casket" },
        { id: "legacy-urn", code: "urn", label: "Funeral urn" },
        { id: "legacy-unknown", code: "unknown", label: "Unknown or not applicable" },
      ];
}

function burialRecordStatusOptions(lookups: HeadstoneLookups) {
  return lookups.burialRecordStatuses?.length
    ? lookups.burialRecordStatuses
    : [{ id: "legacy-interred", code: "interred", label: "Interred" }];
}

export function BurialRecord({
  burial,
  canUpdate,
  lookups,
  onSave,
}: {
  burial: Burial;
  canUpdate: boolean;
  lookups: HeadstoneLookups;
  onSave: (id: string, burial: SaveBurialInput) => Promise<Burial>;
}) {
  const noteItems = burialNoteItems(burial.notes);
  const serviceText = militaryServiceText(burial);
  const intermentOptions = intermentTypeOptions(lookups);
  const recordStatusOptions = burialRecordStatusOptions(lookups);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useDraftState<SaveBurialInput>(() => blankBurialForm(burial));
  const militaryRankOptions = lookups.militaryRanks.filter((option) => option.militaryBranchCode === form.militaryBranchCode);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const errorId = useId();

  const startEditing = () => {
    setForm(blankBurialForm(burial));
    setError(undefined);
    setIsEditing(true);
  };

  const setVeteran = (isVeteran: boolean) => {
    setForm((current) => ({
      ...current,
      veteran: isVeteran,
      militaryBranchCode: isVeteran ? current.militaryBranchCode : "",
      militaryRankCode: isVeteran ? current.militaryRankCode : "",
      militaryWarServiceCode: isVeteran ? current.militaryWarServiceCode : "",
      militaryDecorationCodes: isVeteran ? current.militaryDecorationCodes : [],
      militaryEnlistedDate: isVeteran ? current.militaryEnlistedDate : "",
      militaryDischargedDate: isVeteran ? current.militaryDischargedDate : "",
    }));
  };

  const setMilitaryBranch = (militaryBranchCode: string) => {
    setForm((current) => {
      const selectedRank = lookups.militaryRanks.find((option) => option.code === current.militaryRankCode && option.militaryBranchCode === militaryBranchCode);
      return {
        ...current,
        militaryBranchCode,
        militaryRankCode: selectedRank ? current.militaryRankCode : "",
      };
    });
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    try {
      const saved = await onSave(burial.id, form);
      setForm(blankBurialForm(saved));
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save burial.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <LookupForm className="burial-record burial-form" onSubmit={(event) => void save(event)}>
        <BurialNameFields form={form} setForm={setForm} />
        <label>
          Birth date
          <input value={form.birthDate} aria-invalid={error?.startsWith("Birth date") || undefined} aria-describedby={error?.startsWith("Birth date") ? errorId : undefined} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} />
        </label>
        <label>
          Death date
          <input value={form.deathDate} aria-invalid={error?.startsWith("Death date") || undefined} aria-describedby={error?.startsWith("Death date") ? errorId : undefined} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, deathDate: event.target.value }))} />
        </label>
        <BurialPlaceField label="Birth location" value={form.birthPlaceId} places={lookups.verifiedPlaces} onChange={(birthPlaceId) => setForm((current) => ({ ...current, birthPlaceId }))} />
        <BurialPlaceField label="Death location" value={form.deathPlaceId} places={lookups.verifiedPlaces} onChange={(deathPlaceId) => setForm((current) => ({ ...current, deathPlaceId }))} />
        <label>
          Burial date
          <input type="date" value={form.burialDate} aria-invalid={error?.startsWith("Burial date") || undefined} aria-describedby={error?.startsWith("Burial date") ? errorId : undefined} onChange={(event) => setForm((current) => ({ ...current, burialDate: event.target.value }))} />
        </label>
        <label>
          Interment
          <LookupSelect value={form.intermentType} onChange={(event) => setForm((current) => ({ ...current, intermentType: event.target.value }))}>
            {intermentOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Record status
          <LookupSelect value={form.recordStatusCode} onChange={(event) => setForm((current) => ({ ...current, recordStatusCode: event.target.value }))}>
            {recordStatusOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label className="burial-wide-field">
          Funeral home
          <input value={form.funeralHome} onChange={(event) => setForm((current) => ({ ...current, funeralHome: event.target.value }))} />
        </label>
        <label className="burial-wide-field">
          Information source URL
          <input
            type="url"
            value={form.sourceUrl}
            placeholder="https://www.findagrave.com/memorial/..."
            onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
          />
          <small>Optional web page supporting information recorded for this person.</small>
        </label>
        <label className="burial-checkbox-field">
          <input type="checkbox" checked={form.veteran} onChange={(event) => setVeteran(event.target.checked)} />
          Veteran
        </label>
        <label>
          Military branch
          <LookupSelect value={form.militaryBranchCode} onChange={(event) => setMilitaryBranch(event.target.value)} disabled={!form.veteran}>
            <option value="">Unknown / not recorded</option>
            {lookups.militaryBranches.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Rank
          <LookupSelect
            value={form.militaryRankCode}
            onChange={(event) => setForm((current) => ({ ...current, militaryRankCode: event.target.value }))}
            disabled={!form.veteran || !form.militaryBranchCode}
          >
            <option value="">Unknown / not recorded</option>
            {militaryRankOptions.map((option) => (
              <option key={option.id} value={option.code}>
                {option.abbreviation ? `${option.abbreviation} - ${option.label}${option.payGrade ? ` (${option.payGrade})` : ""}` : option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          War service
          <LookupSelect
            value={form.militaryWarServiceCode}
            onChange={(event) => setForm((current) => ({ ...current, militaryWarServiceCode: event.target.value }))}
            disabled={!form.veteran}
          >
            <option value="">Unknown / not recorded</option>
            {lookups.militaryWarServices.map((option) => (
              <option key={option.id} value={option.code}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <fieldset className="burial-wide-field burial-decoration-field" disabled={!form.veteran}>
          <legend>Military decorations</legend>
          {lookups.militaryDecorations.map((decoration) => (
            <label key={decoration.id} className="burial-checkbox-field">
              <input
                type="checkbox"
                checked={form.militaryDecorationCodes.includes(decoration.code)}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  militaryDecorationCodes: event.target.checked
                    ? [...current.militaryDecorationCodes, decoration.code]
                    : current.militaryDecorationCodes.filter((code) => code !== decoration.code),
                }))}
              />
              {decoration.label}
            </label>
          ))}
        </fieldset>
        {form.veteran ? (
          <>
            <label>
              Enlisted date
              <input
                type="date"
                value={form.militaryEnlistedDate} aria-invalid={error?.startsWith("Enlisted date") || undefined} aria-describedby={error?.startsWith("Enlisted date") ? errorId : undefined}
                onChange={(event) => setForm((current) => ({ ...current, militaryEnlistedDate: event.target.value }))}
              />
            </label>
            <label>
              Discharged date
              <input
                type="date"
                value={form.militaryDischargedDate} aria-invalid={error?.startsWith("Discharged date") || undefined} aria-describedby={error?.startsWith("Discharged date") ? errorId : undefined}
                min={form.militaryEnlistedDate || undefined}
                onChange={(event) => setForm((current) => ({ ...current, militaryDischargedDate: event.target.value }))}
              />
            </label>
          </>
        ) : null}
        <label className="burial-wide-field">
          Notes
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} />
        </label>
        <label>
          Data confidence
          <LookupSelect value={form.dataConfidence} onChange={(event) => setForm((current) => ({ ...current, dataConfidence: event.target.value as SaveBurialInput["dataConfidence"] }))}>
            {dataConfidenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label>
          Review status
          <LookupSelect value={form.reviewStatus} onChange={(event) => setForm((current) => ({ ...current, reviewStatus: event.target.value as SaveBurialInput["reviewStatus"] }))}>
            {reviewStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </LookupSelect>
        </label>
        <label className="burial-checkbox-field">
          <input type="checkbox" checked={form.sourceConflict} onChange={(event) => setForm((current) => ({ ...current, sourceConflict: event.target.checked }))} />
          Source conflict
        </label>
        <label className="burial-wide-field">
          Review notes
          <textarea value={form.reviewNotes} onChange={(event) => setForm((current) => ({ ...current, reviewNotes: event.target.value }))} rows={3} />
        </label>
        {error ? <p id={errorId} className="detail-message is-error" role="alert">{error}</p> : null}
        <div className="burial-form-actions">
          <button type="button" className="secondary-button" onClick={() => setIsEditing(false)} disabled={isSaving}>
            Cancel
          </button>
          <LookupSaveButton type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save burial"}
          </LookupSaveButton>
        </div>
      </LookupForm>
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
          <dt>Given name</dt>
          <dd>{burial.person.givenNameStatus === "no_given_name" ? "No given name" : burial.person.firstName || "Unknown / not recorded"}</dd>
        </div>
        <div>
          <dt>Born</dt>
          <dd>{formatDate(burial.person.birthDate)}</dd>
        </div>
        <div>
          <dt>Died</dt>
          <dd>{formatDate(burial.person.deathDate)}</dd>
        </div>
        {burial.birthPlace ? (
          <div>
            <dt>Birth location</dt>
            <dd>
              <a href={burial.birthPlace.authorityUrl} target="_blank" rel="noreferrer">
                {burial.birthPlace.displayName}
              </a>{" "}
              <span title={`${burial.birthPlace.authorityName}: ${burial.birthPlace.authorityIdentifier}`}>Verified</span>
            </dd>
          </div>
        ) : null}
        {burial.deathPlace ? (
          <div>
            <dt>Death location</dt>
            <dd>
              <a href={burial.deathPlace.authorityUrl} target="_blank" rel="noreferrer">
                {burial.deathPlace.displayName}
              </a>{" "}
              <span title={`${burial.deathPlace.authorityName}: ${burial.deathPlace.authorityIdentifier}`}>Verified</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Buried</dt>
          <dd>{formatDate(burial.burialDate)}</dd>
        </div>
        <div>
          <dt>Interment</dt>
          <dd>{burial.intermentTypeLabel ?? intermentOptions.find((option) => option.code === burial.intermentType)?.label ?? "Casket"}</dd>
        </div>
        <div>
          <dt>Record</dt>
          <dd>{burial.recordStatusLabel ?? recordStatusOptions.find((option) => option.code === burial.recordStatusCode)?.label ?? "Interred"}</dd>
        </div>
      </dl>
      {burial.sourceUrl ? (
        <p className="burial-source-link">
          <a href={burial.sourceUrl} target="_blank" rel="noreferrer">View information source</a>
        </p>
      ) : null}
      {burial.veteran || serviceText || burial.militaryDecorations?.length ? (
        <p className="burial-service">
          {burial.veteran ? <span className="burial-veteran-badge">Veteran</span> : null}
          {(burial.militaryDecorations ?? []).map((decoration) => (
            <span key={decoration.id} className={decoration.code === "purple_heart" ? "burial-decoration-badge is-purple-heart" : "burial-decoration-badge"}>
              {decoration.label}
            </span>
          ))}
          {serviceText ? <span>{serviceText}</span> : null}
          {burial.militaryEnlistedDate ? <span>Enlisted {formatDate(burial.militaryEnlistedDate)}</span> : null}
          {burial.militaryDischargedDate ? <span>Discharged {formatDate(burial.militaryDischargedDate)}</span> : null}
        </p>
      ) : null}
      <ReviewBadgeGroup dataConfidence={burial.dataConfidence} reviewStatus={burial.reviewStatus} sourceConflict={burial.sourceConflict} reviewNotes={burial.reviewNotes} />
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
