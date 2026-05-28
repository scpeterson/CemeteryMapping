import { auth as auth0BearerAuth } from "express-oauth2-jwt-bearer";

const roleRank = new Map([
  ["reader", 1],
  ["power-user", 2],
  ["cemetery-admin", 3],
  ["admin", 4],
]);

const auth0ValidatorCache = new WeakMap();

function unauthorized(response, message = "Authentication required") {
  response.status(401).json({ error: message });
}

function forbidden(response, message = "Forbidden") {
  response.status(403).json({ error: message });
}

function getHeader(request, name) {
  return typeof request.get === "function" ? request.get(name) : undefined;
}

function normalizeRole(role) {
  return String(role ?? "").trim().toLowerCase();
}

export function canViewOwnership(role) {
  return hasRequiredRole(normalizeRole(role), ["power-user"]);
}

function cemeteryAssignments(user) {
  return Array.isArray(user?.cemeteryAccess) ? user.cemeteryAccess : [];
}

export function assignedEditableCemeteryIds(user) {
  return cemeteryAssignments(user)
    .filter((assignment) => assignment.canEdit)
    .map((assignment) => assignment.cemeteryId);
}

export function canEditCemetery(user, cemeteryId) {
  const role = normalizeRole(user?.role);
  if (role === "admin") return true;
  if (role !== "power-user" && role !== "cemetery-admin") return false;
  return assignedEditableCemeteryIds(user).includes(String(cemeteryId));
}

export function canViewOwnershipForCemetery(user, cemeteryId) {
  return canEditCemetery(user, cemeteryId);
}

export function canManageUsers(role) {
  return hasRequiredRole(normalizeRole(role), ["admin"]);
}

function hasRequiredRole(actualRole, requiredRoles) {
  const actualRank = roleRank.get(actualRole);
  if (!actualRank) return false;
  return requiredRoles.some((role) => actualRank >= (roleRank.get(role) ?? Number.POSITIVE_INFINITY));
}

function readTrustedHeaderUser(request, authConfig) {
  const role = normalizeRole(getHeader(request, authConfig.roleHeader));
  const email = getHeader(request, authConfig.emailHeader)?.trim();
  const subject = getHeader(request, authConfig.subjectHeader)?.trim() || email;

  if (!subject || !email || !role) return undefined;

  return {
    subject,
    email,
    role,
    cemeteryAccess: String(getHeader(request, "x-cemetery-user-cemetery-ids") ?? "")
      .split(",")
      .map((cemeteryId) => cemeteryId.trim())
      .filter(Boolean)
      .map((cemeteryId) => ({ cemeteryId, canEdit: true })),
  };
}

function middlewareToPromise(middleware, request, response) {
  return new Promise((resolve, reject) => {
    middleware(request, response, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getAuth0Validator(authConfig) {
  if (authConfig.auth0Validator) return authConfig.auth0Validator;
  if (auth0ValidatorCache.has(authConfig)) return auth0ValidatorCache.get(authConfig);

  const validator = auth0BearerAuth({
    issuerBaseURL: authConfig.auth0.issuerBaseUrl,
    audience: authConfig.auth0.audience,
    tokenSigningAlg: "RS256",
  });
  auth0ValidatorCache.set(authConfig, validator);
  return validator;
}

function auth0Payload(request) {
  return request.auth?.payload ?? request.auth;
}

function readBearerTokenSubject(request) {
  const payload = auth0Payload(request);
  const subject = payload?.sub?.trim();
  const email = payload?.email?.trim();
  if (!subject) return undefined;

  return {
    subject,
    email,
  };
}

async function loadApplicationUser(pool, subject) {
  const result = await pool.query(
    `
      SELECT
        id::text,
        external_subject,
        email,
        display_name,
        role_name,
        is_active,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'cemeteryId', app_user_cemetery_access.cemetery_id::text,
              'canEdit', app_user_cemetery_access.can_edit
            )
          ) FILTER (WHERE app_user_cemetery_access.id IS NOT NULL),
          '[]'::jsonb
        ) AS cemetery_access
      FROM app_users
      LEFT JOIN app_user_cemetery_access
        ON app_user_cemetery_access.app_user_id = app_users.id
      WHERE external_subject = $1
      GROUP BY app_users.id
      LIMIT 1
    `,
    [subject],
  );
  return result.rows[0];
}

function toRequestUser(appUser, tokenUser) {
  return {
    id: appUser.id,
    subject: appUser.external_subject,
    email: appUser.email ?? tokenUser.email,
    displayName: appUser.display_name,
    role: normalizeRole(appUser.role_name),
    cemeteryAccess: appUser.cemetery_access ?? [],
  };
}

function handleAuth0Error(error, response) {
  if (error?.status === 401 || error?.statusCode === 401) {
    unauthorized(response, error.message);
    return;
  }

  throw error;
}

export function requireRole(authConfig, poolOrRole, ...restRequiredRoles) {
  const hasPool = typeof poolOrRole === "object" && poolOrRole !== null && typeof poolOrRole.query === "function";
  const pool = hasPool ? poolOrRole : undefined;
  const requiredRoles = hasPool ? restRequiredRoles : [poolOrRole, ...restRequiredRoles];
  const normalizedRequiredRoles = requiredRoles.map(normalizeRole);

  return async (request, response, next) => {
    if (authConfig.mode === "disabled") {
      request.user = {
        subject: "local-disabled-auth",
        email: "local-disabled-auth@example.test",
        role: "admin",
      };
      next();
      return;
    }

    if (authConfig.mode === "trusted-header") {
      const user = readTrustedHeaderUser(request, authConfig);
      if (!user) {
        unauthorized(response);
        return;
      }

      if (!roleRank.has(user.role)) {
        forbidden(response, "Unknown role");
        return;
      }

      if (!hasRequiredRole(user.role, normalizedRequiredRoles)) {
        forbidden(response);
        return;
      }

      request.user = user;
      next();
      return;
    }

    if (authConfig.mode !== "auth0") {
      throw new Error(`Unsupported AUTH_MODE "${authConfig.mode}".`);
    }

    if (!pool) throw new Error("A database pool is required when AUTH_MODE=auth0.");

    try {
      await middlewareToPromise(getAuth0Validator(authConfig), request, response);
    } catch (error) {
      handleAuth0Error(error, response);
      return;
    }

    const tokenUser = readBearerTokenSubject(request);
    if (!tokenUser) {
      unauthorized(response, "Token subject is required");
      return;
    }

    const appUser = await loadApplicationUser(pool, tokenUser.subject);
    if (!appUser || !appUser.is_active) {
      forbidden(response, "User is not authorized");
      return;
    }

    const requestUser = toRequestUser(appUser, tokenUser);
    if (!roleRank.has(requestUser.role)) {
      forbidden(response, "Unknown role");
      return;
    }

    if (!hasRequiredRole(requestUser.role, normalizedRequiredRoles)) {
      forbidden(response);
      return;
    }

    request.user = requestUser;
    next();
  };
}
