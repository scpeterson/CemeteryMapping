import assert from "node:assert/strict";
import test from "node:test";
import { Auth0ProvisioningNotConfiguredError, createAuth0ManagementClient } from "./auth0Management.mjs";

const config = {
  domain: "cemetery-test.auth0.com",
  clientId: "management-client",
  clientSecret: "management-secret",
  connection: "Username-Password-Authentication",
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("resolveOrCreateUser returns an existing Auth0 user id by email", async () => {
  const requests = [];
  const client = createAuth0ManagementClient(config, async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/oauth/token")) return jsonResponse({ access_token: "token", expires_in: 3600 });
    if (url.includes("/api/v2/users-by-email")) {
      return jsonResponse([{ user_id: "auth0|existing", email: "admin@example.test", name: "Existing Admin" }]);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const result = await client.resolveOrCreateUser({ email: "admin@example.test", displayName: "Admin" });

  assert.deepEqual(result, {
    externalSubject: "auth0|existing",
    email: "admin@example.test",
    displayName: "Existing Admin",
    created: false,
    invitationSent: false,
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].init.headers.Authorization, "Bearer token");
});

test("resolveOrCreateUser creates an Auth0 user when email is not found", async () => {
  const requests = [];
  const client = createAuth0ManagementClient(config, async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/oauth/token")) return jsonResponse({ access_token: "token", expires_in: 3600 });
    if (url.includes("/api/v2/users-by-email")) return jsonResponse([]);
    if (url.endsWith("/api/v2/users")) {
      const body = JSON.parse(init.body);
      assert.equal(body.connection, "Username-Password-Authentication");
      assert.equal(body.email, "new@example.test");
      assert.equal(body.name, "New User");
      assert.equal(body.verify_email, true);
      assert.equal(body.email_verified, false);
      assert.match(body.password, /[a-z]/u);
      assert.match(body.password, /[A-Z]/u);
      assert.match(body.password, /\d/u);
      return jsonResponse({ user_id: "auth0|created", email: "new@example.test", name: "New User" }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const result = await client.resolveOrCreateUser({ email: "new@example.test", displayName: "New User" });

  assert.equal(result.externalSubject, "auth0|created");
  assert.equal(result.created, true);
  assert.equal(requests.length, 3);
});

test("resolveOrCreateUser sends a password reset invitation email when configured", async () => {
  const requests = [];
  const client = createAuth0ManagementClient({ ...config, passwordResetClientId: "spa-client" }, async (url, init) => {
    requests.push({ url, init });
    if (url.endsWith("/oauth/token")) return jsonResponse({ access_token: "token", expires_in: 3600 });
    if (url.includes("/api/v2/users-by-email")) return jsonResponse([]);
    if (url.endsWith("/api/v2/users")) return jsonResponse({ user_id: "auth0|created", email: "new@example.test", name: "New User" }, 201);
    if (url.endsWith("/dbconnections/change_password")) {
      assert.deepEqual(JSON.parse(init.body), {
        client_id: "spa-client",
        email: "new@example.test",
        connection: "Username-Password-Authentication",
      });
      return jsonResponse("We've just sent you an email to reset your password.");
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  const result = await client.resolveOrCreateUser({ email: "new@example.test", displayName: "New User" });

  assert.equal(result.externalSubject, "auth0|created");
  assert.equal(result.created, true);
  assert.equal(result.invitationSent, true);
  assert.equal(requests.length, 4);
});

test("resolveOrCreateUser requires Auth0 Management API configuration", async () => {
  const client = createAuth0ManagementClient({ domain: "cemetery-test.auth0.com" }, async () => {
    throw new Error("Fetch should not be called.");
  });

  await assert.rejects(
    () => client.resolveOrCreateUser({ email: "missing@example.test", displayName: "" }),
    Auth0ProvisioningNotConfiguredError,
  );
});
