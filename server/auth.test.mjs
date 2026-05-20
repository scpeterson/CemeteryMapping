import assert from "node:assert/strict";
import test from "node:test";
import { requireRole } from "./auth.mjs";

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

  middleware(request, response, () => {
    nextCalled = true;
  });

  return { request, response, nextCalled };
}

test("disabled auth mode allows requests and assigns a local admin user", () => {
  const result = runMiddleware(requireRole({ mode: "disabled" }, "reader"));

  assert.equal(result.nextCalled, true);
  assert.equal(result.request.user.role, "admin");
});

test("trusted-header auth mode rejects missing user headers", () => {
  const result = runMiddleware(requireRole(trustedHeaderConfig, "reader"));

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 401);
  assert.deepEqual(result.response.body, { error: "Authentication required" });
});

test("trusted-header auth mode allows reader access to reader routes", () => {
  const result = runMiddleware(requireRole(trustedHeaderConfig, "reader"), {
    "x-cemetery-user-subject": "user-1",
    "x-cemetery-user-email": "reader@example.test",
    "x-cemetery-user-role": "reader",
  });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.request.user, {
    subject: "user-1",
    email: "reader@example.test",
    role: "reader",
  });
});

test("trusted-header auth mode blocks reader access to admin routes", () => {
  const result = runMiddleware(requireRole(trustedHeaderConfig, "admin"), {
    "x-cemetery-user-subject": "user-1",
    "x-cemetery-user-email": "reader@example.test",
    "x-cemetery-user-role": "reader",
  });

  assert.equal(result.nextCalled, false);
  assert.equal(result.response.statusCode, 403);
  assert.deepEqual(result.response.body, { error: "Forbidden" });
});

test("trusted-header auth mode allows admin access to reader routes", () => {
  const result = runMiddleware(requireRole(trustedHeaderConfig, "reader"), {
    "x-cemetery-user-subject": "user-2",
    "x-cemetery-user-email": "admin@example.test",
    "x-cemetery-user-role": "admin",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.request.user.role, "admin");
});
