import { FileText } from "lucide-react";
import { formatAdminTimestamp } from "../../lib/format";
import {
deedConfidenceLabel
} from "../admin/adminWorkflowConfig";
import { ReadingFilters } from "./north-hills/ReadingFilters";
import { ReadingList } from "./north-hills/ReadingList";
import { Props } from "./north-hills/shared";
export function NorthHillsAdminTab({ applyNorthHillsReviewFilters, northHillsReviewFilters, updateNorthHillsReviewFilter, northHillsOcrReview, isLoadingNorthHillsReview, setNorthHillsReviewFilters, loadNorthHillsOcrReview, selectedNorthHillsBatch, nextUnresolvedNorthHillsEntry, goToNextUnresolvedNorthHillsEntry, canEditNorthHillsEntries, visibleNorthHillsEntryIds, selectedNorthHillsEntryIds, toggleVisibleNorthHillsEntries, selectedNorthHillsEntries, markSelectedNorthHillsReviewed, savingBulkKey, openBulkToolsTab, focusedNorthHillsEntryId, toggleNorthHillsEntrySelection, startNorthHillsEntryEdit, savingEvidenceKey, editingNorthHillsEntryId, northHillsEntryForm, saveNorthHillsEntryEdit, updateNorthHillsEntryForm, updateNorthHillsSourceFactForm, updateNorthHillsObservationForm, cancelNorthHillsEntryEdit, saveNorthHillsSourceFactReview, promoteNorthHillsDeathDate, saveNorthHillsEvidence, canUnlinkNorthHillsEvidence, unlinkNorthHillsEvidence }: Props) {
  return (
    <>
      <section className="admin-section">
        <div className="section-title">
          <FileText size={17} aria-hidden="true" />
          <h3>North Hills Readings</h3>
        </div>

        <ReadingFilters applyNorthHillsReviewFilters={applyNorthHillsReviewFilters} northHillsReviewFilters={northHillsReviewFilters} updateNorthHillsReviewFilter={updateNorthHillsReviewFilter} northHillsOcrReview={northHillsOcrReview} isLoadingNorthHillsReview={isLoadingNorthHillsReview} setNorthHillsReviewFilters={setNorthHillsReviewFilters} loadNorthHillsOcrReview={loadNorthHillsOcrReview} />

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
            data-discard-draft onClick={goToNextUnresolvedNorthHillsEntry}
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

        <ReadingList northHillsOcrReview={northHillsOcrReview} isLoadingNorthHillsReview={isLoadingNorthHillsReview} canEditNorthHillsEntries={canEditNorthHillsEntries} selectedNorthHillsEntryIds={selectedNorthHillsEntryIds} focusedNorthHillsEntryId={focusedNorthHillsEntryId} toggleNorthHillsEntrySelection={toggleNorthHillsEntrySelection} startNorthHillsEntryEdit={startNorthHillsEntryEdit} savingEvidenceKey={savingEvidenceKey} editingNorthHillsEntryId={editingNorthHillsEntryId} northHillsEntryForm={northHillsEntryForm} saveNorthHillsEntryEdit={saveNorthHillsEntryEdit} updateNorthHillsEntryForm={updateNorthHillsEntryForm} updateNorthHillsSourceFactForm={updateNorthHillsSourceFactForm} updateNorthHillsObservationForm={updateNorthHillsObservationForm} cancelNorthHillsEntryEdit={cancelNorthHillsEntryEdit} saveNorthHillsSourceFactReview={saveNorthHillsSourceFactReview} promoteNorthHillsDeathDate={promoteNorthHillsDeathDate} saveNorthHillsEvidence={saveNorthHillsEvidence} canUnlinkNorthHillsEvidence={canUnlinkNorthHillsEvidence} unlinkNorthHillsEvidence={unlinkNorthHillsEvidence} />
      </section>
    </>
  );
}
