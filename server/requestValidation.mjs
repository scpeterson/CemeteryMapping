const graveSpaceIdPattern = /^[A-Za-z0-9_-]{1,30}$/u;
const allowedStatuses = new Set(["available", "reserved", "occupied", "sold", "unknown"]);
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
