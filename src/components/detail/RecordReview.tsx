import { dataConfidenceOptions, reviewStatusOptions } from "./reviewOptions";
function dataConfidenceLabel(value?: string) {
  return dataConfidenceOptions.find((option) => option.value === value)?.label ?? "Unknown";
}

function reviewStatusLabel(value?: string) {
  return reviewStatusOptions.find((option) => option.value === value)?.label ?? "Unreviewed";
}

export function ReviewBadgeGroup({
  dataConfidence,
  reviewStatus,
  sourceConflict,
  reviewNotes,
}: {
  dataConfidence?: string;
  reviewStatus?: string;
  sourceConflict?: boolean;
  reviewNotes?: string;
}) {
  const shouldShow = dataConfidence === "low" || dataConfidence === "medium" || reviewStatus === "needs_review" || reviewStatus === "conflict" || sourceConflict || Boolean(reviewNotes);
  if (!shouldShow) return null;

  return (
    <div className="record-review-badges" aria-label="Data review status">
      {dataConfidence && dataConfidence !== "unknown" ? <span className={`record-review-badge confidence-${dataConfidence}`}>{dataConfidenceLabel(dataConfidence)} confidence</span> : null}
      {reviewStatus && reviewStatus !== "unreviewed" ? <span className={`record-review-badge review-${reviewStatus}`}>{reviewStatusLabel(reviewStatus)}</span> : null}
      {sourceConflict ? <span className="record-review-badge review-conflict">Source conflict</span> : null}
      {reviewNotes ? <p>{reviewNotes}</p> : null}
    </div>
  );
}
