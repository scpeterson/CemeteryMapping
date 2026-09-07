import { BookOpenText } from "lucide-react";
import type {
  SourcePersonRecordConfidence,
  SourcePersonRecordSourceCode,
  SourcePersonRecordStatus,
  SourcePersonRecordType
} from "../../types";
import {
  defaultSourcePersonFilters,
  sourcePersonConfidenceLabels,
  sourcePersonConfidenceOptions,
  sourcePersonRecordTitle,
  sourcePersonSourceLabels,
  sourcePersonSourceOptions,
  sourcePersonStatusLabels,
  sourcePersonStatusOptions,
  sourcePersonTypeLabels,
  sourcePersonTypeOptions
} from "../admin/adminWorkflowConfig";
import { useSourcePeopleAdministration } from "../admin/useSourcePeopleAdministration";

type Props = Pick<ReturnType<typeof useSourcePeopleAdministration>, "applySourcePersonFilters" | "sourcePersonFilters" | "updateSourcePersonFilter" | "sourcePersonReview" | "isLoadingSourcePersonRecords" | "setSourcePersonFilters" | "loadSourcePersonRecords" | "startNewSourcePersonRecord" | "nextUnresolvedSourcePersonRecord" | "goToNextUnresolvedSourcePersonRecord" | "selectedSourcePersonRecordId" | "focusedSourcePersonRecordId" | "startSourcePersonRecordEdit" | "saveSourcePersonRecord" | "selectedSourcePersonRecord" | "sourcePersonForm" | "updateSourcePersonForm" | "savingSourcePersonKey" | "softDeleteSourcePersonRecord">;

export function SourcePeopleAdminTab({
  applySourcePersonFilters,
  sourcePersonFilters,
  updateSourcePersonFilter,
  sourcePersonReview,
  isLoadingSourcePersonRecords,
  setSourcePersonFilters,
  loadSourcePersonRecords,
  startNewSourcePersonRecord,
  nextUnresolvedSourcePersonRecord,
  goToNextUnresolvedSourcePersonRecord,
  selectedSourcePersonRecordId,
  focusedSourcePersonRecordId,
  startSourcePersonRecordEdit,
  saveSourcePersonRecord,
  selectedSourcePersonRecord,
  sourcePersonForm,
  updateSourcePersonForm,
  savingSourcePersonKey,
  softDeleteSourcePersonRecord
}: Props) {
  return (
    <>
      <section className="admin-section">
        <div className="section-title">
          <BookOpenText size={17} aria-hidden="true" />
          <h3>Source People</h3>
        </div>

        <form className="deed-review-filter-form" onSubmit={applySourcePersonFilters}>
          <label>
            Cemetery
            <select
              value={sourcePersonFilters.cemeteryId ?? ""}
              onChange={(event) => updateSourcePersonFilter({ cemeteryId: event.target.value })}
              title="Filter source-only people by cemetery."
            >
              <option value="">All available cemeteries</option>
              {sourcePersonReview.cemeteries.map((cemetery) => (
                <option key={cemetery.id} value={cemetery.id}>
                  {cemetery.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select
              value={sourcePersonFilters.sourceCode ?? ""}
              onChange={(event) => updateSourcePersonFilter({ sourceCode: event.target.value })}
              title="Filter by source code."
            >
              <option value="">All sources</option>
              {sourcePersonSourceOptions.map((sourceCode) => (
                <option key={sourceCode} value={sourceCode}>
                  {sourcePersonSourceLabels[sourceCode]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={sourcePersonFilters.status ?? ""}
              onChange={(event) => updateSourcePersonFilter({ status: event.target.value })}
              title="Filter by review/link status."
            >
              <option value="">All statuses</option>
              {sourcePersonStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {sourcePersonStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Search
            <input
              value={sourcePersonFilters.q ?? ""}
              onChange={(event) => updateSourcePersonFilter({ q: event.target.value })}
              placeholder="Name, page, source text, or notes"
              title="Search names, source page numbers, raw source text, source location text, and notes."
            />
          </label>
          <label>
            Limit
            <select
              value={sourcePersonFilters.limit ?? 50}
              onChange={(event) => updateSourcePersonFilter({ limit: Number(event.target.value) })}
              title="Limit the number of source-only person records returned."
            >
              <option value={25}>25 records</option>
              <option value={50}>50 records</option>
              <option value={100}>100 records</option>
              <option value={250}>250 records</option>
            </select>
          </label>
          <div className="admin-form-actions deed-review-filter-actions">
            <button type="submit" disabled={isLoadingSourcePersonRecords}>
              {isLoadingSourcePersonRecords ? "Loading..." : "Apply filters"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setSourcePersonFilters(defaultSourcePersonFilters);
                void loadSourcePersonRecords(defaultSourcePersonFilters);
              }}
            >
              Clear
            </button>
            <button type="button" className="secondary-button" onClick={startNewSourcePersonRecord}>
              New record
            </button>
          </div>
        </form>

        {isLoadingSourcePersonRecords ? <div className="admin-message" role="status">Loading source-only people...</div> : null}

        <div className="review-workbench-toolbar" aria-label="Source-only person review queue">
          <div>
            <strong>Review queue</strong>
            <span>{nextUnresolvedSourcePersonRecord ? "Jump to the next unmatched or candidate record in this filtered list." : "No unresolved source-only people are visible."}</span>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={goToNextUnresolvedSourcePersonRecord}
            disabled={!nextUnresolvedSourcePersonRecord || isLoadingSourcePersonRecords}
            title="Open the next visible source-only person that still needs matching or review."
          >
            Next unresolved
          </button>
        </div>

        <div className="source-person-workspace">
          <div className="source-person-list" role="table" aria-label="Source-only person records">
            {sourcePersonReview.records.length === 0 && !isLoadingSourcePersonRecords ? <p className="record-editor-empty">No source-only person records match these filters.</p> : null}
            {sourcePersonReview.records.map((record) => (
              <article
                id={`source-person-record-${record.id}`}
                key={record.id}
                className={`source-person-row confidence-${record.confidence} ${selectedSourcePersonRecordId === record.id ? "is-selected" : ""} ${focusedSourcePersonRecordId === record.id ? "is-review-target" : ""
                  }`}
                title={sourcePersonRecordTitle(record)}
              >
                <header>
                  <div className="source-person-heading">
                    <strong>{record.fullName}</strong>
                    <small>{record.cemeteryName || "No cemetery"}</small>
                  </div>
                  <button type="button" className="deed-entry-link-button" onClick={() => startSourcePersonRecordEdit(record)}>
                    Edit
                  </button>
                </header>
                <dl className="source-person-meta">
                  <div>
                    <dt>Source</dt>
                    <dd>{sourcePersonSourceLabels[record.sourceCode] ?? record.sourceCode}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{sourcePersonTypeLabels[record.recordType] ?? record.recordType}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{sourcePersonStatusLabels[record.status] ?? record.status}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{sourcePersonConfidenceLabels[record.confidence] ?? record.confidence}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{record.sourcePageNumber ? `Page ${record.sourcePageNumber}` : record.sourceLocationText || "No page"}</dd>
                  </div>
                </dl>
                <p className="deed-entry-remarks">{record.rawText}</p>
                {record.links.length ? (
                  <ul className="deed-entry-notes" aria-label="Linked cemetery records">
                    {record.links.map((link) => (
                      <li key={link.id}>
                        {link.linkType}: {link.targetLabel || link.targetId}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>

          <form className="reading-entry-edit-form source-person-editor" onSubmit={saveSourcePersonRecord}>
            <div className="section-title">
              <BookOpenText size={16} aria-hidden="true" />
              <h4>{selectedSourcePersonRecord ? `Edit ${selectedSourcePersonRecord.fullName}` : "New source-only person"}</h4>
            </div>
            <div className="reading-edit-grid source-person-edit-grid">
              <label>
                Cemetery
                <select value={sourcePersonForm.cemeteryId} onChange={(event) => updateSourcePersonForm({ cemeteryId: event.target.value })} required>
                  <option value="">Select cemetery</option>
                  {sourcePersonReview.cemeteries.map((cemetery) => (
                    <option key={cemetery.id} value={cemetery.id}>
                      {cemetery.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Source
                <select value={sourcePersonForm.sourceCode} onChange={(event) => updateSourcePersonForm({ sourceCode: event.target.value as SourcePersonRecordSourceCode })}>
                  {sourcePersonSourceOptions.map((sourceCode) => (
                    <option key={sourceCode} value={sourceCode}>
                      {sourcePersonSourceLabels[sourceCode]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Record type
                <select value={sourcePersonForm.recordType} onChange={(event) => updateSourcePersonForm({ recordType: event.target.value as SourcePersonRecordType })}>
                  {sourcePersonTypeOptions.map((recordType) => (
                    <option key={recordType} value={recordType}>
                      {sourcePersonTypeLabels[recordType]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select value={sourcePersonForm.status} onChange={(event) => updateSourcePersonForm({ status: event.target.value as SourcePersonRecordStatus })}>
                  {sourcePersonStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {sourcePersonStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Confidence
                <select value={sourcePersonForm.confidence} onChange={(event) => updateSourcePersonForm({ confidence: event.target.value as SourcePersonRecordConfidence })}>
                  {sourcePersonConfidenceOptions.map((confidence) => (
                    <option key={confidence} value={confidence}>
                      {sourcePersonConfidenceLabels[confidence]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Page
                <input
                  type="number"
                  min="1"
                  value={sourcePersonForm.sourcePageNumber ?? ""}
                  onChange={(event) => updateSourcePersonForm({ sourcePageNumber: event.target.value ? Number(event.target.value) : null })}
                />
              </label>
              <label>
                First name
                <input value={sourcePersonForm.firstName} onChange={(event) => updateSourcePersonForm({ firstName: event.target.value })} />
              </label>
              <label>
                Middle name
                <input value={sourcePersonForm.middleName} onChange={(event) => updateSourcePersonForm({ middleName: event.target.value })} />
              </label>
              <label>
                Last name
                <input value={sourcePersonForm.lastName} onChange={(event) => updateSourcePersonForm({ lastName: event.target.value })} />
              </label>
              <label>
                Maiden name
                <input value={sourcePersonForm.maidenName} onChange={(event) => updateSourcePersonForm({ maidenName: event.target.value })} />
              </label>
              <label className="wide-field">
                Full name
                <input value={sourcePersonForm.fullName} onChange={(event) => updateSourcePersonForm({ fullName: event.target.value })} required />
              </label>
              <label>
                Birth date
                <input type="date" value={sourcePersonForm.birthDate ?? ""} onChange={(event) => updateSourcePersonForm({ birthDate: event.target.value })} />
              </label>
              <label>
                Birth text
                <input value={sourcePersonForm.birthDateText} onChange={(event) => updateSourcePersonForm({ birthDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
              </label>
              <label>
                Death date
                <input type="date" value={sourcePersonForm.deathDate ?? ""} onChange={(event) => updateSourcePersonForm({ deathDate: event.target.value })} />
              </label>
              <label>
                Death text
                <input value={sourcePersonForm.deathDateText} onChange={(event) => updateSourcePersonForm({ deathDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
              </label>
              <label>
                Burial date
                <input type="date" value={sourcePersonForm.burialDate ?? ""} onChange={(event) => updateSourcePersonForm({ burialDate: event.target.value })} />
              </label>
              <label>
                Burial text
                <input value={sourcePersonForm.burialDateText} onChange={(event) => updateSourcePersonForm({ burialDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
              </label>
              <label>
                Funeral date
                <input type="date" value={sourcePersonForm.funeralDate ?? ""} onChange={(event) => updateSourcePersonForm({ funeralDate: event.target.value })} />
              </label>
              <label>
                Funeral text
                <input value={sourcePersonForm.funeralDateText} onChange={(event) => updateSourcePersonForm({ funeralDateText: event.target.value })} placeholder="1876 or Sept. 1876" />
              </label>
              <label>
                Age text
                <input value={sourcePersonForm.ageText} onChange={(event) => updateSourcePersonForm({ ageText: event.target.value })} />
              </label>
              <label>
                Source label
                <input value={sourcePersonForm.sourceLabel} onChange={(event) => updateSourcePersonForm({ sourceLabel: event.target.value })} />
              </label>
              <label className="wide-field">
                Source location
                <input value={sourcePersonForm.sourceLocationText} onChange={(event) => updateSourcePersonForm({ sourceLocationText: event.target.value })} />
              </label>
              <label className="wide-field">
                Source name
                <input value={sourcePersonForm.sourceName} onChange={(event) => updateSourcePersonForm({ sourceName: event.target.value })} required />
              </label>
              <label className="wide-field">
                Raw source text
                <textarea value={sourcePersonForm.rawText} onChange={(event) => updateSourcePersonForm({ rawText: event.target.value })} rows={4} required />
              </label>
              <label className="wide-field">
                Notes
                <textarea value={sourcePersonForm.notes} onChange={(event) => updateSourcePersonForm({ notes: event.target.value })} rows={3} />
              </label>
              <label className="wide-field">
                Change reason
                <input value={sourcePersonForm.reason} onChange={(event) => updateSourcePersonForm({ reason: event.target.value })} required />
              </label>
            </div>
            <div className="admin-form-actions source-person-editor-actions">
              <button type="submit" disabled={Boolean(savingSourcePersonKey) || !sourcePersonForm.cemeteryId || !sourcePersonForm.fullName.trim() || !sourcePersonForm.rawText.trim()}>
                {savingSourcePersonKey === (selectedSourcePersonRecordId || "new") ? "Saving..." : "Save record"}
              </button>
              <button type="button" className="secondary-button" onClick={startNewSourcePersonRecord}>
                Clear form
              </button>
              {selectedSourcePersonRecord ? (
                <button
                  type="button"
                  className="danger-button"
                  disabled={Boolean(savingSourcePersonKey)}
                  onClick={() => void softDeleteSourcePersonRecord(selectedSourcePersonRecord)}
                >
                  {savingSourcePersonKey === `delete:${selectedSourcePersonRecord.id}` ? "Deleting..." : "Soft delete"}
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </section>
    </>
  );
}
