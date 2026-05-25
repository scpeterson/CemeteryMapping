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
    ["reader", "power-user", "admin"],
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
    ["reader", "power-user", "admin"],
  );
  assert.equal(
    roles[1].description,
    "Can view cemetery records, view and edit deed/owner information, and update existing cemetery records.",
  );
  assert.equal(roles[1].userCount, 0);
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

  assert.deepEqual(await listAssignableRoles(pool), ["reader", "power-user", "admin"]);
});
