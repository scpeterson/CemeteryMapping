import {
deedConfidenceLabel,
formatList,
observationStatusLabels,
observationTypeLabels,
readingEntryTitle
} from "../../admin/adminWorkflowConfig";
import { ReadingEditor } from "./ReadingEditor";
import { ReadingMatches } from "./ReadingMatches";
import { ReadingSourceFacts } from "./ReadingSourceFacts";
import { Props } from "./shared";

export function ReadingList({ northHillsOcrReview, isLoadingNorthHillsReview, canEditNorthHillsEntries, selectedNorthHillsEntryIds, focusedNorthHillsEntryId, toggleNorthHillsEntrySelection, startNorthHillsEntryEdit, savingEvidenceKey, editingNorthHillsEntryId, northHillsEntryForm, saveNorthHillsEntryEdit, updateNorthHillsEntryForm, updateNorthHillsSourceFactForm, updateNorthHillsObservationForm, cancelNorthHillsEntryEdit, saveNorthHillsSourceFactReview, promoteNorthHillsDeathDate, saveNorthHillsEvidence, canUnlinkNorthHillsEvidence, unlinkNorthHillsEvidence }: Pick<Props, "northHillsOcrReview" | "isLoadingNorthHillsReview" | "canEditNorthHillsEntries" | "selectedNorthHillsEntryIds" | "focusedNorthHillsEntryId" | "toggleNorthHillsEntrySelection" | "startNorthHillsEntryEdit" | "savingEvidenceKey" | "editingNorthHillsEntryId" | "northHillsEntryForm" | "saveNorthHillsEntryEdit" | "updateNorthHillsEntryForm" | "updateNorthHillsSourceFactForm" | "updateNorthHillsObservationForm" | "cancelNorthHillsEntryEdit" | "saveNorthHillsSourceFactReview" | "promoteNorthHillsDeathDate" | "saveNorthHillsEvidence" | "canUnlinkNorthHillsEvidence" | "unlinkNorthHillsEvidence">) {
  return (<div className="deed-entry-list" role="table" aria-label="Staged North Hills readings">
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
                  <ReadingEditor savingEvidenceKey={savingEvidenceKey} northHillsEntryForm={northHillsEntryForm} saveNorthHillsEntryEdit={saveNorthHillsEntryEdit} updateNorthHillsEntryForm={updateNorthHillsEntryForm} updateNorthHillsSourceFactForm={updateNorthHillsSourceFactForm} updateNorthHillsObservationForm={updateNorthHillsObservationForm} cancelNorthHillsEntryEdit={cancelNorthHillsEntryEdit} entry={entry} />
                ) : null}
                {entry.sourceFacts.length ? (
                  <ReadingSourceFacts savingEvidenceKey={savingEvidenceKey} saveNorthHillsSourceFactReview={saveNorthHillsSourceFactReview} promoteNorthHillsDeathDate={promoteNorthHillsDeathDate} entry={entry} />
                ) : null}
                {entry.candidateMatches.length ? (
                  <ReadingMatches savingEvidenceKey={savingEvidenceKey} saveNorthHillsEvidence={saveNorthHillsEvidence} canUnlinkNorthHillsEvidence={canUnlinkNorthHillsEvidence} unlinkNorthHillsEvidence={unlinkNorthHillsEvidence} entry={entry} />
                ) : null}
              </article>
            );
          })}
        </div>);
}
