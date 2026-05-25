import assert from "node:assert/strict";
import test from "node:test";
import { configureAuth0, requiredApiPermissions, requiredRolePermissions } from "./auth0-configure.mjs";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("configureAuth0 merges scopes, enables RBAC, creates missing roles, and assigns permissions", async () => {
  const requests = [];
  const logMessages = [];

  await configureAuth0(
    {
      domain: "cemetery-test.auth0.com",
      audience: "https://cemetery-mapping.test/api",
      clientId: "management-client",
      clientSecret: "management-secret",
    },
    {
      log(message) {
        logMessages.push(message);
      },
      async fetchImpl(url, init) {
        requests.push({ url, init });
        if (url.endsWith("/oauth/token")) return jsonResponse({ access_token: "token", expires_in: 3600 });
        if (url.includes("/api/v2/resource-servers/") && init?.method !== "PATCH") {
          return jsonResponse({
            identifier: "https://cemetery-mapping.test/api",
            scopes: [{ value: "read:cemetery", description: "Existing description" }],
          });
        }
        if (url.includes("/api/v2/resource-servers/") && init.method === "PATCH") return jsonResponse({});
        if (url.includes("/api/v2/roles?")) {
          return jsonResponse({
            roles: [{ id: "role-reader", name: "reader" }],
            total: 1,
          });
        }
        if (url.endsWith("/api/v2/roles")) {
          const body = JSON.parse(init.body);
          return jsonResponse({ id: `role-${body.name}`, name: body.name, description: body.description }, 201);
        }
        if (url.includes("/permissions") && init?.method !== "POST") return jsonResponse({ permissions: [], total: 0 });
        if (url.includes("/permissions") && init.method === "POST") return jsonResponse({});
        throw new Error(`Unexpected request: ${url}`);
      },
    },
  );

  const resourcePatch = requests.find((request) => request.url.includes("/resource-servers/") && request.init.method === "PATCH");
  const patchedBody = JSON.parse(resourcePatch.init.body);
  assert.equal(patchedBody.enforce_policies, true);
  assert.equal(patchedBody.token_dialect, "access_token_authz");
  assert.deepEqual(
    patchedBody.scopes.map((scope) => scope.value).sort(),
    requiredApiPermissions.map((scope) => scope.value).sort(),
  );

  const createdRoles = requests.filter((request) => request.url.endsWith("/api/v2/roles") && request.init.method === "POST");
  assert.deepEqual(
    createdRoles.map((request) => JSON.parse(request.init.body).name).sort(),
    ["admin", "power-user"],
  );

  const permissionRequests = requests.filter((request) => request.url.includes("/permissions") && request.init.method === "POST");
  assert.equal(permissionRequests.length, 3);
  for (const request of permissionRequests) {
    const body = JSON.parse(request.init.body);
    assert.ok(body.permissions.every((permission) => permission.resource_server_identifier === "https://cemetery-mapping.test/api"));
  }
  assert.deepEqual(Object.keys(requiredRolePermissions), ["reader", "power-user", "admin"]);
  assert.ok(logMessages.includes("Auth0 tenant configuration complete."));
});

test("configureAuth0 skips role permission writes when roles already have permissions", async () => {
  const requests = [];
  const allPermissions = Object.values(requiredRolePermissions)
    .flat()
    .map((permissionName) => ({
      resource_server_identifier: "https://cemetery-mapping.test/api",
      permission_name: permissionName,
    }));

  await configureAuth0(
    {
      domain: "cemetery-test.auth0.com",
      audience: "https://cemetery-mapping.test/api",
      clientId: "management-client",
      clientSecret: "management-secret",
    },
    {
      log() {},
      async fetchImpl(url, init) {
        requests.push({ url, init });
        if (url.endsWith("/oauth/token")) return jsonResponse({ access_token: "token", expires_in: 3600 });
        if (url.includes("/api/v2/resource-servers/") && init?.method !== "PATCH") {
          return jsonResponse({ identifier: "https://cemetery-mapping.test/api", scopes: requiredApiPermissions });
        }
        if (url.includes("/api/v2/resource-servers/") && init.method === "PATCH") return jsonResponse({});
        if (url.includes("/api/v2/roles?")) {
          return jsonResponse({
            roles: [
              { id: "role-reader", name: "reader" },
              { id: "role-power-user", name: "power-user" },
              { id: "role-admin", name: "admin" },
            ],
            total: 3,
          });
        }
        if (url.includes("/permissions") && init?.method !== "POST") {
          return jsonResponse({ permissions: allPermissions, total: allPermissions.length });
        }
        throw new Error(`Unexpected request: ${url}`);
      },
    },
  );

  assert.equal(requests.some((request) => request.url.includes("/permissions") && request.init.method === "POST"), false);
});
