import assert from "node:assert/strict";
import test from "node:test";
import { getHeadstoneOverview } from "./markerOverviewRepository.mjs";
import { registerHeadstoneRoutes } from "./routes/headstoneRoutes.mjs";

for (const visible of [false, true]) {
  test(`marker overview batches people and scopes ownership (${visible})`, async () => {
    const calls = [];
    const pool = { async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("FROM headstones h")) return { rows: [
        { marker_id: "m", uuid: "g1", cemetery_id: "a", gravesite_id: "1" },
        { marker_id: "m", uuid: "g2", cemetery_id: "b", gravesite_id: "2" },
      ] };
      if (sql.includes("FROM burials")) return { rows: [{ id: "b1", gravesite_uuid: "g1", first_name: "Alice", birth_date_text: "1901" }] };
      assert.deepEqual(values, [["g1"]]);
      return { rows: [{ id: "o1", gravesite_uuid: "g1", display_name: "Owner", full_address: "Private address" }] };
    } };
    const result = await getHeadstoneOverview(pool, "m", { canViewOwnership: (id) => visible && id === "a" });
    assert.equal(calls.length, visible ? 3 : 2);
    assert.equal(result[0].burials[0].person.birthDate, "1901");
    assert.deepEqual(Object.keys(result[0].burials[0]).sort(), ["id", "person"]);
    assert.equal(result[0].owners.length, visible ? 1 : 0);
    assert.deepEqual(result[1].owners, []);
    assert.ok(!JSON.stringify(result).includes("Private address"));
  });
}

test("absent and standalone markers do not load related data", async () => {
  assert.equal(await getHeadstoneOverview({ query: async () => ({ rows: [] }) }, "missing"), undefined);
  assert.deepEqual(await getHeadstoneOverview({ query: async () => ({ rows: [{ marker_id: "m", uuid: null }] }) }, "m"), []);
});

test("marker overview route requires reader access and delegates cemetery ownership checks", async () => {
  let registered;
  const requireReader = () => {};
  registerHeadstoneRoutes({ get(path, ...handlers) { if (path.endsWith("/overview")) registered = handlers; }, post() {}, patch() {}, delete() {} }, {
    requireReader, validateUuid: (id) => id,
    canViewOwnershipForCemetery: (user, cemetery) => user.role === "admin" && cemetery === "a",
    getHeadstoneOverview: async (_pool, _id, options) => {
      assert.equal(options.canViewOwnership("a"), true);
      assert.equal(options.canViewOwnership("b"), false);
      return [];
    },
  });
  assert.equal(registered[0], requireReader);
  let response;
  await registered.at(-1)({ params: { id: "m" }, user: { role: "admin" } }, { json(value) { response = value; } }, (error) => { throw error; });
  assert.deepEqual(response, []);
});
