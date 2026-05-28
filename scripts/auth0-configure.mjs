import { pathToFileURL } from "node:url";

export const requiredApiPermissions = [
  { value: "read:cemetery", description: "Read cemetery map, grave, and burial data." },
  { value: "write:cemetery", description: "Create and update cemetery records." },
  { value: "read:deeds", description: "Read deed and owner information." },
  { value: "write:deeds", description: "Create and update deed and owner information." },
];

export const requiredRolePermissions = {
  reader: ["read:cemetery"],
  "power-user": ["read:cemetery", "write:cemetery", "read:deeds", "write:deeds"],
  admin: ["read:cemetery", "write:cemetery", "read:deeds", "write:deeds"],
};

const roleDescriptions = {
  reader: "Can view cemetery map, gravesite, and burial information.",
  "power-user": "Can view and edit deed/owner information and update existing cemetery records.",
  admin: "Can manage users and roles, add records, update records, and soft-delete records.",
};

function normalizeDomain(domain) {
  return String(domain ?? "").replace(/^https?:\/\//u, "").replace(/\/$/u, "");
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function auth0BaseUrl(domain) {
  return `https://${normalizeDomain(domain)}`;
}

async function jsonOrText(response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessage(label, response, body) {
  if (typeof body === "object" && body) {
    const message = body.message ?? body.error_description ?? body.error;
    if (message) return `${label} returned ${response.status}: ${message}`;
  }
  return `${label} returned ${response.status}`;
}

async function requestManagementToken(config, fetchImpl) {
  const domain = normalizeDomain(config.domain);
  const response = await fetchImpl(`${auth0BaseUrl(domain)}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  const body = await jsonOrText(response);
  if (!response.ok) throw new Error(errorMessage("Auth0 token API", response, body));
  return body.access_token;
}

function createManagementApi(config, token, fetchImpl) {
  return async function managementRequest(path, init = {}) {
    const response = await fetchImpl(`${auth0BaseUrl(config.domain)}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    const body = await jsonOrText(response);
    if (!response.ok) throw new Error(errorMessage("Auth0 Management API", response, body));
    return body;
  };
}

function mergeScopes(existingScopes) {
  const scopesByValue = new Map((existingScopes ?? []).map((scope) => [scope.value, scope]));
  for (const scope of requiredApiPermissions) {
    scopesByValue.set(scope.value, { ...scope, ...scopesByValue.get(scope.value) });
  }
  return [...scopesByValue.values()].sort((a, b) => a.value.localeCompare(b.value));
}

async function configureResourceServer(managementRequest, audience, log) {
  const id = encodeURIComponent(audience);
  const resourceServer = await managementRequest(`/api/v2/resource-servers/${id}`);
  const nextScopes = mergeScopes(resourceServer.scopes);

  await managementRequest(`/api/v2/resource-servers/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      scopes: nextScopes,
      enforce_policies: true,
      token_dialect: "access_token_authz",
    }),
  });

  log(`Configured API permissions and RBAC for ${audience}.`);
}

async function listRoles(managementRequest) {
  const roles = [];
  let page = 0;

  while (true) {
    const result = await managementRequest(`/api/v2/roles?page=${page}&per_page=100&include_totals=true`);
    roles.push(...result.roles);
    if (roles.length >= result.total) return roles;
    page += 1;
  }
}

async function ensureRole(managementRequest, rolesByName, name, log) {
  const existingRole = rolesByName.get(name);
  if (existingRole) return existingRole;

  const createdRole = await managementRequest("/api/v2/roles", {
    method: "POST",
    body: JSON.stringify({
      name,
      description: roleDescriptions[name],
    }),
  });
  rolesByName.set(name, createdRole);
  log(`Created Auth0 role ${name}.`);
  return createdRole;
}

async function listRolePermissions(managementRequest, roleId) {
  const permissions = [];
  let page = 0;

  while (true) {
    const result = await managementRequest(`/api/v2/roles/${encodeURIComponent(roleId)}/permissions?page=${page}&per_page=100&include_totals=true`);
    permissions.push(...result.permissions);
    if (permissions.length >= result.total) return permissions;
    page += 1;
  }
}

async function configureRolePermissions(managementRequest, audience, rolesByName, log) {
  for (const [roleName, permissionNames] of Object.entries(requiredRolePermissions)) {
    const role = await ensureRole(managementRequest, rolesByName, roleName, log);
    const existingPermissions = await listRolePermissions(managementRequest, role.id);
    const existingPermissionNames = new Set(
      existingPermissions
        .filter((permission) => permission.resource_server_identifier === audience)
        .map((permission) => permission.permission_name),
    );
    const missingPermissionNames = permissionNames.filter((permissionName) => !existingPermissionNames.has(permissionName));
    if (missingPermissionNames.length === 0) {
      log(`Auth0 role ${roleName} already has the required permissions.`);
      continue;
    }

    await managementRequest(`/api/v2/roles/${encodeURIComponent(role.id)}/permissions`, {
      method: "POST",
      body: JSON.stringify({
        permissions: missingPermissionNames.map((permissionName) => ({
          resource_server_identifier: audience,
          permission_name: permissionName,
        })),
      }),
    });
    log(`Configured permissions for Auth0 role ${roleName}.`);
  }
}

export async function configureAuth0(config, { fetchImpl = globalThis.fetch, log = console.log } = {}) {
  if (!fetchImpl) throw new Error("Fetch is not available for Auth0 Management API calls.");

  const token = await requestManagementToken(config, fetchImpl);
  const managementRequest = createManagementApi(config, token, fetchImpl);

  await configureResourceServer(managementRequest, config.audience, log);
  const roles = await listRoles(managementRequest);
  const rolesByName = new Map(roles.map((role) => [role.name, role]));
  await configureRolePermissions(managementRequest, config.audience, rolesByName, log);

  log("Auth0 tenant configuration complete.");
}

export function configFromEnvironment() {
  return {
    domain: requiredEnv("AUTH0_DOMAIN"),
    audience: requiredEnv("AUTH0_AUDIENCE"),
    clientId: requiredEnv("AUTH0_MANAGEMENT_CLIENT_ID"),
    clientSecret: requiredEnv("AUTH0_MANAGEMENT_CLIENT_SECRET"),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  configureAuth0(configFromEnvironment()).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
