import { formatAdminTimestamp } from "../../../lib/format";
import { DeedRegistryMappingEditor } from "./DeedRegistryMappingEditor";
import { deedComparisonLabel,deedConfidenceLabel,deedEntryTitle,DeedsAdminTabProps,deedScopeLabel,formatList } from "./shared";

export function DeedEvidenceList({ selectedDeedCaseId, savingDeedCaseKey, deedReviewFilters, deedRegistryReview, isLoadingDeedReview, loadDeedRegistryReview, selectedDeedBatch, attachEntryToSelectedDeedCase }: Pick<DeedsAdminTabProps, "selectedDeedCaseId" | "savingDeedCaseKey" | "deedReviewFilters" | "deedRegistryReview" | "isLoadingDeedReview" | "loadDeedRegistryReview" | "selectedDeedBatch" | "attachEntryToSelectedDeedCase">) {
  return (<div className="deed-entry-list" role="table" aria-label="Staged deed registry evidence">
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
            </div>);
}
