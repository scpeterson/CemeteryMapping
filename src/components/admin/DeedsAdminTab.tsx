import { type Dispatch, FormEvent, type SetStateAction, useEffect, useState } from "react";
import { FileSearch } from "lucide-react";
import { updateDeedRegistryMapping } from "../../api/cemeteryApi";
import { formatAdminTimestamp } from "../../lib/format";
import {
  affidavitStatusLabels,
  councilStatusLabels,
  deedActionTypeLabels,
  deedStatusLabels,
  defaultDeedCaseFilters,
  defaultDeedReviewFilters,
  investigationStatusLabels,
} from "../AdminPanelDeedConfig";
import type {
  DeedInvestigationAction,
  DeedInvestigationActionType,
  DeedInvestigationAffidavitStatus,
  DeedInvestigationCase,
  DeedInvestigationCouncilStatus,
  DeedInvestigationDeedStatus,
  DeedInvestigationStatus,
  DeedRegistryReview,
  DeedRegistryReviewEntry,
  DeedRegistryReviewFilters,
  SaveDeedInvestigationActionInput,
  SaveDeedInvestigationCaseInput,
} from "../../types";

const scopeLabels: Record<string, string> = {
  grave_count_only: "Grave count only",
  multiple_lots: "Multiple lots",
  passage: "Passage",
  section_g_gravesite: "Section G gravesite",
  specific_graves: "Specific graves",
  unknown: "Unknown",
  whole_lot: "Whole lot",
};
const confidenceLabels: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Review",
};
const comparisonLabels: Record<string, string> = {
  added: "Added since Original 2017",
  changed: "Changed since Original 2017",
  unchanged: "Unchanged from Original 2017",
};
const deedScopeLabel = (scope: string) => scopeLabels[scope] ?? scope;
const deedConfidenceLabel = (confidence: string) => confidenceLabels[confidence] ?? confidence;
const deedComparisonLabel = (status: string) => comparisonLabels[status] ?? status;
const formatList = (values: string[]) => (values.length ? values.join(", ") : "None");
const deedEntryTitle = (entry: DeedRegistryReviewEntry) =>
  `Row ${entry.sourceRowNumber}. ${entry.ownerDisplayName || "No owner"}. ${deedConfidenceLabel(entry.parseConfidence)} confidence.${entry.comparisonStatus ? ` ${deedComparisonLabel(entry.comparisonStatus)}.` : ""}`;

type DeedsAdminTabProps = {
  deedCaseFilters: typeof defaultDeedCaseFilters;
  setDeedCaseFilters: Dispatch<SetStateAction<typeof defaultDeedCaseFilters>>;
  isLoadingDeedCases: boolean;
  loadDeedCases: () => Promise<void>;
  startNewDeedCase: () => void;
  deedCases: DeedInvestigationCase[];
  selectedDeedCaseId: string;
  selectDeedCase: (investigation: DeedInvestigationCase) => void;
  deedCaseForm: SaveDeedInvestigationCaseInput;
  setDeedCaseForm: Dispatch<SetStateAction<SaveDeedInvestigationCaseInput>>;
  selectedDeedCase: DeedInvestigationCase | undefined;
  savingDeedCaseKey: string | undefined;
  saveDeedCase: (event: FormEvent<HTMLFormElement>) => void;
  startNewDeedAction: () => void;
  selectedDeedActionId: string;
  selectDeedAction: (action: DeedInvestigationAction) => void;
  deedActionForm: SaveDeedInvestigationActionInput;
  setDeedActionForm: Dispatch<SetStateAction<SaveDeedInvestigationActionInput>>;
  savingDeedActionKey: string | undefined;
  saveDeedAction: (event: FormEvent<HTMLFormElement>) => void;
  deedReviewFilters: DeedRegistryReviewFilters;
  updateDeedReviewFilter: (patch: Partial<DeedRegistryReviewFilters>) => void;
  deedRegistryReview: DeedRegistryReview;
  applyDeedReviewFilters: (event: FormEvent<HTMLFormElement>) => void;
  isLoadingDeedReview: boolean;
  setDeedReviewFilters: Dispatch<SetStateAction<DeedRegistryReviewFilters>>;
  loadDeedRegistryReview: (filters?: DeedRegistryReviewFilters) => Promise<void>;
  selectedDeedBatch: DeedRegistryReview["batches"][number] | undefined;
  deedResearchTerms: string[];
  deedInvestigationOwners: string[];
  deedInvestigationLots: string[];
  deedOnFileCount: number;
  deedRegisterOnFileCount: number;
  deedInvestigationNoteCount: number;
  attachEntryToSelectedDeedCase: (entry: DeedRegistryReviewEntry) => Promise<void>;
  removedOriginalDeedEntries: DeedRegistryReview["removedOriginalEntries"];
};

function DeedRegistryMappingEditor({
  entry,
  onSaved,
}: {
  entry: DeedRegistryReviewEntry;
  onSaved: () => Promise<void>;
}) {
  const [modernSection, setModernSection] = useState(entry.modernSection);
  const [correctedLotText, setCorrectedLotText] = useState(entry.correctedLotText);
  const [correctedLastKnownDate, setCorrectedLastKnownDate] = useState(entry.correctedLastKnownDate || entry.lastKnownDate);
  const [correctedRemarks, setCorrectedRemarks] = useState(entry.correctedRemarks || entry.rawRemarks);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setModernSection(entry.modernSection);
    setCorrectedLotText(entry.correctedLotText);
    setCorrectedLastKnownDate(entry.correctedLastKnownDate || entry.lastKnownDate);
    setCorrectedRemarks(entry.correctedRemarks || entry.rawRemarks);
  }, [entry.correctedLastKnownDate, entry.correctedLotText, entry.correctedRemarks, entry.lastKnownDate, entry.modernSection, entry.rawRemarks]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(undefined);
    try {
      await updateDeedRegistryMapping(entry.id, {
        modernSection,
        correctedLotText,
        correctedLastKnownDate,
        correctedRemarks,
        reason: `Update modern mapping for deed registry row ${entry.sourceRowNumber}`,
      });
      await onSaved();
      setMessage("Mapping saved.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Unable to save mapping.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="deed-mapping-editor" onSubmit={save} aria-label={`Modern mapping for row ${entry.sourceRowNumber}`}>
      <label>
        ModernSection
        <input value={modernSection} onChange={(event) => setModernSection(event.target.value)} maxLength={100} placeholder="Example: C" />
      </label>
      <label>
        Corrected lot number
        <input value={correctedLotText} onChange={(event) => setCorrectedLotText(event.target.value)} maxLength={500} placeholder="Example: 51" />
      </label>
      <label>
        Last known date
        <input value={correctedLastKnownDate} onChange={(event) => setCorrectedLastKnownDate(event.target.value)} maxLength={50} placeholder="Example: 1944 or 1944-05-12" />
        {entry.lastKnownDate ? <small>Imported value: {entry.lastKnownDate}</small> : null}
      </label>
      <label className="deed-mapping-remarks">
        Remarks
        <textarea value={correctedRemarks} onChange={(event) => setCorrectedRemarks(event.target.value)} maxLength={4000} rows={3} />
        {entry.rawRemarks ? <small>Imported value: {entry.rawRemarks}</small> : null}
      </label>
      <button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : "Save mapping"}</button>
      {message ? <small role="status">{message}</small> : null}
    </form>
  );
}
export function DeedsAdminTab({
  deedCaseFilters,
  setDeedCaseFilters,
  isLoadingDeedCases,
  loadDeedCases,
  startNewDeedCase,
  deedCases,
  selectedDeedCaseId,
  selectDeedCase,
  deedCaseForm,
  setDeedCaseForm,
  selectedDeedCase,
  savingDeedCaseKey,
  saveDeedCase,
  startNewDeedAction,
  selectedDeedActionId,
  selectDeedAction,
  deedActionForm,
  setDeedActionForm,
  savingDeedActionKey,
  saveDeedAction,
  deedReviewFilters,
  updateDeedReviewFilter,
  deedRegistryReview,
  applyDeedReviewFilters,
  isLoadingDeedReview,
  setDeedReviewFilters,
  loadDeedRegistryReview,
  selectedDeedBatch,
  deedResearchTerms,
  deedInvestigationOwners,
  deedInvestigationLots,
  deedOnFileCount,
  deedRegisterOnFileCount,
  deedInvestigationNoteCount,
  attachEntryToSelectedDeedCase,
  removedOriginalDeedEntries,
}: DeedsAdminTabProps) {
  return (
        <>
          <section className="admin-section">
            <div className="section-title">
              <FileSearch size={17} aria-hidden="true" />
              <h3>Deed Evidence</h3>
            </div>

            <section className="deed-case-workbench" aria-label="Deed investigation cases">
              <div className="deed-case-toolbar">
                <label>
                  Case search
                  <input
                    value={deedCaseFilters.q}
                    onChange={(event) => setDeedCaseFilters((current) => ({ ...current, q: event.target.value }))}
                    placeholder="Case, family, plot, findings"
                    title="Search deed investigation cases by case number, subject, requester, plot, family summary, or findings."
                  />
                </label>
                <label>
                  Case status
                  <select
                    value={deedCaseFilters.status}
                    onChange={(event) => setDeedCaseFilters((current) => ({ ...current, status: event.target.value }))}
                    title="Filter deed investigation cases by status."
                  >
                    <option value="">All statuses</option>
                    {Object.entries(investigationStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-form-actions deed-case-actions">
                  <button type="button" onClick={() => void loadDeedCases()} disabled={isLoadingDeedCases} title="Load matching deed investigation cases.">
                    {isLoadingDeedCases ? "Loading..." : "Find cases"}
                  </button>
                  <button type="button" className="secondary-button" onClick={startNewDeedCase} title="Start a new deed investigation case.">
                    New case
                  </button>
                </div>
              </div>

              {deedCases.length ? (
                <div className="deed-case-list" aria-label="Recent deed investigation cases">
                  {deedCases.slice(0, 6).map((investigation) => (
                    <button
                      key={investigation.id}
                      type="button"
                      className={`deed-case-card ${selectedDeedCaseId === investigation.id ? "is-selected" : ""}`}
                      onClick={() => selectDeedCase(investigation)}
                      title={`${investigation.caseNumber}: ${investigation.subjectName}. ${investigationStatusLabels[investigation.status]}.`}
                    >
                      <strong>{investigation.caseNumber}</strong>
                      <span>{investigation.subjectName}</span>
                      <small>{investigation.plotReference || investigationStatusLabels[investigation.status]} · {investigation.linkedEntryCount} evidence row{investigation.linkedEntryCount === 1 ? "" : "s"}</small>
                    </button>
                  ))}
                </div>
              ) : null}

              <form className="deed-case-form" onSubmit={saveDeedCase}>
                <label>
                  Case number
                  <input
                    value={deedCaseForm.caseNumber}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, caseNumber: event.target.value }))}
                    required
                    title="Short unique identifier for this investigation."
                  />
                </label>
                <label>
                  Subject
                  <input
                    value={deedCaseForm.subjectName}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, subjectName: event.target.value }))}
                    required
                    placeholder="Elaine Krepps Wasko"
                    title="Person or family at the center of this deed investigation."
                  />
                </label>
                <label>
                  Plot
                  <input
                    value={deedCaseForm.plotReference}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, plotReference: event.target.value }))}
                    placeholder="61 OC"
                    title="Best-known plot, lot, section, or gravesite reference."
                  />
                </label>
                <label>
                  Status
                  <select
                    value={deedCaseForm.status}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, status: event.target.value as DeedInvestigationStatus }))}
                    title="Current investigation status."
                  >
                    {Object.entries(investigationStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Affidavit
                  <select
                    value={deedCaseForm.affidavitStatus}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, affidavitStatus: event.target.value as DeedInvestigationAffidavitStatus }))}
                    title="Lost deed affidavit state, if one is needed."
                  >
                    {Object.entries(affidavitStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Requester
                  <input
                    value={deedCaseForm.requesterName}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, requesterName: event.target.value }))}
                    placeholder="Barb Porti"
                    title="Person asking for the deed investigation."
                  />
                </label>
                <label className="deed-case-wide">
                  Request summary
                  <textarea
                    value={deedCaseForm.requestSummary}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, requestSummary: event.target.value }))}
                    rows={3}
                    title="What the family or pastor asked the cemetery to determine."
                  />
                </label>
                <label className="deed-case-wide">
                  Family / claimant notes
                  <textarea
                    value={deedCaseForm.familySummary}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, familySummary: event.target.value }))}
                    rows={3}
                    title="Living relatives, deceased relatives, possible deed holders, obituary notes, and claimant context."
                  />
                </label>
                <label className="deed-case-wide">
                  Findings and outcome
                  <textarea
                    value={deedCaseForm.findings}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, findings: event.target.value }))}
                    rows={3}
                    title="Evidence summary, recommendation, council decision, and final outcome."
                  />
                </label>
                {selectedDeedCase?.linkedEntries.length ? (
                  <div className="deed-case-linked deed-case-wide" aria-label="Linked deed evidence">
                    <strong>Linked evidence</strong>
                    {selectedDeedCase.linkedEntries.map((entry) => (
                      <span key={entry.id}>Row {entry.sourceRowNumber}: {entry.ownerDisplayName || "No owner"} {entry.rawLotText ? `(${entry.rawLotText})` : ""}</span>
                    ))}
                  </div>
                ) : null}
                <div className="admin-form-actions deed-case-save-actions">
                  <button type="submit" disabled={Boolean(savingDeedCaseKey) || !deedCaseForm.caseNumber.trim() || !deedCaseForm.subjectName.trim()} title="Save this deed investigation case.">
                    {savingDeedCaseKey === (selectedDeedCaseId || "new") ? "Saving..." : selectedDeedCaseId ? "Save case" : "Create case"}
                  </button>
                </div>
              </form>

              <section className="deed-action-workbench" aria-label="Recommended actions">
                <div className="deed-action-heading">
                  <strong>Recommended actions</strong>
                  <button type="button" className="secondary-button" onClick={startNewDeedAction} disabled={!selectedDeedCaseId} title="Add another recommended action to this investigation.">
                    New action
                  </button>
                </div>
                {selectedDeedCase?.recommendedActions.length ? (
                  <div className="deed-action-list">
                    {selectedDeedCase.recommendedActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={`deed-action-card ${selectedDeedActionId === action.id ? "is-selected" : ""}`}
                        onClick={() => selectDeedAction(action)}
                        title={`${action.subjectName}. ${deedActionTypeLabels[action.actionType]}. Council: ${councilStatusLabels[action.councilStatus]}.`}
                      >
                        <strong>{action.subjectName}</strong>
                        <span>{deedActionTypeLabels[action.actionType]} · {action.plotReference || "No plot"}</span>
                        <small>
                          Council {councilStatusLabels[action.councilStatus]}
                          {action.councilDecisionDate ? ` ${action.councilDecisionDate}` : ""} · Affidavit {affidavitStatusLabels[action.affidavitStatus]} · Deed {deedStatusLabels[action.deedStatus]}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="record-editor-empty">No recommended actions have been added to this case yet.</p>
                )}

                <form className="deed-action-form" onSubmit={saveDeedAction}>
                  <label>
                    Person
                    <input
                      value={deedActionForm.subjectName}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, subjectName: event.target.value }))}
                      required
                      placeholder="Elaine Krepps Wasko"
                      title="Person or party this recommended action is for."
                    />
                  </label>
                  <label>
                    Action
                    <select
                      value={deedActionForm.actionType}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, actionType: event.target.value as DeedInvestigationActionType }))}
                      title="Recommended action type."
                    >
                      {Object.entries(deedActionTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Plot / gravesite
                    <input
                      value={deedActionForm.plotReference}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, plotReference: event.target.value }))}
                      placeholder="61 OC grave 4"
                      title="Plot, gravesite, or location this action concerns."
                    />
                  </label>
                  <label>
                    Council
                    <select
                      value={deedActionForm.councilStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilStatus: event.target.value as DeedInvestigationCouncilStatus }))}
                      title="Council approval status for this action."
                    >
                      {Object.entries(councilStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Decision date
                    <input
                      type="date"
                      value={deedActionForm.councilDecisionDate}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilDecisionDate: event.target.value }))}
                      title="Date Council made or recorded its decision for this action."
                    />
                  </label>
                  <label>
                    Minutes / reference
                    <input
                      value={deedActionForm.councilDocumentReference}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilDocumentReference: event.target.value }))}
                      placeholder="Council minutes 2026-03-17"
                      title="Council minutes, agenda item, email approval, or other decision reference."
                    />
                  </label>
                  <label>
                    Affidavit
                    <select
                      value={deedActionForm.affidavitStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, affidavitStatus: event.target.value as DeedInvestigationAffidavitStatus }))}
                      title="Lost deed affidavit status for this action."
                    >
                      {Object.entries(affidavitStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Deed / outcome
                    <select
                      value={deedActionForm.deedStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, deedStatus: event.target.value as DeedInvestigationDeedStatus }))}
                      title="Deed or action outcome status."
                    >
                      {Object.entries(deedStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="deed-action-wide">
                    Notes
                    <textarea
                      value={deedActionForm.notes}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={2}
                      title="Recommendation notes, restrictions, or conditions for this action."
                    />
                  </label>
                  <label className="deed-action-wide">
                    Final outcome
                    <textarea
                      value={deedActionForm.outcome}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, outcome: event.target.value }))}
                      rows={2}
                      title="Final result once the recommended action is resolved."
                    />
                  </label>
                  <div className="admin-form-actions deed-action-save-actions">
                    <button
                      type="submit"
                      disabled={!selectedDeedCaseId || Boolean(savingDeedActionKey) || !deedActionForm.subjectName.trim()}
                      title="Save this recommended action."
                    >
                      {savingDeedActionKey === (selectedDeedActionId || "new") ? "Saving..." : selectedDeedActionId ? "Save action" : "Add action"}
                    </button>
                  </div>
                </form>
              </section>
            </section>

            <form className="deed-review-filter-form" onSubmit={applyDeedReviewFilters}>
              <label>
                Import batch
                <select
                  value={deedReviewFilters.batchId ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ batchId: event.target.value })}
                  title="Choose the staged deed registry import batch to review."
                >
                  <option value="">Latest batch</option>
                  {deedRegistryReview.batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.worksheetName} - {formatAdminTimestamp(batch.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Confidence
                <select
                  value={deedReviewFilters.confidence ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ confidence: event.target.value })}
                  title="Filter rows by parser confidence."
                >
                  <option value="">All confidence levels</option>
                  {Object.entries(confidenceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Evidence type
                <select
                  value={deedReviewFilters.ownershipScope ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ ownershipScope: event.target.value })}
                  title="Filter rows by the staged ownership or allocation interpretation."
                >
                  <option value="">All evidence types</option>
                  {Object.entries(scopeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search
                <input
                  value={deedReviewFilters.q ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ q: event.target.value })}
                  placeholder="Family names, plot, deed, remarks"
                  title="Search staged names, plot and lot text, deed flags, remarks, parsed identifiers, and related Investigated notes."
                />
              </label>
              <label>
                Limit
                <select
                  value={deedReviewFilters.limit ?? 100}
                  onChange={(event) => updateDeedReviewFilter({ limit: Number(event.target.value) })}
                  title="Limit the number of evidence rows returned."
                >
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                  <option value={250}>250 rows</option>
                </select>
              </label>
              <div className="admin-form-actions deed-review-filter-actions">
                <button type="submit" disabled={isLoadingDeedReview} title="Apply deed evidence filters.">
                  {isLoadingDeedReview ? "Loading..." : "Apply filters"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDeedReviewFilters(defaultDeedReviewFilters);
                    void loadDeedRegistryReview(defaultDeedReviewFilters);
                  }}
                  title="Clear deed evidence filters and reload the latest import batch."
                >
                  Clear
                </button>
              </div>
            </form>

            {isLoadingDeedReview ? <div className="admin-message" role="status">Loading deed evidence...</div> : null}

            {selectedDeedBatch ? (
              <article className="deed-batch-summary" title="Summary of the selected staged import batch.">
                <div>
                  <strong>{selectedDeedBatch.sourceName}</strong>
                  <small>{selectedDeedBatch.cemeteryName} · {selectedDeedBatch.worksheetName}</small>
                </div>
                <dl>
                  <div>
                    <dt>Rows</dt>
                    <dd>{selectedDeedBatch.entryCount}</dd>
                  </div>
                  <div>
                    <dt>Review</dt>
                    <dd>{selectedDeedBatch.reviewCount}</dd>
                  </div>
                  <div>
                    <dt>Low</dt>
                    <dd>{selectedDeedBatch.lowConfidenceCount}</dd>
                  </div>
                  <div>
                    <dt>Imported</dt>
                    <dd>{formatAdminTimestamp(selectedDeedBatch.createdAt)}</dd>
                  </div>
                </dl>
                {selectedDeedBatch.notes ? <p>{selectedDeedBatch.notes}</p> : null}
              </article>
            ) : null}

            {deedResearchTerms.length ? (
              <section className="deed-investigation-summary" aria-label="Deed investigation search">
                <header>
                  <strong>Investigation</strong>
                  <small>{deedRegistryReview.entries.length} matching row{deedRegistryReview.entries.length === 1 ? "" : "s"}</small>
                </header>
                <div className="deed-investigation-terms" aria-label="Search terms">
                  {deedResearchTerms.map((term) => (
                    <span key={term}>{term}</span>
                  ))}
                </div>
                <dl>
                  <div title="Distinct owner names returned by this deed evidence search.">
                    <dt>Names</dt>
                    <dd>{deedInvestigationOwners.length ? deedInvestigationOwners.join(", ") : "None"}</dd>
                  </div>
                  <div title="Lot, plot, and raw worksheet location references returned by this search.">
                    <dt>Lots / plots</dt>
                    <dd>{deedInvestigationLots.length ? deedInvestigationLots.join(", ") : "None"}</dd>
                  </div>
                  <div title="Rows that explicitly indicate a deed or deed register entry is on file.">
                    <dt>Deed flags</dt>
                    <dd>{deedOnFileCount} deed, {deedRegisterOnFileCount} register</dd>
                  </div>
                  <div title="Related notes pulled from the latest Investigated worksheet.">
                    <dt>Investigated notes</dt>
                    <dd>{deedInvestigationNoteCount}</dd>
                  </div>
                </dl>
              </section>
            ) : null}

            {deedRegistryReview.summary.length ? (
              <div className="deed-summary-grid" aria-label="Deed evidence summary">
                {deedRegistryReview.summary.map((item) => (
                  <article key={`${item.ownershipScope}:${item.parseConfidence}`} title={`${deedScopeLabel(item.ownershipScope)} rows with ${deedConfidenceLabel(item.parseConfidence)} confidence.`}>
                    <strong>{item.count}</strong>
                    <span>{deedScopeLabel(item.ownershipScope)}</span>
                    <small>{deedConfidenceLabel(item.parseConfidence)}</small>
                  </article>
                ))}
              </div>
            ) : null}

            {deedRegistryReview.comparison ? (
              <section className="deed-comparison-summary" aria-label="Original 2017 comparison">
                <header>
                  <strong>Compared with Original 2017</strong>
                  <small>{deedRegistryReview.comparison.originalBatchLabel}</small>
                </header>
                <dl>
                  <div title="Rows in this selected batch that do not have a matching owner row in Original 2017.">
                    <dt>Added</dt>
                    <dd>{deedRegistryReview.comparison.addedCount}</dd>
                  </div>
                  <div title="Rows with a matching Original 2017 owner but changed lot_id candidate, section, remarks, or deed flags.">
                    <dt>Changed</dt>
                    <dd>{deedRegistryReview.comparison.changedCount}</dd>
                  </div>
                  <div title="Rows that match the Original 2017 owner and staged values.">
                    <dt>Unchanged</dt>
                    <dd>{deedRegistryReview.comparison.unchangedCount}</dd>
                  </div>
                  <div title="Original 2017 rows whose owner does not appear in the selected batch.">
                    <dt>Removed</dt>
                    <dd>{deedRegistryReview.comparison.removedCount}</dd>
                  </div>
                </dl>
              </section>
            ) : selectedDeedBatch?.worksheetName === "Updated 2022" ? (
              <p className="record-editor-empty">Import the `Original 2017` worksheet to compare this updated registry with the original baseline.</p>
            ) : null}

            <div className="deed-entry-list" role="table" aria-label="Staged deed registry evidence">
              {deedRegistryReview.entries.length === 0 && !isLoadingDeedReview ? <p className="record-editor-empty">No deed evidence rows match these filters.</p> : null}
              {deedRegistryReview.entries.map((entry) => (
                <article key={entry.id} className={`deed-entry-row confidence-${entry.parseConfidence} comparison-${entry.comparisonStatus || "none"}`} title={deedEntryTitle(entry)}>
                  <header>
                    <span>
                      <strong>Row {entry.sourceRowNumber}</strong>
                      <small>{entry.rowType === "investigation_note" ? "Investigation note" : "Owner record"}</small>
                    </span>
                    <span>
                      <strong>{entry.ownerDisplayName || "No owner"}</strong>
                      <small>{deedConfidenceLabel(entry.parseConfidence)}</small>
                    </span>
                    <span>
                      <strong>{deedScopeLabel(entry.ownershipScope)}</strong>
                      <small>{entry.allocationCount} allocation{entry.allocationCount === 1 ? "" : "s"}</small>
                    </span>
                    {entry.comparisonStatus ? (
                      <span>
                        <strong>{deedComparisonLabel(entry.comparisonStatus)}</strong>
                        <small>{entry.originalSourceRowNumber ? `Original row ${entry.originalSourceRowNumber}` : "No original row match"}</small>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="secondary-button deed-entry-link-button"
                      onClick={() => void attachEntryToSelectedDeedCase(entry)}
                      disabled={savingDeedCaseKey === `${selectedDeedCaseId}:${entry.id}`}
                      title={selectedDeedCaseId ? `Attach row ${entry.sourceRowNumber} to the selected investigation case.` : "Select or create an investigation case before attaching evidence."}
                    >
                      {savingDeedCaseKey === `${selectedDeedCaseId}:${entry.id}` ? "Linking..." : "Attach"}
                    </button>
                  </header>
                  <dl className="deed-entry-fields">
                    <div title="Raw lot or plot text from the worksheet.">
                      <dt>Lot num / lot_id candidate</dt>
                      <dd>{entry.rawLotText || "None"}</dd>
                    </div>
                    <div title="Raw section text from the worksheet.">
                      <dt>Raw section</dt>
                      <dd>{entry.rawSectionText || "None"}</dd>
                    </div>
                    <div title="Editable modern section mapping; the original spreadsheet section remains unchanged.">
                      <dt>ModernSection</dt>
                      <dd>{entry.modernSection || "Not mapped"}</dd>
                    </div>
                    <div title="Editable corrected lot-number mapping; the original spreadsheet lot remains unchanged.">
                      <dt>Corrected lot</dt>
                      <dd>{entry.correctedLotText || "Not mapped"}</dd>
                    </div>
                    <div title="Last known date from the spreadsheet, or its editable correction.">
                      <dt>Last known date</dt>
                      <dd>{entry.correctedLastKnownDate || entry.lastKnownDate || "Not recorded"}</dd>
                    </div>
                    <div title="Parsed lot numbers staged from this row.">
                      <dt>Lots</dt>
                      <dd>{formatList(entry.parsedLotNumbers)}</dd>
                    </div>
                    <div title="Parsed gravesite numbers staged from this row.">
                      <dt>Graves</dt>
                      <dd>{formatList(entry.parsedGraveNumbers)}</dd>
                    </div>
                    <div title="Whether a deed was found in the source worksheet.">
                      <dt>Deed</dt>
                      <dd>{entry.deedOnFile || "Unknown"}</dd>
                    </div>
                    <div title="Whether a deed register entry was found in the source worksheet.">
                      <dt>Register</dt>
                      <dd>{entry.deedRegisterOnFile || "Unknown"}</dd>
                    </div>
                    <div title="Remarks from the spreadsheet, or their editable correction.">
                      <dt>Remarks</dt>
                      <dd>{entry.correctedRemarks || entry.rawRemarks || "None"}</dd>
                    </div>
                  </dl>
                  {entry.rowType === "owner_record" && ["Original 2017", "Updated 2022"].includes(selectedDeedBatch?.worksheetName ?? "") ? (
                    <DeedRegistryMappingEditor entry={entry} onSaved={() => loadDeedRegistryReview(deedReviewFilters)} />
                  ) : null}
                  {entry.mappingUpdatedAt ? (
                    <small className="deed-mapping-audit">Mapping updated {formatAdminTimestamp(entry.mappingUpdatedAt)}{entry.mappingUpdatedBy ? ` by ${entry.mappingUpdatedBy}` : ""}.</small>
                  ) : null}
                  {entry.rawRemarks ? <p className="deed-entry-remarks">{entry.rawRemarks}</p> : null}
                  {entry.comparisonStatus === "changed" ? (
                    <section className="deed-comparison-detail" aria-label="Original 2017 values">
                      <h4>Original 2017 values</h4>
                      <dl>
                        <div>
                          <dt>Lot num / lot_id candidate</dt>
                          <dd>{entry.originalRawLotText || "None"}</dd>
                        </div>
                        <div>
                          <dt>Section</dt>
                          <dd>{entry.originalRawSectionText || "None"}</dd>
                        </div>
                        <div>
                          <dt>Remarks</dt>
                          <dd>{entry.originalRawRemarks || "None"}</dd>
                        </div>
                      </dl>
                    </section>
                  ) : null}
                  {entry.parseNotes.length ? (
                    <ul className="deed-entry-notes" aria-label="Parser notes">
                      {entry.parseNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.relatedInvestigationNotes.length ? (
                    <section className="deed-investigation-links" aria-label="Related investigation notes">
                      <h4>Related investigation notes</h4>
                      {entry.relatedInvestigationNotes.map((note) => (
                        <p key={`${note.sourceRowNumber}:${note.rawRemarks}`}>
                          <strong>Investigated row {note.sourceRowNumber}:</strong> {note.rawRemarks}
                        </p>
                      ))}
                    </section>
                  ) : null}
                </article>
              ))}
            </div>

            {removedOriginalDeedEntries.length ? (
              <section className="deed-removed-list" aria-label="Original 2017 rows missing from selected batch">
                <h4>Original 2017 rows not found in selected batch</h4>
                {removedOriginalDeedEntries.map((entry) => (
                  <article key={entry.id}>
                    <strong>Row {entry.sourceRowNumber}: {entry.ownerDisplayName || "No owner"}</strong>
                    <span>Lot num / lot_id candidate: {entry.rawLotText || formatList(entry.parsedLotNumbers)}</span>
                    {entry.rawRemarks ? <p>{entry.rawRemarks}</p> : null}
                  </article>
                ))}
              </section>
            ) : null}
          </section>
        </>
  );
}
