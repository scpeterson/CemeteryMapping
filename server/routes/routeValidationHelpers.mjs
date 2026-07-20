import { optionalText } from "../inputValidation.mjs";
import { BadRequestError } from "../requestValidation.mjs";

export function optionalDate(value, label) {
  const date = optionalText(value, label, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new BadRequestError(`${label} must use YYYY-MM-DD format.`);
  return date;
}

export function optionalRecordedDate(value, label) {
  const date = optionalText(value, label, 50);
  if (!date) return date;
  const monthName = "(?:Jan\\.?|January|Feb\\.?|February|Mar\\.?|March|Apr\\.?|April|May|Jun\\.?|June|Jul\\.?|July|Aug\\.?|August|Sep\\.?|Sept\\.?|September|Oct\\.?|October|Nov\\.?|November|Dec\\.?|December)";
  const validRecordedDate = new RegExp(
    `^(?:\\d{4}|\\d{4}-\\d{2}|\\d{4}-\\d{2}-\\d{2}|${monthName}\\s+\\d{4},?|${monthName}\\s+\\d{1,2},?\\s+\\d{4})$`,
    "iu",
  );
  if (!validRecordedDate.test(date)) {
    throw new BadRequestError(`${label} must use YYYY, YYYY-MM, YYYY-MM-DD, Month YYYY, or Month DD YYYY format.`);
  }
  return date;
}

export function optionalBoolean(value, label) {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") throw new BadRequestError(`${label} must be true or false.`);
  return value;
}

export function validateDataConfidence(value) {
  const confidence = optionalText(value, "Data confidence", 30) || "unknown";
  if (!["unknown", "low", "medium", "high"].includes(confidence)) throw new BadRequestError("Data confidence is invalid.");
  return confidence;
}

export function validateReviewStatus(value) {
  const status = optionalText(value, "Review status", 30) || "unreviewed";
  if (!["unreviewed", "needs_review", "reviewed", "conflict"].includes(status)) throw new BadRequestError("Review status is invalid.");
  return status;
}
