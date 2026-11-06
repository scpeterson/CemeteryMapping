import { BadRequestError, ConflictError } from "./requestValidation.mjs";

export function validateExpectedVersion(value) {
  if (typeof value !== "string" || !/^[0-9a-f:.-]{1,160}$/iu.test(value)) {
    throw new BadRequestError("Reload the latest record before editing. A valid record version is required.");
  }
  return value;
}

// Public edit routes require a token. Trusted import/fixture callers can omit it
// inside their own transaction; a supplied token is always checked.
export function assertRecordVersion(current, expected) {
  if (expected !== undefined && String(current) !== expected) throw new ConflictError();
}

// Account edits replace memberships too. An account-row token alone would miss
// delegated membership edits, so include every membership's MVCC identity.
export const accountVersionSql = `(SELECT concat(v.xmin::text,':',md5(coalesce(string_agg(a.id::text||':'||a.xmin::text,',' ORDER BY a.id),'')))
  FROM app_users v LEFT JOIN app_user_cemetery_access a ON a.app_user_id=v.id
  WHERE v.id=app_users.id GROUP BY v.id,v.xmin)`;
