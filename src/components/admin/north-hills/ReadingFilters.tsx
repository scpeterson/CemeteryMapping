import { formatAdminTimestamp } from "../../../lib/format";
import type {
NorthHillsOcrReviewFilters
} from "../../../types";
import {
confidenceLabels,
defaultNorthHillsReviewFilters
} from "../../admin/adminWorkflowConfig";
import { Props } from "./shared";

export function ReadingFilters({ applyNorthHillsReviewFilters, northHillsReviewFilters, updateNorthHillsReviewFilter, northHillsOcrReview, isLoadingNorthHillsReview, setNorthHillsReviewFilters, loadNorthHillsOcrReview }: Pick<Props, "applyNorthHillsReviewFilters" | "northHillsReviewFilters" | "updateNorthHillsReviewFilter" | "northHillsOcrReview" | "isLoadingNorthHillsReview" | "setNorthHillsReviewFilters" | "loadNorthHillsOcrReview">) {
  return (<form className="deed-review-filter-form" onSubmit={applyNorthHillsReviewFilters}>
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
        </form>);
}
