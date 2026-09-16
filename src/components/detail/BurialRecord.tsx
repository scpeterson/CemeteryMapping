import { LookupForm, LookupSelect, LookupSaveButton } from "./EditingOptions";
import { useId } from "react";
import { useDraftState } from "../../hooks/useDraftState";
import { Pencil } from "lucide-react";
import { FormEvent, useState } from "react";
import { importVerifiedPlace, searchGeographicPlaces } from "../../api/cemeteryApi";
import { burialNoteItems } from "../../lib/burialNotes";
import { formatDate, fullName } from "../../lib/format";
import type {
  Burial,
  GeographicPlaceCandidate,
  HeadstoneLookups,
  SaveBurialInput,
  VerifiedPlace
} from "../../types";
import { ReviewBadgeGroup } from "./RecordReview";
import { dataConfidenceOptions, reviewStatusOptions } from "./reviewOptions";

function blankBurialForm(burial: Burial): SaveBurialInput {
  return {
    firstName: burial.person.firstName,
    lastName: burial.person.lastName === "Unknown" ? "" : burial.person.lastName,
    maidenName: burial.person.maidenName ?? "",
    nameSuffix: burial.person.nameSuffix ?? "",
    birthDate: burial.person.birthDate ?? "",
    deathDate: burial.person.deathDate ?? "",
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
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeCandidates, setPlaceCandidates] = useState<GeographicPlaceCandidate[]>([]);
  const [placeRetry, setPlaceRetry] = useState<"search" | GeographicPlaceCandidate>();
  const [placeSearchMessage, setPlaceSearchMessage] = useState<string>();
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [isImportingPlace, setIsImportingPlace] = useState(false);
  const [importedPlace, setImportedPlace] = useState<VerifiedPlace>();

  const startEditing = () => {
    setForm(blankBurialForm(burial));
    setError(undefined);
    setPlaceQuery("");
    setPlaceCandidates([]);
    setPlaceSearchMessage(undefined);
    setImportedPlace(undefined);
    setIsEditing(true);
  };

  const searchPlaces = async () => {
    const query = placeQuery.trim();
    if (query.length < 2) {
      setPlaceCandidates([]);
      setPlaceSearchMessage("Enter at least two characters to search.");
      return;
    }
    setPlaceRetry(undefined);
    setIsSearchingPlaces(true);
    setPlaceSearchMessage(undefined);
    try {
      const response = await searchGeographicPlaces(query);
      setPlaceCandidates(response.results);
      setPlaceSearchMessage(response.available ? (response.results.length ? undefined : "No matching places found.") : response.message);
      if (!response.available) setPlaceRetry("search");
    } catch (error) {
      setPlaceRetry("search");
      setPlaceCandidates([]);
      setPlaceSearchMessage(error instanceof Error ? error.message : "Geographic search couldn't be completed. Try again.");
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const choosePlace = async (candidate: GeographicPlaceCandidate) => {
    setPlaceRetry(undefined);
    setIsImportingPlace(true);
    setPlaceSearchMessage(undefined);
    try {
      const place = await importVerifiedPlace(candidate);
      setImportedPlace(place);
      setForm((current) => ({ ...current, deathPlaceId: place.id }));
      setPlaceCandidates([]);
      setPlaceSearchMessage(`${place.displayName} is verified and selected.`);
    } catch (error) {
      setPlaceRetry(candidate);
      setPlaceSearchMessage(error instanceof Error ? error.message : "That place couldn't be verified. Try again.");
    } finally {
      setIsImportingPlace(false);
    }
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
        <label>
          First name
          <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
        </label>
        <label>
          Last name
          <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
        </label>
        <label>
          Maiden name
          <input value={form.maidenName} onChange={(event) => setForm((current) => ({ ...current, maidenName: event.target.value }))} />
        </label>
        <label>
          Title / credentials
          <input
            value={form.nameSuffix}
            placeholder="M.D., Ph.D., Jr."
            onChange={(event) => setForm((current) => ({ ...current, nameSuffix: event.target.value }))}
          />
        </label>
        <label>
          Birth date
          <input value={form.birthDate} aria-invalid={error?.startsWith("Birth date") || undefined} aria-describedby={error?.startsWith("Birth date") ? errorId : undefined} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} />
        </label>
        <label>
          Death date
          <input value={form.deathDate} aria-invalid={error?.startsWith("Death date") || undefined} aria-describedby={error?.startsWith("Death date") ? errorId : undefined} placeholder="YYYY, YYYY-MM, or Nov. YYYY" onChange={(event) => setForm((current) => ({ ...current, deathDate: event.target.value }))} />
        </label>
        <label className="burial-wide-field">
          Death location
          <LookupSelect value={form.deathPlaceId} onChange={(event) => setForm((current) => ({ ...current, deathPlaceId: event.target.value }))}>
            <option value="">Unknown / not recorded</option>
            {lookups.verifiedPlaces.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label}
              </option>
            ))}
            {importedPlace && !lookups.verifiedPlaces.some((place) => place.id === importedPlace.id) ? (
              <option value={importedPlace.id}>{importedPlace.displayName}</option>
            ) : null}
          </LookupSelect>
          <small>Only places verified against an authoritative geographic registry are available.</small>
        </label>
        <div className="burial-wide-field">
          <label>
            Find another verified death location
            <input
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="City, state, or country"
              disabled={isSearchingPlaces || isImportingPlace}
            />
          </label>
          <button type="button" className="secondary-button" onClick={() => void searchPlaces()} disabled={isSearchingPlaces || isImportingPlace || placeQuery.trim().length < 2}>
            {isSearchingPlaces ? "Searching..." : "Search geographic registry"}
          </button>
          {placeSearchMessage ? <p className="detail-message" role={placeRetry ? "alert" : "status"}>{placeSearchMessage}</p> : null}
          {placeRetry ? <button type="button" disabled={isSearchingPlaces || isImportingPlace} onClick={() => void (placeRetry === "search" ? searchPlaces() : choosePlace(placeRetry))}>Retry place {placeRetry === "search" ? "search" : "verification"}</button> : null}
          {placeCandidates.length ? (
            <ul className="burial-notes" aria-label="Geographic search results">
              {placeCandidates.map((candidate) => (
                <li key={`${candidate.provider}-${candidate.providerId}`}>
                  <button type="button" className="secondary-button" onClick={() => void choosePlace(candidate)} disabled={isImportingPlace}>
                    Use {candidate.displayName}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
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
          <dt>Born</dt>
          <dd>{formatDate(burial.person.birthDate)}</dd>
        </div>
        <div>
          <dt>Died</dt>
          <dd>{formatDate(burial.person.deathDate)}</dd>
        </div>
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
