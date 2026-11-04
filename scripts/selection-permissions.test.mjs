import assert from "node:assert/strict";
import test from "node:test";
import { selectionPermissions } from "../src/lib/selectionPermissions.ts";
const user = (role, ids = ["assigned"]) => ({ role, assignedCemeteryIds: ids });
test("ownership and editing fail closed before identity and outside assignments", () => {
  for (const identity of [undefined, user("reader"), user("power-user", []), user("cemetery-admin", ["other"])]) {
    assert.ok(Object.values(selectionPermissions(identity, "assigned")).every((allowed) => allowed === false));
  }
});
test("power users edit assigned graves and standalone markers but cannot assign lots", () => {
  for (const selection of [["assigned", undefined], [undefined, "assigned"]]) {
    const permissions = selectionPermissions(user("power-user"), ...selection);
    assert.equal(permissions.canUpdateSelectedBurials, true);
    assert.equal(permissions.canViewSelectedOwnership, true);
    assert.equal(permissions.canManageSelectedGraveLot, false);
  }
  assert.ok(Object.values(selectionPermissions(user("power-user"))).every((allowed) => allowed === false));
});
test("cemetery admins assign lots only to selected graves in their cemetery", () => {
  assert.equal(selectionPermissions(user("cemetery-admin"), "assigned").canManageSelectedGraveLot, true);
  assert.equal(selectionPermissions(user("cemetery-admin"), undefined, "assigned").canManageSelectedGraveLot, false);
  assert.equal(selectionPermissions(user("cemetery-admin"), "other").canManageSelectedGraveLot, false);
});
test("global admin permissions cover all cemeteries", () => {
  assert.ok(Object.values(selectionPermissions(user("admin", []), "other")).every(Boolean));
});

test('mixed memberships use the selected cemetery role rather than the account summary', () => {
  const identity = { role: 'cemetery-admin', assignedCemeteryIds: ['A','B','C'], cemeteryMemberships: [
    { cemeteryId: 'A', role: 'cemetery-admin' }, { cemeteryId: 'B', role: 'power-user' }, { cemeteryId: 'C', role: 'reader' },
  ] };
  assert.equal(selectionPermissions(identity, 'A').canManageSelectedGraveLot, true);
  assert.equal(selectionPermissions(identity, 'B').canUpdateSelectedBurials, true);
  assert.equal(selectionPermissions(identity, 'B').canManageSelectedGraveLot, false);
  assert.equal(selectionPermissions(identity, 'C').canViewSelectedOwnership, false);
  assert.equal(selectionPermissions(identity, 'A', 'C').canUpdateSelectedHeadstones, false);
});
