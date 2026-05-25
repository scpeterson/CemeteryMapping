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
    isActive: row.is_active,
    lastAuthenticatedAt: row.last_authenticated_at?.toISOString?.() ?? row.last_authenticated_at ?? undefined,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}

export async function listRoles(pool) {
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
        WHEN 'admin' THEN 3
        ELSE 4
      END,
      app_roles.role_name
  `);
  return result.rows.map(toRole);
}

export async function listUsers(pool) {
  const result = await pool.query(`
    SELECT id::text, external_subject, email, display_name, role_name, is_active, last_authenticated_at, created_at, updated_at
    FROM app_users
    ORDER BY is_active DESC, lower(email), id
  `);
  return result.rows.map(toUser);
}

export async function createUser(pool, user) {
  const result = await pool.query(
    `
      INSERT INTO app_users (external_subject, email, display_name, role_name, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id::text, external_subject, email, display_name, role_name, is_active, last_authenticated_at, created_at, updated_at
    `,
    [user.externalSubject, user.email, user.displayName || null, user.role, user.isActive],
  );
  return toUser(result.rows[0]);
}

export async function updateUser(pool, id, user) {
  const result = await pool.query(
    `
      UPDATE app_users
      SET external_subject = $2,
          email = $3,
          display_name = $4,
          role_name = $5,
          is_active = $6,
          updated_at = now()
      WHERE id = $1
      RETURNING id::text, external_subject, email, display_name, role_name, is_active, last_authenticated_at, created_at, updated_at
    `,
    [id, user.externalSubject, user.email, user.displayName || null, user.role, user.isActive],
  );
  return result.rows[0] ? toUser(result.rows[0]) : undefined;
}

export async function listAssignableRoles(pool) {
  return (await listRoles(pool)).map((role) => role.name);
}
