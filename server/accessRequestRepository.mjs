import { withAuditContext } from "./auditContext.mjs";
import { BadRequestError, ConflictError } from "./requestValidation.mjs";
import { accessRequestLimits } from "./accessRequestProtection.mjs";
import { requiredText } from "./inputValidation.mjs";

export function validateAccessRequest(body) {
  for (const key of ["email", "displayName", "cemeteryInterest", "reason"]) {
    if (typeof body?.[key] !== "string") throw new BadRequestError("Enter text in all required fields.");
  }
  const email = requiredText(body?.email, "Email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new BadRequestError("Enter a valid email address.");
  return {
    email,
    displayName: requiredText(body?.displayName, "Name", 250),
    cemeteryInterest: requiredText(body?.cemeteryInterest, "Cemetery of interest", 250),
    reason: requiredText(body?.reason, "Reason for access", 2000),
  };
}

export async function submitAccessRequest(pool, input) {
  // Never expose whether an account or earlier request exists, and never overwrite
  // a pending request with unauthenticated content from someone else.
  await pool.query(`INSERT INTO access_requests (email, display_name, cemetery_interest, reason)
    SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM app_users WHERE lower(email)=$1)
    ON CONFLICT (email) DO NOTHING`, [input.email, input.displayName, input.cemeteryInterest, input.reason]);
}

// Serialize the capacity check and insert across every API instance. Use a try-lock
// so a submission flood cannot fill the pool with transactions waiting for a lock.
export async function submitBoundedAccessRequest(pool, input, limits = accessRequestLimits) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: [lock] } = await client.query("SELECT pg_try_advisory_xact_lock(416, 1) AS acquired");
    if (!lock.acquired) { await client.query("ROLLBACK"); return false; }
    const stats = await accessRequestStats(client);
    if (stats.pending >= limits.pending || stats.lastHour >= limits.hourly) {
      await client.query("ROLLBACK"); return false;
    }
    await submitAccessRequest(client, input);
    await client.query("COMMIT");
    return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

export async function accessRequestStats(pool) {
  const { rows: [row] } = await pool.query(`SELECT
    (SELECT count(*)::int FROM access_requests WHERE status='pending') AS pending,
    (SELECT count(*)::int FROM access_requests WHERE created_at > now() - interval '1 hour') AS "lastHour"`);
  return { ...row, limits: accessRequestLimits };
}

export async function listAccessRequests(pool) {
  const { rows } = await pool.query(`SELECT id, email, display_name AS "displayName",
    cemetery_interest AS "cemeteryInterest", reason, status, created_at AS "createdAt"
    FROM access_requests WHERE status='pending' ORDER BY created_at LIMIT 200`);
  return rows;
}

export async function rejectAccessRequest(pool, id, actorUser) {
  return withAuditContext(pool, { actorUser }, async (client) => {
    const result = await client.query(`UPDATE access_requests SET status='rejected', reviewed_at=now(), reviewed_by=$2
      WHERE id=$1 AND status='pending' RETURNING id`, [id, actorUser.id ?? null]);
    if (!result.rows[0]) throw new ConflictError("This request has already been reviewed or no longer exists. Refresh the request list.");
  });
}

// Called within the user-save transaction, before changing any user permissions.
export async function lockAccessRequest(client, user) {
  if (!user.accessRequestId) return;
  const { rows } = await client.query("SELECT email,status FROM access_requests WHERE id=$1 FOR UPDATE", [user.accessRequestId]);
  if (!rows[0] || rows[0].status !== "pending") throw new ConflictError("This request has already been reviewed. Refresh the request list.");
  if (rows[0].email !== user.email.trim().toLowerCase() || !user.isActive) {
    throw new BadRequestError("Approve the request using its original email and an active user account.");
  }
}

export async function finishAccessRequest(client, user, userId) {
  if (!user.accessRequestId) return;
  await client.query(`UPDATE access_requests SET status='approved', reviewed_at=now(), reviewed_by=$2,
    approved_user_id=$3 WHERE id=$1`, [user.accessRequestId, user.actorUser?.id ?? null, userId]);
}
