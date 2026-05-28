import assert from "node:assert/strict";
import test from "node:test";
import { assignedEditableCemeteryIds, canEditCemetery, canViewOwnershipForCemetery, requireRole } from "./auth.mjs";

const trustedHeaderConfig = {
  mode: "trusted-header",
  subjectHeader: "x-cemetery-user-subject",
  emailHeader: "x-cemetery-user-email",
  roleHeader: "x-cemetery-user-role",
};

function runMiddleware(middleware, headers = {}) {
  const lowerHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  const request = {
    get(name) {
      return lowerHeaders.get(name.toLowerCase());
    },
  };
  const response = {
    statusCode: 200,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let nextCalled = false;

  const result = middleware(request, response, () => {
    nextCalled = true;
  });

  return Promise.resolve(result).then(() => ({ request, response, nextCalled }));
}

function auth0ConfigForPayload(payload) {
  return {
    mode: "auth0",
    auth0: {
      issuerBaseUrl: "https://cemetery-mapping-test.auth0.com",
      audience: "https://cemetery-mapping.test/api",
    },
    auth0Validator(request, _response, next) {
      request.auth = { payload };
      next();
    },
  };
}

function auth0ConfigForError(error) {
  return {
    mode: "auth0",
    auth0: {
      issuerBaseUrl: "https://cemetery-mapping-test.auth0.com",
      audience: "https://cemetery-mapping.test/api",
    },
    auth0Validator(_request, _response, next) {
      next(error);
    },
  };
}

function poolForUser(user) {
  return {
    async query(sql, values) {
      assert.match(sql, /app_users\.id::text/);
      assert.match(sql, /app_users\.external_subject = \$1/);
      assert.doesNotMatch(sql, /SELECT\s+id::text/);
      assert.deepEqual(values, ["auth0|user-1"]);
      return { rows: user ? [user] : [] };
    },
  };
}

test("disabled auth mode allows requests and assigns a local admin user", async () => {
  const result = await runMiddleware(requireRole({ mode: "disabled" }, "reader"));

  assert.equal(result.nextCalled, true);
  assert.equal(result.request.user.role, "admin");
});

test("trusted-header auth mode rejects missing user headers", async () => {
  const result = await runMiddleware(requireRole(trustedHeaderConfig, "reader"));

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.response.body, { error: "Authentication required" });
});

test("trusted-header auth mode allows reader access to reader routes", async () => {
  const result = await runMiddleware(requireRole(trustedHeaderConfig, "reader"), {
    "x-cemetery-user-subject": "user-1",
    "x-cemetery-user-email": "reader@example.test",
    "x-cemetery-user-role": "reader",
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.request.user, {
    subject: "user-1",
    email: "reader@example.test",
    role: "reader",
    cemeteryAccess: [],
  });
});

test("trusted-header auth mode blocks reader access to admin routes", async () => {
  const result = await runMiddleware(requireRole(trustedHeaderConfig, "admin"), {
    "x-cemetery-user-subject": "user-1",
    "x-cemetery-user-email": "reader@example.test",
    "x-cemetery-user-role": "reader",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: "Forbidden" });
});

test("trusted-header auth mode allows power users to access power-user routes but not admin routes", async () => {
  const powerUserHeaders = {
    "x-cemetery-user-subject": "user-3",
    "x-cemetery-user-email": "power@example.test",
    "x-cemetery-user-role": "power-user",
  };
  const powerUserResult = await runMiddleware(requireRole(trustedHeaderConfig, "power-user"), powerUserHeaders);
  const adminResult = await runMiddleware(requireRole(trustedHeaderConfig, "admin"), powerUserHeaders);

  assert.equal(powerUserResult.nextCalled, true);
  assert.equal(powerUserResult.request.user.role, "power-user");
  assert.equal(adminResult.nextCalled, false);
  assert.equal(adminResult.response.statusCode, 403);
});

test("trusted-header auth mode allows cemetery admins to access power-user routes but not admin routes", async () => {
  const cemeteryAdminHeaders = {
    "x-cemetery-user-subject": "user-4",
    "x-cemetery-user-email": "cemetery-admin@example.test",
    "x-cemetery-user-role": "cemetery-admin",
    "x-cemetery-user-cemetery-ids": "cemetery-1",
  };
  const powerUserResult = await runMiddleware(requireRole(trustedHeaderConfig, "power-user"), cemeteryAdminHeaders);
  const adminResult = await runMiddleware(requireRole(trustedHeaderConfig, "admin"), cemeteryAdminHeaders);

  assert.equal(powerUserResult.nextCalled, true);
  assert.equal(powerUserResult.request.user.role, "cemetery-admin");
  assert.deepEqual(powerUserResult.request.user.cemeteryAccess, [{ cemeteryId: "cemetery-1", canEdit: true }]);
  assert.equal(adminResult.nextCalled, false);
  assert.equal(adminResult.response.statusCode, 403);
});

test("trusted-header auth mode allows admin access to reader routes", async () => {
  const result = await runMiddleware(requireRole(trustedHeaderConfig, "reader"), {
    "x-cemetery-user-subject": "user-2",
    "x-cemetery-user-email": "admin@example.test",
    "x-cemetery-user-role": "admin",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.request.user.role, "admin");
});

test("cemetery scoped helpers allow assigned cemetery edits only", () => {
  const user = {
    role: "cemetery-admin",
    cemeteryAccess: [
      { cemeteryId: "11111111-1111-4111-8111-111111111111", canEdit: true },
      { cemeteryId: "22222222-2222-4222-8222-222222222222", canEdit: false },
    ],
  };

  assert.deepEqual(assignedEditableCemeteryIds(user), ["11111111-1111-4111-8111-111111111111"]);
  assert.equal(canEditCemetery(user, "11111111-1111-4111-8111-111111111111"), true);
  assert.equal(canViewOwnershipForCemetery(user, "11111111-1111-4111-8111-111111111111"), true);
  assert.equal(canEditCemetery(user, "22222222-2222-4222-8222-222222222222"), false);
  assert.equal(canViewOwnershipForCemetery(user, "33333333-3333-4333-8333-333333333333"), false);
});

test("global admins can edit and view ownership for every cemetery", () => {
  const user = { role: "admin", cemeteryAccess: [] };

  assert.equal(canEditCemetery(user, "11111111-1111-4111-8111-111111111111"), true);
  assert.equal(canViewOwnershipForCemetery(user, "22222222-2222-4222-8222-222222222222"), true);
});

test("auth0 mode rejects invalid bearer tokens", async () => {
  const result = await runMiddleware(
    requireRole(auth0ConfigForError({ status: 401, message: "Invalid token" }), poolForUser(undefined), "reader"),
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.response.body, { error: "Invalid token" });
});

test("auth0 mode rejects tokens without a subject", async () => {
  const result = await runMiddleware(requireRole(auth0ConfigForPayload({ email: "reader@example.test" }), poolForUser(undefined), "reader"));

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.response.body, { error: "Token subject is required" });
});

test("auth0 mode rejects users not mapped in app_users", async () => {
  const result = await runMiddleware(requireRole(auth0ConfigForPayload({ sub: "auth0|user-1" }), poolForUser(undefined), "reader"));

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: "User is not authorized" });
});

test("auth0 mode rejects inactive app_users records", async () => {
  const result = await runMiddleware(
    requireRole(
      auth0ConfigForPayload({ sub: "auth0|user-1" }),
      poolForUser({
        id: "app-user-1",
        external_subject: "auth0|user-1",
        email: "reader@example.test",
        display_name: "Reader User",
        role_name: "reader",
        is_active: false,
      }),
      "reader",
    ),
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: "User is not authorized" });
});

test("auth0 mode enforces the local app_users role", async () => {
  const result = await runMiddleware(
    requireRole(
      auth0ConfigForPayload({ sub: "auth0|user-1", email: "different@example.test" }),
      poolForUser({
        id: "app-user-1",
        external_subject: "auth0|user-1",
        email: "reader@example.test",
        display_name: "Reader User",
        role_name: "reader",
        is_active: true,
      }),
      "admin",
    ),
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: "Forbidden" });
});

test("auth0 mode allows active admin users to access reader routes", async () => {
  const result = await runMiddleware(
    requireRole(
      auth0ConfigForPayload({ sub: "auth0|user-1", email: "admin@example.test" }),
      poolForUser({
        id: "app-user-1",
        external_subject: "auth0|user-1",
        email: "admin@example.test",
        display_name: "Admin User",
        role_name: "admin",
        is_active: true,
      }),
      "reader",
    ),
  );

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.request.user, {
    id: "app-user-1",
    subject: "auth0|user-1",
    email: "admin@example.test",
    displayName: "Admin User",
    role: "admin",
    cemeteryAccess: [],
  });
});
