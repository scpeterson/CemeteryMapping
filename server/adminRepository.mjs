import { BadRequestError, validateCemeteryId } from "./requestValidation.mjs";
import { accountVersionSql, assertRecordVersion } from "./recordVersions.mjs";
import { lockAccessRequest, finishAccessRequest } from "./accessRequestRepository.mjs";
import { withAuditContext } from "./auditContext.mjs";

const systemRoles = [
  {
    name: "reader",
    description: "Can view the map, gravesites, and burial information, but cannot view deed/owner information.",
  },
  {
    name: "power-user",
    description: "Can view cemetery records, view and edit deed/owner information for assigned cemeteries, and has read-only access to other cemeteries.",
  },
  {
    name: "cemetery-admin",
    description: "Can administer assigned cemeteries and has read-only access to other cemeteries.",
  },
  {
    name: "admin",
    description: "Can manage users and roles, view and edit all cemetery records, add structural records, and soft-delete records across the whole system.",
  },
];

function toRole(row) {
  return {
    name: row.role_name,
    description: row.description,
    userCount: Number(row.user_count ?? 0),
  };
}

function toUser(row) {
  return {
    id: row.id,
    ...(row.version ? { version: row.version } : {}),
    externalSubject: row.external_subject,
    email: row.email,
    displayName: row.display_name ?? "",
    role: row.role_name,
    assignedCemeteryIds: row.assigned_cemetery_ids ?? [],
    cemeteryMemberships: row.cemetery_memberships ?? [],
    phone: row.phone ?? "",
    organization: row.organization ?? "",
    preferredCemeteryId: row.preferred_cemetery_id ?? "",
    lastActiveAt: row.last_active_at?.toISOString?.() ?? row.last_active_at ?? undefined,
    isActive: row.is_active,
    lastAuthenticatedAt: row.last_authenticated_at?.toISOString?.() ?? row.last_authenticated_at ?? undefined,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export async function ensureSystemRoles(pool) {
  await pool.query(`
    INSERT INTO app_roles (role_name, description)
    SELECT desired.role_name, desired.description FROM (VALUES
      ('reader', 'Can view the map, gravesites, and burial information, but cannot view deed/owner information.'),
      ('power-user', 'Can view cemetery records, view and edit deed/owner information for assigned cemeteries, and has read-only access to other cemeteries.'),
      ('cemetery-admin', 'Can administer assigned cemeteries and has read-only access to other cemeteries.'),
      ('admin', 'Can manage users and roles, view and edit all cemetery records, add structural records, and soft-delete records across the whole system.')
    ) desired(role_name,description)
    WHERE NOT EXISTS (SELECT 1 FROM app_roles r WHERE r.role_name=desired.role_name AND r.description IS NOT DISTINCT FROM desired.description)
    ON CONFLICT (role_name) DO UPDATE
    SET description = EXCLUDED.description
    WHERE app_roles.description IS DISTINCT FROM EXCLUDED.description
  `);
}

export async function listRoles(pool) {
  await ensureSystemRoles(pool);
  const result = await pool.query(`
    SELECT
      app_roles.role_name,
      app_roles.description,
      count(DISTINCT role_users.app_user_id)::int AS user_count
    FROM app_roles
    LEFT JOIN (
      SELECT id AS app_user_id, role_name FROM app_users WHERE role_name = 'admin'
      UNION
      SELECT a.app_user_id, a.role_name FROM app_user_cemetery_access a
      JOIN app_users u ON u.id = a.app_user_id WHERE u.role_name <> 'admin'
    ) role_users ON role_users.role_name = app_roles.role_name
    GROUP BY app_roles.role_name, app_roles.description
    ORDER BY
      CASE app_roles.role_name
        WHEN 'reader' THEN 1
        WHEN 'power-user' THEN 2
        WHEN 'cemetery-admin' THEN 3
        WHEN 'admin' THEN 4
        ELSE 5
      END,
      app_roles.role_name
  `);
  const rolesByName = new Map(result.rows.map((row) => [row.role_name, toRole(row)]));
  return systemRoles.map((role) => rolesByName.get(role.name) ?? { ...role, userCount: 0 });
}

export async function listUsers(pool, { q = "", status = "all", cemeteryId, email, limit = 101, offset = 0 } = {}) {
  if (typeof q !== "string" || q.length > 250) throw new BadRequestError("User search must be at most 250 characters.");
  if (!["all", "active", "inactive"].includes(status)) throw new BadRequestError("Unsupported user status.");
  const pageInteger = (value, max, name) => {
    if (!/^\d+$/u.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > max)
      throw new BadRequestError(`Invalid user ${name}.`);
    return Number(value);
  };
  limit = pageInteger(limit, 501, "limit");
  if (!limit) throw new BadRequestError("User limit must be positive.");
  offset = pageInteger(offset, 1000000, "offset");
  if (email !== undefined && (typeof email !== "string" || email.length > 320)) throw new BadRequestError("Invalid user email filter.");
  const pattern = `%${q.toLowerCase().replace(/[\\%_]/gu, "\\$&")}%`;
  const result = await pool.query(`
    WITH selected_users AS MATERIALIZED (
      SELECT u.* FROM app_users u
      WHERE ($1='%%' OR lower(concat_ws(' ', coalesce(u.display_name,''),u.email,coalesce(u.organization,''),
        coalesce((SELECT string_agg(c.name,' ' ORDER BY a.cemetery_id) FROM app_user_cemetery_access a
          JOIN cemeteries c ON c.id=a.cemetery_id WHERE a.app_user_id=u.id),''))) LIKE $1)
        AND ($6::text IS NULL OR lower(u.email)=$6)
        AND ($2::boolean IS NULL OR u.is_active=$2)
        AND ($3::uuid IS NULL OR EXISTS (SELECT 1 FROM app_user_cemetery_access a WHERE a.app_user_id=u.id AND a.cemetery_id=$3))
      ORDER BY u.is_active DESC,lower(u.email),u.id LIMIT $4 OFFSET $5
    )
    SELECT app_users.id::text, ${accountVersionSql} AS version, app_users.external_subject,app_users.email,app_users.display_name,
      app_users.role_name,app_users.is_active,app_users.phone,app_users.organization,app_users.preferred_cemetery_id,
      activity.last_active_at,app_users.last_authenticated_at,app_users.created_at,app_users.updated_at,
      coalesce(m.cemetery_memberships,'[]'::jsonb) AS cemetery_memberships,
      coalesce(m.assigned_cemetery_ids,'{}'::text[]) AS assigned_cemetery_ids
    FROM selected_users app_users
    LEFT JOIN app_user_activity activity ON activity.app_user_id=app_users.id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('cemeteryId',a.cemetery_id::text,'role',a.role_name) ORDER BY a.cemetery_id) AS cemetery_memberships,
        array_agg(a.cemetery_id::text ORDER BY c.name,a.cemetery_id::text) AS assigned_cemetery_ids
      FROM app_user_cemetery_access a LEFT JOIN cemeteries c ON c.id=a.cemetery_id
      WHERE a.app_user_id=app_users.id
    ) m ON true
    ORDER BY app_users.is_active DESC,lower(app_users.email),app_users.id
  `, [pattern, status === "all" ? null : status === "active", cemeteryId ? validateCemeteryId(cemeteryId) : null, limit, offset, email?.trim().toLowerCase() ?? null]);
  return result.rows.map(toUser);
}

async function replaceCemeteryAssignments(client, userId, assignedCemeteryIds, memberships, role) {
  const cemeteryIds = [...new Set((assignedCemeteryIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))];
  const assignments = cemeteryIds.map(cemeteryId => {
    const membershipRole = memberships?.find(entry => entry.cemeteryId === cemeteryId)?.role ?? (role === "admin" ? "reader" : role);
    return { cemetery_id: cemeteryId, role_name: membershipRole, can_edit: membershipRole !== "reader" };
  });
  await client.query(`DELETE FROM app_user_cemetery_access
    WHERE app_user_id=$1 AND NOT (cemetery_id=ANY($2::uuid[]))`, [userId, cemeteryIds]);
  await client.query(`INSERT INTO app_user_cemetery_access (app_user_id, cemetery_id, can_edit, role_name)
    SELECT $1, a.cemetery_id, a.can_edit, a.role_name
    FROM jsonb_to_recordset($2::jsonb) AS a(cemetery_id uuid, can_edit boolean, role_name text)
    WHERE NOT EXISTS (SELECT 1 FROM app_user_cemetery_access existing WHERE existing.app_user_id=$1
      AND existing.cemetery_id=a.cemetery_id AND (existing.can_edit,existing.role_name) IS NOT DISTINCT FROM (a.can_edit,a.role_name))
    ON CONFLICT (app_user_id, cemetery_id) DO UPDATE
      SET can_edit=EXCLUDED.can_edit, role_name=EXCLUDED.role_name
      WHERE (app_user_cemetery_access.can_edit, app_user_cemetery_access.role_name)
        IS DISTINCT FROM (EXCLUDED.can_edit, EXCLUDED.role_name)`, [userId, JSON.stringify(assignments)]);
  await client.query(`UPDATE app_users SET preferred_cemetery_id = NULL
    WHERE id = $1 AND role_name <> 'admin' AND preferred_cemetery_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM app_user_cemetery_access a WHERE a.app_user_id = app_users.id AND a.cemetery_id = app_users.preferred_cemetery_id)`, [userId]);
}

export async function selectUserById(client, id) {
  const result = await client.query(
    `
      SELECT
        app_users.id::text,
        ${accountVersionSql} AS version,
        app_users.external_subject,
        app_users.email,
        app_users.display_name,
        app_users.role_name,
        app_users.is_active,
        app_users.phone, app_users.organization, app_users.preferred_cemetery_id,
      (SELECT last_active_at FROM app_user_activity WHERE app_user_id = app_users.id) AS last_active_at,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('cemeteryId', a.cemetery_id::text, 'role', a.role_name) ORDER BY a.cemetery_id)
        FROM app_user_cemetery_access a WHERE a.app_user_id = app_users.id), '[]'::jsonb) AS cemetery_memberships,
      app_users.last_authenticated_at,
        app_users.created_at,
        app_users.updated_at,
        COALESCE(array_remove(array_agg(app_user_cemetery_access.cemetery_id::text ORDER BY cemeteries.name, app_user_cemetery_access.cemetery_id::text), NULL), '{}'::text[]) AS assigned_cemetery_ids
      FROM app_users
      LEFT JOIN app_user_cemetery_access
        ON app_user_cemetery_access.app_user_id = app_users.id
      LEFT JOIN cemeteries
        ON cemeteries.id = app_user_cemetery_access.cemetery_id
      WHERE app_users.id = $1
      GROUP BY app_users.id
    `,
    [id],
  );
  return result.rows[0] ? toUser(result.rows[0]) : undefined;
}

export async function createUser(pool, user) {
  return withAuditContext(pool, { actorUser: user.actorUser }, async (client) => {
    await lockAccessRequest(client, user);
    const result = await client.query(
      `
        INSERT INTO app_users (external_subject, email, display_name, role_name, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id::text
      `,
      [user.externalSubject, user.email, user.displayName || null, user.role, user.isActive],
    );
    await replaceCemeteryAssignments(client, result.rows[0].id, user.assignedCemeteryIds, user.cemeteryMemberships, user.role);
    await finishAccessRequest(client, user, result.rows[0].id);
    return selectUserById(client, result.rows[0].id);
  });
}

export async function updateUser(pool, id, user) {
  return withAuditContext(pool, { actorUser: user.actorUser }, async (client) => {
    await lockAccessRequest(client, user);
    const locked = await client.query("SELECT id FROM app_users WHERE id=$1 FOR UPDATE", [id]);
    if (!locked.rows[0]) return undefined;
    if (user.expectedVersion !== undefined) {
      const current = await client.query(`SELECT ${accountVersionSql} AS version FROM app_users WHERE id=$1`,[id]);
      assertRecordVersion(current.rows[0]?.version,user.expectedVersion);
    }
    await client.query(
      `
        UPDATE app_users
        SET external_subject = $2,
            email = $3,
            display_name = $4,
            role_name = $5,
            is_active = $6
        WHERE id = $1 AND (external_subject,email,display_name,role_name,is_active)
          IS DISTINCT FROM ($2,$3,$4,$5,$6)
      `,
      [id, user.externalSubject, user.email, user.displayName || null, user.role, user.isActive],
    );
    await replaceCemeteryAssignments(client, id, user.assignedCemeteryIds, user.cemeteryMemberships, user.role);
    await finishAccessRequest(client, user, id);
    return selectUserById(client, id);
  });
}

export async function listAssignableRoles(pool) {
  return (await listRoles(pool)).map((role) => role.name);
}
