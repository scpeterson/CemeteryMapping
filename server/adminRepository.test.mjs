import assert from "node:assert/strict";
import test from "node:test";
import { listAssignableRoles, listRoles } from "./adminRepository.mjs";

function fakePool(rows) {
  const queries = [];

  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (sql.includes("SELECT")) return { rows };
      return { rows: [] };
    },
  };
}

test("listRoles ensures system roles before returning admin UI role data", async () => {
  const pool = fakePool([
    {
      role_name: "reader",
      description: "Reader from database",
      user_count: 2,
    },
    {
      role_name: "power-user",
      description: "Power user from database",
      user_count: 1,
    },
    {
      role_name: "admin",
      description: "Admin from database",
      user_count: 1,
    },
  ]);

  const roles = await listRoles(pool);

  assert.match(pool.queries[0], /INSERT INTO app_roles/);
  assert.match(pool.queries[0], /'power-user'/);
  assert.deepEqual(
    roles.map((role) => role.name),
    ["reader", "power-user", "cemetery-admin", "admin"],
  );
  assert.equal(roles[1].userCount, 1);
});

test("listRoles falls back to system role definitions when a database snapshot is stale", async () => {
  const pool = fakePool([
    {
      role_name: "reader",
      description: "Reader from database",
      user_count: 2,
    },
    {
      role_name: "admin",
      description: "Admin from database",
      user_count: 1,
    },
  ]);

  const roles = await listRoles(pool);

  assert.deepEqual(
    roles.map((role) => role.name),
    ["reader", "power-user", "cemetery-admin", "admin"],
  );
  assert.equal(
    roles[1].description,
    "Can edit permitted records and view deed/owner information in cemeteries with an editable Power user membership. Other memberships retain their own roles.",
  );
  assert.equal(roles[1].userCount, 0);
  assert.equal(roles[2].description, "Can administer cemeteries with an editable Cemetery admin membership, including Members and Policies. Other memberships retain their own roles; system access is separate.");
});

test("listAssignableRoles includes power-user for admin user forms", async () => {
  const pool = fakePool([
    {
      role_name: "reader",
      description: "Reader from database",
      user_count: 2,
    },
    {
      role_name: "power-user",
      description: "Power user from database",
      user_count: 1,
    },
    {
      role_name: "admin",
      description: "Admin from database",
      user_count: 1,
    },
  ]);

  assert.deepEqual(await listAssignableRoles(pool), ["reader", "power-user", "cemetery-admin", "admin"]);
});
