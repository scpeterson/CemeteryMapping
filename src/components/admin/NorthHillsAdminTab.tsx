import { FileText } from "lucide-react";
import { formatAdminTimestamp } from "../../lib/format";
import type {
  NorthHillsOcrObservation,
  NorthHillsOcrReviewFilters,
  NorthHillsSourceFact,
  NorthHillsSourceFactStatus
} from "../../types";
import {
  blankNorthHillsObservation,
  blankNorthHillsSourceFact,
  candidateGravesiteLabel,
  confidenceLabels,
  deedConfidenceLabel,
  defaultNorthHillsReviewFilters,
  entryStatusOptions,
  evidenceStatusLabels,
  formatList,
  hasNorthHillsEvidenceStatus,
  markerScopeOptions,
  observationStatusLabels,
  observationTypeLabels,
  readingEntryTitle,
  sourceFactStatusLabels,
  sourceFactTypeLabels
} from "../admin/adminWorkflowConfig";
import { useBulkAdministration } from "../admin/useBulkAdministration";
import { useNorthHillsAdministration } from "../admin/useNorthHillsAdministration";

type Props = Pick<ReturnType<typeof useNorthHillsAdministration>, "applyNorthHillsReviewFilters" | "northHillsReviewFilters" | "updateNorthHillsReviewFilter" | "northHillsOcrReview" | "isLoadingNorthHillsReview" | "setNorthHillsReviewFilters" | "loadNorthHillsOcrReview" | "selectedNorthHillsBatch" | "nextUnresolvedNorthHillsEntry" | "goToNextUnresolvedNorthHillsEntry" | "visibleNorthHillsEntryIds" | "selectedNorthHillsEntryIds" | "toggleVisibleNorthHillsEntries" | "selectedNorthHillsEntries" | "focusedNorthHillsEntryId" | "toggleNorthHillsEntrySelection" | "startNorthHillsEntryEdit" | "savingEvidenceKey" | "editingNorthHillsEntryId" | "northHillsEntryForm" | "saveNorthHillsEntryEdit" | "updateNorthHillsEntryForm" | "updateNorthHillsSourceFactForm" | "updateNorthHillsObservationForm" | "cancelNorthHillsEntryEdit" | "saveNorthHillsSourceFactReview" | "promoteNorthHillsDeathDate" | "saveNorthHillsEvidence" | "unlinkNorthHillsEvidence"> &
  Pick<ReturnType<typeof useBulkAdministration>, "markSelectedNorthHillsReviewed" | "savingBulkKey" | "openBulkToolsTab"> &
{
  canEditNorthHillsEntries: boolean;
  canUnlinkNorthHillsEvidence: boolean;
};

export function NorthHillsAdminTab({
  applyNorthHillsReviewFilters,
  northHillsReviewFilters,
  updateNorthHillsReviewFilter,
  northHillsOcrReview,
  isLoadingNorthHillsReview,
  setNorthHillsReviewFilters,
  loadNorthHillsOcrReview,
  selectedNorthHillsBatch,
  nextUnresolvedNorthHillsEntry,
  goToNextUnresolvedNorthHillsEntry,
  canEditNorthHillsEntries,
  visibleNorthHillsEntryIds,
  selectedNorthHillsEntryIds,
  toggleVisibleNorthHillsEntries,
  selectedNorthHillsEntries,
  markSelectedNorthHillsReviewed,
  savingBulkKey,
  openBulkToolsTab,
  focusedNorthHillsEntryId,
  toggleNorthHillsEntrySelection,
  startNorthHillsEntryEdit,
  savingEvidenceKey,
  editingNorthHillsEntryId,
  northHillsEntryForm,
  saveNorthHillsEntryEdit,
  updateNorthHillsEntryForm,
  updateNorthHillsSourceFactForm,
  updateNorthHillsObservationForm,
  cancelNorthHillsEntryEdit,
  saveNorthHillsSourceFactReview,
  promoteNorthHillsDeathDate,
  saveNorthHillsEvidence,
  canUnlinkNorthHillsEvidence,
  unlinkNorthHillsEvidence
}: Props) {
  return (
    <>
      <section className="admin-section">
        <div className="section-title">
          <FileText size={17} aria-hidden="true" />
          <h3>North Hills Readings</h3>
        </div>

        <form className="deed-review-filter-form" onSubmit={applyNorthHillsReviewFilters}>
          <label>
            Import batch
            <select
              value={northHillsReviewFilters.batchId ?? ""}
              onChange={(event) => updateNorthHillsReviewFilter({ batchId: event.target.value })}
              title="Choose the staged North Hills OCR import batch to review."
            >
              <option value="">Latest batch</option>
              {northHillsOcrReview.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.sourceName} - {formatAdminTimestamp(batch.createdAt)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Confidence
            <select
              value={northHillsReviewFilters.confidence ?? ""}
              onChange={(event) => updateNorthHillsReviewFilter({ confidence: event.target.value })}
              title="Filter OCR rows by parser confidence."
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
            Section
            <select
              value={northHillsReviewFilters.section ?? ""}
              onChange={(event) => updateNorthHillsReviewFilter({ section: event.target.value })}
              title="Filter OCR readings by parsed cemetery section."
            >
              <option value="">All sections</option>
              {["A", "B", "C", "D", "E"].map((section) => (
                <option key={section} value={section}>
                  Section {section}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select
              value={northHillsReviewFilters.sort ?? "review"}
              onChange={(event) => updateNorthHillsReviewFilter({ sort: event.target.value as NorthHillsOcrReviewFilters["sort"] })}
              title="Choose whether readings use the review-priority order or printed page order."
            >
              <option value="review">Review priority</option>
              <option value="page">Page number</option>
            </select>
          </label>
          <label>
            Search
            <input
              value={northHillsReviewFilters.q ?? ""}
              onChange={(event) => updateNorthHillsReviewFilter({ q: event.target.value })}
              placeholder="Name, page number, inscription, or OCR text"
              title="Search staged names, printed page numbers, inscriptions, and raw OCR text."
            />
          </label>
          <label>
            Limit
            <select
              value={northHillsReviewFilters.limit ?? 100}
              onChange={(event) => updateNorthHillsReviewFilter({ limit: Number(event.target.value) })}
              title="Limit the number of OCR reading rows returned."
            >
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
            </select>
          </label>
          <div className="admin-form-actions deed-review-filter-actions">
            <button type="submit" disabled={isLoadingNorthHillsReview} title="Apply North Hills reading filters.">
              {isLoadingNorthHillsReview ? "Loading..." : "Apply filters"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setNorthHillsReviewFilters(defaultNorthHillsReviewFilters);
                void loadNorthHillsOcrReview(defaultNorthHillsReviewFilters);
              }}
              title="Clear North Hills reading filters and reload the latest import batch."
            >
              Clear
            </button>
          </div>
        </form>

        {isLoadingNorthHillsReview ? <div className="admin-message" role="status">Loading North Hills readings...</div> : null}

        {selectedNorthHillsBatch ? (
          <article className="deed-batch-summary" title="Summary of the selected staged OCR import batch.">
            <div>
              <strong>{selectedNorthHillsBatch.sourceName}</strong>
              <small>{selectedNorthHillsBatch.cemeteryName}</small>
            </div>
            <dl>
              <div>
                <dt>Rows</dt>
                <dd>{selectedNorthHillsBatch.entryCount}</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>{selectedNorthHillsBatch.reviewCount}</dd>
              </div>
              <div>
                <dt>Candidates</dt>
                <dd>{selectedNorthHillsBatch.matchedCount}</dd>
              </div>
              <div>
                <dt>Imported</dt>
                <dd>{formatAdminTimestamp(selectedNorthHillsBatch.createdAt)}</dd>
              </div>
            </dl>
            {selectedNorthHillsBatch.notes ? <p>{selectedNorthHillsBatch.notes}</p> : null}
          </article>
        ) : null}

        {northHillsOcrReview.summary.length ? (
          <div className="deed-summary-grid" aria-label="North Hills readings summary">
            {northHillsOcrReview.summary.map((item) => (
              <article key={`${item.status}:${item.parseConfidence}`} title={`${item.status} rows with ${deedConfidenceLabel(item.parseConfidence)} confidence.`}>
                <strong>{item.count}</strong>
                <span>{item.status}</span>
                <small>{deedConfidenceLabel(item.parseConfidence)}</small>
              </article>
            ))}
          </div>
        ) : null}

        <div className="review-workbench-toolbar" aria-label="North Hills reading review queue">
          <div>
            <strong>Review queue</strong>
            <span>{nextUnresolvedNorthHillsEntry ? "Jump to the next visible NHG reading with pending links, matches, or facts." : "No unresolved NHG readings are visible."}</span>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={goToNextUnresolvedNorthHillsEntry}
            disabled={!nextUnresolvedNorthHillsEntry || isLoadingNorthHillsReview}
            title="Scroll to the next visible NHG reading that still has pending work."
          >
            Next unresolved
          </button>
        </div>

        {canEditNorthHillsEntries ? (
          <div className="bulk-selection-toolbar" aria-label="Selected North Hills reading actions">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={visibleNorthHillsEntryIds.length > 0 && visibleNorthHillsEntryIds.every((id) => selectedNorthHillsEntryIds.has(id))}
                onChange={toggleVisibleNorthHillsEntries}
              />
              Select visible
            </label>
            <span>{selectedNorthHillsEntries.length} selected</span>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void markSelectedNorthHillsReviewed()}
              disabled={!selectedNorthHillsEntries.length || Boolean(savingBulkKey)}
              title="Mark the selected NHG readings as reviewed."
            >
              Mark reviewed
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={openBulkToolsTab}
              disabled={!selectedNorthHillsEntries.length}
              title="Open Bulk tools to apply a shared source note to selected readings."
            >
              Bulk note
            </button>
          </div>
        ) : null}

        <div className="deed-entry-list" role="table" aria-label="Staged North Hills readings">
          {northHillsOcrReview.entries.length === 0 && !isLoadingNorthHillsReview ? <p className="record-editor-empty">No North Hills readings match these filters.</p> : null}
          {northHillsOcrReview.entries.map((entry) => {
            const processingSummary = entry.processingSummary;
            return (
              <article
                id={`north-hills-entry-${entry.id}`}
                key={entry.id}
                className={`deed-entry-row confidence-${entry.parseConfidence} ${focusedNorthHillsEntryId === entry.id ? "is-review-target" : ""}`}
                title={readingEntryTitle(entry)}
              >
                <header>
                  {canEditNorthHillsEntries ? (
                    <label className="reading-select-checkbox" title="Select this NHG reading for bulk actions.">
                      <input
                        type="checkbox"
                        checked={selectedNorthHillsEntryIds.has(entry.id)}
                        onChange={() => toggleNorthHillsEntrySelection(entry.id)}
                      />
                      <span className="sr-only">Select {entry.nameText || "NHG reading"}</span>
                    </label>
                  ) : null}
                  <span>
                    <strong>Page {entry.sourcePageNumber ?? entry.sourcePageIndex}</strong>
                    <small>Lines {entry.sourceLineStart}-{entry.sourceLineEnd}</small>
                  </span>
                  <span>
                    <strong>{entry.nameText || "Unnamed reading"}</strong>
                    <small>{deedConfidenceLabel(entry.parseConfidence)}</small>
                  </span>
                  <span>
                    <strong>{entry.candidateMatchCount} possible match{entry.candidateMatchCount === 1 ? "" : "es"}</strong>
                    <small>{entry.status}</small>
                  </span>
                  <span className={`reading-processing-status ${processingSummary.isProcessed ? "processed" : "pending"}`} title={processingSummary.detail}>
                    <strong>{processingSummary.label}</strong>
                    <small>{processingSummary.totalCount ? `${processingSummary.totalCount - processingSummary.pendingCount}/${processingSummary.totalCount} handled` : "Nothing to review"}</small>
                  </span>
                  {canEditNorthHillsEntries ? (
                    <span className="reading-entry-header-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => startNorthHillsEntryEdit(entry)}
                        disabled={Boolean(savingEvidenceKey)}
                        title="Edit this staged North Hills reading, parsed fields, source facts, and observations."
                      >
                        Edit
                      </button>
                    </span>
                  ) : null}
                </header>
                <dl className="deed-entry-fields">
                  <div title="Parsed section, row, and position from the North Hills coordinate.">
                    <dt>Location</dt>
                    <dd>
                      NHG location: {entry.parsedSectionName ? `Section ${entry.parsedSectionName}` : "Unknown"}
                      {entry.parsedRowNumber ? `, row ${entry.parsedRowNumber}` : ""}
                      {entry.parsedPositionNumber ? `, #${entry.parsedPositionNumber}` : ""}
                    </dd>
                  </div>
                  <div title="Marker type text parsed from the OCR descriptor.">
                    <dt>Marker</dt>
                    <dd>{entry.markerTypeText || "Unknown"}</dd>
                  </div>
                  <div title="Material text parsed from the OCR descriptor.">
                    <dt>Material</dt>
                    <dd>{entry.materialText || "Unknown"}</dd>
                  </div>
                  <div title="Condition text parsed from the OCR descriptor.">
                    <dt>Condition</dt>
                    <dd>{entry.conditionText || "Unknown"}</dd>
                  </div>
                  <div title="Four-digit years detected in the OCR reading.">
                    <dt>Years</dt>
                    <dd>{entry.parsedYears.length ? entry.parsedYears.join(", ") : "None"}</dd>
                  </div>
                  <div title="Surnames parsed from the reading heading.">
                    <dt>Surnames</dt>
                    <dd>{formatList(entry.surnames)}</dd>
                  </div>
                </dl>
                {entry.rawText ? <p className="deed-entry-remarks">{entry.rawText}</p> : null}
                {entry.parseNotes.length ? (
                  <ul className="deed-entry-notes" aria-label="Parser notes">
                    {entry.parseNotes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                ) : null}
                {entry.observations.length ? (
                  <section className="deed-investigation-links" aria-label="North Hills observations">
                    <h4>Observations</h4>
                    {entry.observations.map((observation) => (
                      <article key={observation.id} className="reading-match-review">
                        <p>
                          <strong>{observationTypeLabels[observation.observationType]}:</strong> {observation.observationText}
                        </p>
                        <small>{observationStatusLabels[observation.status]}</small>
                      </article>
                    ))}
                  </section>
                ) : null}
                {editingNorthHillsEntryId === entry.id && northHillsEntryForm ? (
                  <form className="reading-entry-edit-form" onSubmit={saveNorthHillsEntryEdit}>
                    <div className="section-title">
                      <FileText size={16} aria-hidden="true" />
                      <h4>Edit NHG Entry</h4>
                    </div>
                    <label className="wide-field">
                      Raw entry text
                      <textarea
                        value={northHillsEntryForm.rawText}
                        onChange={(event) => updateNorthHillsEntryForm({ rawText: event.target.value })}
                        rows={5}
                      />
                    </label>
                    <div className="reading-edit-grid">
                      <label>
                        Name
                        <input value={northHillsEntryForm.nameText} onChange={(event) => updateNorthHillsEntryForm({ nameText: event.target.value })} />
                      </label>
                      <label>
                        Surnames
                        <input value={northHillsEntryForm.surnamesText} onChange={(event) => updateNorthHillsEntryForm({ surnamesText: event.target.value })} />
                      </label>
                      <label>
                        Page
                        <input
                          type="number"
                          value={northHillsEntryForm.sourcePageNumber ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ sourcePageNumber: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Line start
                        <input
                          type="number"
                          value={northHillsEntryForm.sourceLineStart ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ sourceLineStart: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Line end
                        <input
                          type="number"
                          value={northHillsEntryForm.sourceLineEnd ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ sourceLineEnd: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Section
                        <input value={northHillsEntryForm.parsedSectionName} onChange={(event) => updateNorthHillsEntryForm({ parsedSectionName: event.target.value.toUpperCase() })} />
                      </label>
                      <label>
                        Row
                        <input
                          type="number"
                          value={northHillsEntryForm.parsedRowNumber ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ parsedRowNumber: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Position
                        <input
                          type="number"
                          value={northHillsEntryForm.parsedPositionNumber ?? ""}
                          onChange={(event) => updateNorthHillsEntryForm({ parsedPositionNumber: event.target.value ? Number(event.target.value) : null })}
                        />
                      </label>
                      <label>
                        Scope
                        <select value={northHillsEntryForm.parsedMarkerScope} onChange={(event) => updateNorthHillsEntryForm({ parsedMarkerScope: event.target.value })}>
                          {markerScopeOptions.map((scope) => (
                            <option key={scope || "blank"} value={scope}>
                              {scope || "Not recorded"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Marker
                        <input value={northHillsEntryForm.markerTypeText} onChange={(event) => updateNorthHillsEntryForm({ markerTypeText: event.target.value })} />
                      </label>
                      <label>
                        Material
                        <input value={northHillsEntryForm.materialText} onChange={(event) => updateNorthHillsEntryForm({ materialText: event.target.value })} />
                      </label>
                      <label>
                        Condition
                        <input value={northHillsEntryForm.conditionText} onChange={(event) => updateNorthHillsEntryForm({ conditionText: event.target.value })} />
                      </label>
                      <label>
                        Years
                        <input value={northHillsEntryForm.parsedYearsText} onChange={(event) => updateNorthHillsEntryForm({ parsedYearsText: event.target.value })} />
                      </label>
                      <label>
                        Confidence
                        <select value={northHillsEntryForm.parseConfidence} onChange={(event) => updateNorthHillsEntryForm({ parseConfidence: event.target.value })}>
                          {Object.entries(confidenceLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select value={northHillsEntryForm.status} onChange={(event) => updateNorthHillsEntryForm({ status: event.target.value })}>
                          {entryStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="wide-field">
                      Inscription text
                      <textarea
                        value={northHillsEntryForm.inscriptionText}
                        onChange={(event) => updateNorthHillsEntryForm({ inscriptionText: event.target.value })}
                        rows={3}
                      />
                    </label>
                    <label className="wide-field">
                      Parser notes
                      <textarea
                        value={northHillsEntryForm.parseNotesText}
                        onChange={(event) => updateNorthHillsEntryForm({ parseNotesText: event.target.value })}
                        rows={2}
                      />
                    </label>
                    <section className="reading-edit-subsection">
                      <div className="reading-edit-subsection-title">
                        <h5>CR/CRG source facts</h5>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => updateNorthHillsEntryForm({ sourceFacts: [...northHillsEntryForm.sourceFacts, blankNorthHillsSourceFact()] })}
                        >
                          Add fact
                        </button>
                      </div>
                      {northHillsEntryForm.sourceFacts.map((fact, index) => (
                        <div key={fact.id || `new-fact-${index}`} className="reading-edit-repeat-row">
                          <select value={fact.sourceCode} onChange={(event) => updateNorthHillsSourceFactForm(index, { sourceCode: event.target.value as "CR" | "CRG" })}>
                            <option value="CR">CR</option>
                            <option value="CRG">CRG</option>
                          </select>
                          <select value={fact.factType} onChange={(event) => updateNorthHillsSourceFactForm(index, { factType: event.target.value as NorthHillsSourceFact["factType"] })}>
                            {Object.entries(sourceFactTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <input value={fact.factValue} onChange={(event) => updateNorthHillsSourceFactForm(index, { factValue: event.target.value })} placeholder="Value" />
                          <input type="date" value={fact.factDate ?? ""} onChange={(event) => updateNorthHillsSourceFactForm(index, { factDate: event.target.value })} />
                          <select value={fact.confidence} onChange={(event) => updateNorthHillsSourceFactForm(index, { confidence: event.target.value as NorthHillsSourceFact["confidence"] })}>
                            {Object.entries(confidenceLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <select value={fact.status} onChange={(event) => updateNorthHillsSourceFactForm(index, { status: event.target.value as NorthHillsSourceFactStatus })}>
                            {Object.entries(sourceFactStatusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <textarea value={fact.rawText} onChange={(event) => updateNorthHillsSourceFactForm(index, { rawText: event.target.value })} placeholder="Raw source text" rows={2} />
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => updateNorthHillsEntryForm({ sourceFacts: northHillsEntryForm.sourceFacts.filter((_, factIndex) => factIndex !== index) })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>
                    <section className="reading-edit-subsection">
                      <div className="reading-edit-subsection-title">
                        <h5>Observations</h5>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => updateNorthHillsEntryForm({ observations: [...northHillsEntryForm.observations, blankNorthHillsObservation()] })}
                        >
                          Add observation
                        </button>
                      </div>
                      {northHillsEntryForm.observations.map((observation, index) => (
                        <div key={observation.id || `new-observation-${index}`} className="reading-edit-repeat-row reading-edit-observation-row">
                          <select
                            value={observation.observationType}
                            onChange={(event) => updateNorthHillsObservationForm(index, { observationType: event.target.value as NorthHillsOcrObservation["observationType"] })}
                          >
                            {Object.entries(observationTypeLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <select value={observation.status} onChange={(event) => updateNorthHillsObservationForm(index, { status: event.target.value as NorthHillsOcrObservation["status"] })}>
                            {Object.entries(observationStatusLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <textarea
                            value={observation.observationText}
                            onChange={(event) => updateNorthHillsObservationForm(index, { observationText: event.target.value })}
                            rows={2}
                          />
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => updateNorthHillsEntryForm({ observations: northHillsEntryForm.observations.filter((_, observationIndex) => observationIndex !== index) })}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </section>
                    <label className="wide-field">
                      Change reason
                      <input value={northHillsEntryForm.reason} onChange={(event) => updateNorthHillsEntryForm({ reason: event.target.value })} />
                    </label>
                    <div className="admin-form-actions">
                      <button type="submit" disabled={savingEvidenceKey === `${entry.id}:entry-edit`}>
                        {savingEvidenceKey === `${entry.id}:entry-edit` ? "Saving..." : "Save entry"}
                      </button>
                      <button type="button" className="secondary-button" onClick={cancelNorthHillsEntryEdit}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
                {entry.sourceFacts.length ? (
                  <section className="deed-investigation-links" aria-label="Church record source facts">
                    <h4>Church record facts</h4>
                    {entry.sourceFacts.map((fact) => {
                      const factReviewed = fact.status === "reviewed";
                      const factRejected = fact.status === "rejected";
                      return (
                        <article key={fact.id} className="reading-match-review">
                          <p>
                            <strong>{fact.sourceCode} {sourceFactTypeLabels[fact.factType]}:</strong> {fact.factValue}
                            {fact.factDate ? ` (${fact.factDate})` : ""}
                          </p>
                          <small>
                            {fact.sourceLabel} · {sourceFactStatusLabels[fact.status] ?? fact.status} · {deedConfidenceLabel(fact.confidence)}
                            {fact.reviewedByEmail ? ` · ${fact.reviewedByEmail}` : ""}
                          </small>
                          {fact.rawText ? <p className="deed-entry-remarks">{fact.rawText}</p> : null}
                          {fact.reviewNotes ? <p className="deed-entry-remarks">{fact.reviewNotes}</p> : null}
                          <div className="reading-match-actions">
                            {fact.status !== "promoted" ? (
                              <>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || factReviewed}
                                  onClick={() => void saveNorthHillsSourceFactReview(fact, "reviewed")}
                                  title={factReviewed ? "This church record fact is already reviewed." : "Mark this church record fact as reviewed."}
                                >
                                  Mark reviewed
                                </button>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || factRejected}
                                  onClick={() => void saveNorthHillsSourceFactReview(fact, "rejected")}
                                  title={factRejected ? "This church record fact is already rejected." : "Reject this church record fact."}
                                >
                                  Reject fact
                                </button>
                              </>
                            ) : null}
                            {fact.factType === "death_date" && fact.status !== "promoted"
                              ? entry.candidateMatches.map((match) => (
                                <button
                                  key={`${fact.id}:${match.burialId}`}
                                  type="button"
                                  className="secondary-button"
                                  disabled={Boolean(savingEvidenceKey) || fact.promotedBurialId === match.burialId}
                                  onClick={() => void promoteNorthHillsDeathDate(fact, match)}
                                  title={`Promote this church record death date to ${match.fullName || match.gravesiteId}.`}
                                >
                                  Promote to {match.fullName || match.gravesiteId}
                                </button>
                              ))
                              : null}
                          </div>
                        </article>
                      );
                    })}
                  </section>
                ) : null}
                {entry.candidateMatches.length ? (
                  <section className="deed-investigation-links" aria-label="Possible existing burial matches">
                    <h4>Possible existing matches</h4>
                    {entry.candidateMatches.map((match) => {
                      const gravesiteLinked = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "linked");
                      const gravesiteRejected = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "rejected");
                      const gravesiteNeedsFieldCheck = hasNorthHillsEvidenceStatus(match.gravesiteEvidence, "needs_field_check");
                      return (
                        <article key={`${entry.id}:${match.burialId}`} className="reading-match-review">
                          <p>
                            <strong>{match.fullName || "Unnamed burial"}:</strong>{" "}
                            Gravesite {candidateGravesiteLabel(match)} · Record ID {match.gravesiteId} · score {match.score}
                          </p>
                          {match.gravesiteEvidence.length ? (
                            <small>
                              Gravesite review:{" "}
                              {match.gravesiteEvidence.map((evidence) => evidenceStatusLabels[evidence.status] ?? evidence.status).join(", ")}
                            </small>
                          ) : null}
                          <div className="reading-match-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteLinked}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "linked", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteLinked ? "This North Hills reading is already linked to this gravesite." : "Confirm this North Hills reading belongs to this gravesite."}
                            >
                              Link gravesite
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteRejected}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "rejected", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteRejected ? "This possible gravesite match is already rejected." : "Reject this possible gravesite match."}
                            >
                              Reject match
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={Boolean(savingEvidenceKey) || gravesiteNeedsFieldCheck}
                              onClick={() => void saveNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, "needs_field_check", `gravesite ${match.gravesiteId}`)}
                              title={gravesiteNeedsFieldCheck ? "This possible gravesite match is already marked for field review." : "Mark this possible match for field review."}
                            >
                              Needs field check
                            </button>
                            {canUnlinkNorthHillsEvidence && match.gravesiteEvidence.length ? (
                              <button
                                type="button"
                                className="secondary-button"
                                disabled={Boolean(savingEvidenceKey)}
                                onClick={() => void unlinkNorthHillsEvidence(entry.id, "gravesite", match.gravesiteUuid, `gravesite ${match.gravesiteId}`)}
                                title="Remove this North Hills reading from this gravesite."
                              >
                                Unlink gravesite
                              </button>
                            ) : null}
                          </div>
                          {match.headstoneCandidates.length ? (
                            <div className="reading-headstone-candidates">
                              {match.headstoneCandidates.map((headstone) => {
                                const headstoneLinked = hasNorthHillsEvidenceStatus(headstone.evidence, "linked");
                                const headstoneRejected = hasNorthHillsEvidenceStatus(headstone.evidence, "rejected");
                                const headstoneNeedsFieldCheck = hasNorthHillsEvidenceStatus(headstone.evidence, "needs_field_check");
                                return (
                                  <span key={headstone.id}>
                                    <strong>{headstone.headstoneId}</strong>
                                    {headstone.evidence.length ? ` (${headstone.evidence.map((evidence) => evidenceStatusLabels[evidence.status] ?? evidence.status).join(", ")})` : ""}
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={Boolean(savingEvidenceKey) || headstoneLinked}
                                      onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "linked", `headstone ${headstone.headstoneId}`)}
                                      title={headstoneLinked ? "This North Hills reading is already linked to this headstone." : "Confirm this North Hills reading belongs to this headstone."}
                                    >
                                      Link headstone
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={Boolean(savingEvidenceKey) || headstoneRejected}
                                      onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "rejected", `headstone ${headstone.headstoneId}`)}
                                      title={headstoneRejected ? "This possible headstone match is already rejected." : "Reject this possible headstone match."}
                                    >
                                      Reject headstone
                                    </button>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      disabled={Boolean(savingEvidenceKey) || headstoneNeedsFieldCheck}
                                      onClick={() => void saveNorthHillsEvidence(entry.id, "headstone", headstone.id, "needs_field_check", `headstone ${headstone.headstoneId}`)}
                                      title={headstoneNeedsFieldCheck ? "This possible headstone match is already marked for field review." : "Mark this possible headstone match for field review."}
                                    >
                                      Field check
                                    </button>
                                    {canUnlinkNorthHillsEvidence && headstone.evidence.length ? (
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        disabled={Boolean(savingEvidenceKey)}
                                        onClick={() => void unlinkNorthHillsEvidence(entry.id, "headstone", headstone.id, `headstone ${headstone.headstoneId}`)}
                                        title="Remove this North Hills reading from this headstone."
                                      >
                                        Unlink headstone
                                      </button>
                                    ) : null}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </section>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
