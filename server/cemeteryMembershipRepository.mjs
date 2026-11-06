import { BadRequestError, ConflictError } from "./requestValidation.mjs";
import { withAuditContext } from "./auditContext.mjs";
import { assignedEditableCemeteryIds, cemeteryRole } from "./auth.mjs";
import { optionalText, requiredText } from "./inputValidation.mjs";

export function canManageCemeteryMembers(user, cemeteryId) {
  return user?.role === "admin" || (assignedEditableCemeteryIds(user).includes(cemeteryId) && cemeteryRole(user, cemeteryId) === "cemetery-admin");
}

export function validateMembership(body, { invite = false } = {}) {
  const keys = invite ? ["email", "displayName", "role", "reason"] : ["role", "expectedVersion", "reason"];
  if (!body || Object.keys(body).some(key => !keys.includes(key))) throw new BadRequestError("Only cemetery membership fields may be changed here.");
  if (!["reader", "power-user", "cemetery-admin"].includes(body.role)) throw new BadRequestError("Choose a cemetery role.");
  const reason = requiredText(body.reason, "Reason", 500);
  if (!invite) {
    const expectedVersion = requiredText(body.expectedVersion, "Membership version", 20);
    if (!/^\d+$/u.test(expectedVersion)) throw new BadRequestError("Reload the membership before saving.");
    return { role: body.role, expectedVersion, reason };
  }
  const email = requiredText(body.email, "Email", 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new BadRequestError("Enter a valid email address.");
  return { email, displayName: optionalText(body.displayName, "Display name", 250) ?? "", role: body.role, reason };
}

export async function membershipAccount(pool, email) {
  const { rows } = await pool.query("SELECT id::text,external_subject,email,role_name,is_active FROM app_users WHERE lower(email)=lower($1)", [email]);
  if (rows.length > 1) throw new BadRequestError("This account needs system administrator review.");
  const account = rows[0];
  if (account && (!account.is_active || account.role_name === "admin")) throw new BadRequestError("A system administrator must manage this account.");
  return account;
}

export async function listCemeteryMembers(pool, cemeteryId, { query = "", limit = 51, offset = 0 } = {}) {
  const pattern = `%${query.replace(/[\\%_]/gu, "\\$&")}%`;
  const { rows } = await pool.query(`SELECT a.app_user_id::text AS id,u.email,coalesce(u.display_name,'') AS "displayName",
    a.role_name AS role,u.is_active AS "isActive",a.xmin::text AS version
    FROM app_user_cemetery_access a JOIN app_users u ON u.id=a.app_user_id
    JOIN cemeteries c ON c.id=a.cemetery_id AND c.deleted_at IS NULL
    WHERE a.cemetery_id=$1 AND u.role_name<>'admin' AND concat_ws(' ',u.email,u.display_name) ILIKE $2
    ORDER BY lower(u.email),u.id LIMIT $3 OFFSET $4`, [cemeteryId, pattern, limit, offset]);
  return rows;
}

// All scoped membership mutations lock the cemetery first, serializing last-admin
// decisions. Email locks also serialize a new person's concurrent invitations.
export async function saveCemeteryMember(pool, cemeteryId, input, actorUser, { userId, remove = false, resolvedSubject } = {}) {
  if (!canManageCemeteryMembers(actorUser, cemeteryId)) return { forbidden: true };
  return withAuditContext(pool, { actorUser, reason: input.reason }, async (client, rollback) => {
    const cemetery = await client.query("SELECT id FROM cemeteries WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [cemeteryId]);
    if (!cemetery.rows.length) return rollback(undefined);
    if (!userId) {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.email]);
      let account = await membershipAccount(client, input.email);
      if (!account) {
        if (!resolvedSubject) throw new BadRequestError("Resolve the invited account before saving.");
        await client.query(`INSERT INTO app_users(external_subject,email,display_name,role_name,is_active)
          VALUES($1,$2,$3,'reader',true) ON CONFLICT DO NOTHING`, [resolvedSubject, input.email, input.displayName || null]);
        account = await membershipAccount(client, input.email);
      }
      if (!account || (resolvedSubject && account.external_subject !== resolvedSubject)) throw new BadRequestError("This account needs system administrator review.");
      userId = account.id;
    }
    // Lock the account before taking the membership snapshot: the system Users
    // workflow uses the same account lock when replacing assignments.
    await client.query("SELECT id FROM app_users WHERE id=$1 FOR UPDATE",[userId]);
    const { rows } = await client.query(`SELECT a.role_name,a.xmin::text AS version,u.role_name AS system_role,u.is_active,u.email
      FROM app_users u LEFT JOIN app_user_cemetery_access a ON a.app_user_id=u.id AND a.cemetery_id=$1
      WHERE u.id=$2`, [cemeteryId,userId]);
    const current = rows[0];
    if (!current || (!current.role_name && input.expectedVersion)) return rollback(undefined);
    if (!current.is_active || current.system_role === "admin") throw new BadRequestError("A system administrator must manage this account.");
    if (input.email && current.email.toLowerCase() !== input.email) throw new ConflictError("This account changed. Reload members before adding it.");
    if (input.expectedVersion && current.version !== input.expectedVersion) throw new ConflictError("This membership changed. Reload members and reopen the member before saving.");
    // Inviting an existing member never silently changes their current role.
    if (!input.expectedVersion && current.role_name && current.role_name !== input.role) throw new ConflictError("This person is already a member. Edit their existing membership.");
    if (current.role_name === "cemetery-admin" && (remove || input.role !== "cemetery-admin") && actorUser.role !== "admin") {
      const count = await client.query(`SELECT count(*)::int AS n FROM app_user_cemetery_access a JOIN app_users u ON u.id=a.app_user_id
        WHERE a.cemetery_id=$1 AND a.role_name='cemetery-admin' AND u.is_active AND u.role_name<>'admin'`, [cemeteryId]);
      if (count.rows[0].n <= 1) throw new BadRequestError("Assign another active cemetery administrator before removing the last one.");
    }
    if (remove) {
      await client.query("DELETE FROM app_user_cemetery_access WHERE cemetery_id=$1 AND app_user_id=$2", [cemeteryId,userId]);
      await client.query("UPDATE app_users SET preferred_cemetery_id=NULL WHERE id=$1 AND preferred_cemetery_id=$2", [userId,cemeteryId]);
      return { removed: true };
    }
    await client.query(`INSERT INTO app_user_cemetery_access(app_user_id,cemetery_id,role_name,can_edit) VALUES($1,$2,$3,$4)
      ON CONFLICT(app_user_id,cemetery_id) DO UPDATE SET role_name=EXCLUDED.role_name,can_edit=EXCLUDED.can_edit
      WHERE (app_user_cemetery_access.role_name,app_user_cemetery_access.can_edit) IS DISTINCT FROM (EXCLUDED.role_name,EXCLUDED.can_edit)`,
    [userId,cemeteryId,input.role,input.role!=="reader"]);
    return { saved: true };
  });
}
