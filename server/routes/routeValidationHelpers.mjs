import { optionalText } from "../inputValidation.mjs";
import { BadRequestError } from "../requestValidation.mjs";

const calendarMonths = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Check components directly: JavaScript Date silently rolls November 31 into December.
function validateCalendarDate(date, label) {
  let year, month, day;
  if (/^\d{4}(?:-\d{2}){0,2}$/u.test(date)) {
    [year, month = 1, day = 1] = date.split("-").map(Number);
  } else {
    const parts = date.replace(/[.,]/gu, "").split(/\s+/u);
    month = calendarMonths.indexOf(parts[0].slice(0, 3).toLowerCase()) + 1;
    year = Number(parts.at(-1));
    day = parts.length === 3 ? Number(parts[1]) : 1;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throw new BadRequestError(`${label} "${date}" is not a valid calendar date. Check the year, month, and day.`);
  }
}

export function optionalDate(value, label) {
  const date = optionalText(value, label, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new BadRequestError(`${label} must use YYYY-MM-DD format.`);
  if (date) validateCalendarDate(date, label);
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
  validateCalendarDate(date, label);
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
