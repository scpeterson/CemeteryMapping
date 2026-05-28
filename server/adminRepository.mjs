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
    externalSubject: row.external_subject,
    email: row.email,
    displayName: row.display_name ?? "",
    role: row.role_name,
    assignedCemeteryIds: row.assigned_cemetery_ids ?? [],
    isActive: row.is_active,
    lastAuthenticatedAt: row.last_authenticated_at?.toISOString?.() ?? row.last_authenticated_at ?? undefined,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export async function ensureSystemRoles(pool) {
  await pool.query(`
    INSERT INTO app_roles (role_name, description)
    VALUES
      ('reader', 'Can view the map, gravesites, and burial information, but cannot view deed/owner information.'),
      ('power-user', 'Can view cemetery records, view and edit deed/owner information for assigned cemeteries, and has read-only access to other cemeteries.'),
      ('cemetery-admin', 'Can administer assigned cemeteries and has read-only access to other cemeteries.'),
      ('admin', 'Can manage users and roles, view and edit all cemetery records, add structural records, and soft-delete records across the whole system.')
    ON CONFLICT (role_name) DO UPDATE
    SET description = EXCLUDED.description
  `);
}

export async function listRoles(pool) {
  await ensureSystemRoles(pool);
  const result = await pool.query(`
    SELECT
      app_roles.role_name,
      app_roles.description,
      count(app_users.id)::int AS user_count
    FROM app_roles
    LEFT JOIN app_users
      ON app_users.role_name = app_roles.role_name
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

export async function listUsers(pool) {
  const result = await pool.query(`
    SELECT
      app_users.id::text,
      app_users.external_subject,
      app_users.email,
      app_users.display_name,
      app_users.role_name,
      app_users.is_active,
      app_users.last_authenticated_at,
      app_users.created_at,
      app_users.updated_at,
      COALESCE(array_remove(array_agg(app_user_cemetery_access.cemetery_id::text ORDER BY cemeteries.name, app_user_cemetery_access.cemetery_id::text), NULL), '{}'::text[]) AS assigned_cemetery_ids
    FROM app_users
    LEFT JOIN app_user_cemetery_access
      ON app_user_cemetery_access.app_user_id = app_users.id
    LEFT JOIN cemeteries
      ON cemeteries.id = app_user_cemetery_access.cemetery_id
    GROUP BY app_users.id
    ORDER BY app_users.is_active DESC, lower(app_users.email), app_users.id
  `);
  return result.rows.map(toUser);
}

async function replaceCemeteryAssignments(client, userId, assignedCemeteryIds) {
  await client.query("DELETE FROM app_user_cemetery_access WHERE app_user_id = $1", [userId]);
  const cemeteryIds = [...new Set((assignedCemeteryIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))];
  for (const cemeteryId of cemeteryIds) {
    await client.query(
      `
        INSERT INTO app_user_cemetery_access (app_user_id, cemetery_id, can_edit)
        VALUES ($1, $2, true)
      `,
      [userId, cemeteryId],
    );
  }
}

async function selectUserById(client, id) {
  const result = await client.query(
    `
      SELECT
        app_users.id::text,
        app_users.external_subject,
        app_users.email,
        app_users.display_name,
        app_users.role_name,
        app_users.is_active,
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
    const result = await client.query(
      `
        INSERT INTO app_users (external_subject, email, display_name, role_name, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id::text
      `,
      [user.externalSubject, user.email, user.displayName || null, user.role, user.isActive],
    );
    await replaceCemeteryAssignments(client, result.rows[0].id, user.assignedCemeteryIds);
    return selectUserById(client, result.rows[0].id);
  });
}

export async function updateUser(pool, id, user) {
  return withAuditContext(pool, { actorUser: user.actorUser }, async (client) => {
    const result = await client.query(
      `
        UPDATE app_users
        SET external_subject = $2,
            email = $3,
            display_name = $4,
            role_name = $5,
            is_active = $6
        WHERE id = $1
        RETURNING id::text
      `,
      [id, user.externalSubject, user.email, user.displayName || null, user.role, user.isActive],
    );
    if (!result.rows[0]) return undefined;
    await replaceCemeteryAssignments(client, id, user.assignedCemeteryIds);
    return selectUserById(client, id);
  });
}

export async function listAssignableRoles(pool) {
  return (await listRoles(pool)).map((role) => role.name);
}
