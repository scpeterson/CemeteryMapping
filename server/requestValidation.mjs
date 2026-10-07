const graveSpaceIdPattern = /^[A-Za-z0-9_-]{1,30}$/u;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const allowedStatuses = new Set(["available", "reserved", "occupied", "sold", "needs_review", "unknown"]);
const maxSearchLength = 120;
const maxReasonLength = 500;

export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequestError";
    this.statusCode = 400;
  }
}

export function validateGraveSpaceId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!graveSpaceIdPattern.test(id)) {
    throw new BadRequestError("Grave space id must be 1-30 characters and contain only letters, numbers, underscores, or hyphens.");
  }

  return id;
}

export function validateCemeteryId(value) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!uuidPattern.test(id)) {
    throw new BadRequestError("Cemetery id must be a valid UUID.");
  }

  return id;
}

export function validateSearchQuery(value) {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new BadRequestError("Search query must be a string.");

  const query = value.trim();
  if (query.length > maxSearchLength) throw new BadRequestError(`Search query must be ${maxSearchLength} characters or fewer.`);

  return query;
}

export function validateStatuses(value) {
  if (value === undefined) return [];
  if (typeof value !== "string") throw new BadRequestError("Status filter must be a comma-separated string.");

  const statuses = value
    .split(",")
    .map((status) => status.trim().toLowerCase())
    .filter(Boolean);

  const invalidStatus = statuses.find((status) => !allowedStatuses.has(status));
  if (invalidStatus) throw new BadRequestError(`Unsupported grave status: ${invalidStatus}.`);

  return statuses;
}

export function validateMutationReason(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new BadRequestError("Reason must be a string.");

  const reason = value.trim();
  if (reason.length > maxReasonLength) throw new BadRequestError(`Reason must be ${maxReasonLength} characters or fewer.`);

  return reason || undefined;
}

export class ConflictError extends Error {
  constructor(message = "This record changed since you opened it. Reload the latest values before saving.") {
    super(message);
    this.name = "ConflictError";
  }
}

export function validateSearchPage({ limit, offset, cemeteryId } = {}) {
  const integer = (value, fallback, maximum, label) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
      throw new BadRequestError(`${label} must be an integer between 0 and ${maximum}.`);
    }
    return Number(value);
  };
  const pageLimit = integer(limit, 50, 100, "Search limit");
  if (!pageLimit) throw new BadRequestError("Search limit must be at least 1.");
  return { limit: pageLimit, offset: integer(offset, 0, 100000, "Search offset"), cemeteryId: cemeteryId === undefined ? undefined : validateCemeteryId(cemeteryId) };
}
