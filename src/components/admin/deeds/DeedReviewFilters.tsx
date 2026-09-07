import { formatAdminTimestamp } from "../../../lib/format";
import {
defaultDeedReviewFilters
} from "../../AdminPanelDeedConfig";
import { confidenceLabels,DeedsAdminTabProps,scopeLabels } from "./shared";

export function DeedReviewFilters({ deedReviewFilters, updateDeedReviewFilter, deedRegistryReview, applyDeedReviewFilters, isLoadingDeedReview, setDeedReviewFilters, loadDeedRegistryReview }: Pick<DeedsAdminTabProps, "deedReviewFilters" | "updateDeedReviewFilter" | "deedRegistryReview" | "applyDeedReviewFilters" | "isLoadingDeedReview" | "setDeedReviewFilters" | "loadDeedRegistryReview">) {
  return (<form className="deed-review-filter-form" onSubmit={applyDeedReviewFilters}>
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
            </form>);
}
