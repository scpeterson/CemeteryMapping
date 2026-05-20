const roleRank = new Map([
  ["reader", 1],
  ["admin", 2],
]);

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
  };
}

export function requireRole(authConfig, ...requiredRoles) {
  const normalizedRequiredRoles = requiredRoles.map(normalizeRole);

  return (request, response, next) => {
    if (authConfig.mode === "disabled") {
      request.user = {
        subject: "local-disabled-auth",
        email: "local-disabled-auth@example.test",
        role: "admin",
      };
      next();
      return;
    }

    if (authConfig.mode !== "trusted-header") {
      throw new Error(`Unsupported AUTH_MODE "${authConfig.mode}".`);
    }

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
  };
}
