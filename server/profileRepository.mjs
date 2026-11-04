import { withAuditContext } from "./auditContext.mjs";
import { optionalText, validateUuid } from "./inputValidation.mjs";
import { BadRequestError } from "./requestValidation.mjs";

export function validateProfile(body) {
  return {
    displayName: optionalText(body?.displayName, "Display name", 250) ?? "",
    phone: optionalText(body?.phone, "Phone", 50) ?? "",
    organization: optionalText(body?.organization, "Organization", 250) ?? "",
    preferredCemeteryId: body?.preferredCemeteryId ? validateUuid(body.preferredCemeteryId, "Preferred cemetery") : null,
  };
}

export async function getProfile(pool, user) {
  if (!user.id) return null;
  const { rows } = await pool.query(`SELECT id::text, email, COALESCE(display_name, '') AS "displayName", COALESCE(phone, '') AS phone, COALESCE(organization, '') AS organization,
    COALESCE(preferred_cemetery_id::text, '') AS "preferredCemeteryId", created_at AS "createdAt"
    FROM app_users WHERE id = $1`, [user.id]);
  return rows[0] ?? null;
}

export async function updateProfile(pool, user, profile) {
  if (!user.id) throw new BadRequestError("A registered account is required to edit a profile.");
  return withAuditContext(pool, { actorUser: user, reason: "Updated own profile" }, async client => {
    if (profile.preferredCemeteryId) {
      const result = await client.query(`SELECT id FROM cemeteries WHERE id = $1 AND deleted_at IS NULL
        AND ($2::boolean OR EXISTS (SELECT 1 FROM app_user_cemetery_access WHERE app_user_id = $3 AND cemetery_id = $1))`,
        [profile.preferredCemeteryId, user.role === "admin", user.id]);
      if (!result.rows.length) throw new BadRequestError("Choose one of your assigned cemeteries.");
    }
    await client.query(`UPDATE app_users SET display_name=$2, phone=$3, organization=$4, preferred_cemetery_id=$5 WHERE id=$1`,
      [user.id, profile.displayName, profile.phone, profile.organization, profile.preferredCemeteryId]);
    return getProfile(client, user);
  });
}

export async function listUserActivity(pool, id) {
  const { rows } = await pool.query(`SELECT id::text, target_table AS "tableName", action AS operation,
    occurred_at AS "changedAt", reason FROM audit_events WHERE actor_app_user_id=$1
    ORDER BY occurred_at DESC, id DESC LIMIT 50`, [id]);
  return rows;
}
