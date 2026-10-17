import { FileSearch } from "lucide-react";
import { formatAdminTimestamp } from "../../lib/format";
import { DeedActions } from "./deeds/DeedActions";
import { DeedCaseEditor } from "./deeds/DeedCaseEditor";
import { DeedCaseFilters } from "./deeds/DeedCaseFilters";
import { DeedCaseList } from "./deeds/DeedCaseList";
import { DeedEvidenceList } from "./deeds/DeedEvidenceList";
import { DeedReviewFilters } from "./deeds/DeedReviewFilters";
import { deedConfidenceLabel,DeedsAdminTabProps,deedScopeLabel,formatList } from "./deeds/shared";
export function DeedsAdminTab({ deedCaseFilters, setDeedCaseFilters, isLoadingDeedCases, loadDeedCases, startNewDeedCase, deedCases, selectedDeedCaseId, selectDeedCase, deedCaseForm, setDeedCaseForm, selectedDeedCase, savingDeedCaseKey, saveDeedCase, startNewDeedAction, selectedDeedActionId, selectDeedAction, deedActionForm, setDeedActionForm, savingDeedActionKey, saveDeedAction, deedReviewFilters, updateDeedReviewFilter, deedRegistryReview, applyDeedReviewFilters, isLoadingDeedReview, setDeedReviewFilters, loadDeedRegistryReview, selectedDeedBatch, deedResearchTerms, deedInvestigationOwners, deedInvestigationLots, deedOnFileCount, deedRegisterOnFileCount, deedInvestigationNoteCount, attachEntryToSelectedDeedCase, removedOriginalDeedEntries }: DeedsAdminTabProps) {
  return (
        <>
          <section className="admin-section">
            <div className="section-title">
              <FileSearch size={17} aria-hidden="true" />
              <h3>Deed Evidence</h3>
            </div>

            <section className="deed-case-workbench" aria-label="Deed investigation cases">
              <DeedCaseFilters deedCaseFilters={deedCaseFilters} setDeedCaseFilters={setDeedCaseFilters} isLoadingDeedCases={isLoadingDeedCases} loadDeedCases={loadDeedCases} startNewDeedCase={startNewDeedCase} />

              {deedCases.length ? (
                <DeedCaseList deedCases={deedCases} selectedDeedCaseId={selectedDeedCaseId} selectDeedCase={selectDeedCase} />
              ) : null}

              <DeedCaseEditor selectedDeedCaseId={selectedDeedCaseId} deedCaseForm={deedCaseForm} setDeedCaseForm={setDeedCaseForm} selectedDeedCase={selectedDeedCase} savingDeedCaseKey={savingDeedCaseKey} saveDeedCase={saveDeedCase} />

              <DeedActions selectedDeedCaseId={selectedDeedCaseId} selectedDeedCase={selectedDeedCase} startNewDeedAction={startNewDeedAction} selectedDeedActionId={selectedDeedActionId} selectDeedAction={selectDeedAction} deedActionForm={deedActionForm} setDeedActionForm={setDeedActionForm} savingDeedActionKey={savingDeedActionKey} saveDeedAction={saveDeedAction} />
            </section>

            <DeedReviewFilters deedReviewFilters={deedReviewFilters} updateDeedReviewFilter={updateDeedReviewFilter} deedRegistryReview={deedRegistryReview} applyDeedReviewFilters={applyDeedReviewFilters} isLoadingDeedReview={isLoadingDeedReview} setDeedReviewFilters={setDeedReviewFilters} loadDeedRegistryReview={loadDeedRegistryReview} />

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

            <DeedEvidenceList selectedDeedCaseId={selectedDeedCaseId} savingDeedCaseKey={savingDeedCaseKey} deedReviewFilters={deedReviewFilters} deedRegistryReview={deedRegistryReview} isLoadingDeedReview={isLoadingDeedReview} loadDeedRegistryReview={loadDeedRegistryReview} selectedDeedBatch={selectedDeedBatch} attachEntryToSelectedDeedCase={attachEntryToSelectedDeedCase} />

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
