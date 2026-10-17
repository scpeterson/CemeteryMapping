import assert from "node:assert/strict";
import test from "node:test";
import { validateAdminUserPayload } from "./routes/adminRouteValidation.mjs";

const roles = ["reader", "power-user", "cemetery-admin", "admin"];
const cemeteryId = "11111111-1111-4111-8111-111111111111";
const payload = { email: "user@example.com", externalSubject: "auth0|user" };

for (const role of roles.filter(role => role !== "admin")) {
  test(`${role} creation and updates require a cemetery assignment`, () => {
    for (const assignedCemeteryIds of [undefined, []]) {
      assert.throws(() => validateAdminUserPayload({ ...payload, role, assignedCemeteryIds }, roles), /Assigned cemetery is required/);
    }
    assert.deepEqual(validateAdminUserPayload({ ...payload, role, assignedCemeteryIds: [cemeteryId] }, roles).assignedCemeteryIds, [cemeteryId]);
  });
}
test("system admins can retain system-wide access without an assignment", () => {
  assert.deepEqual(validateAdminUserPayload({ ...payload, role: "admin" }, roles).assignedCemeteryIds, []);
});
