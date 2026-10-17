import assert from "node:assert/strict";
import test from "node:test";
import { validateBurialPayload } from "./routes/cemeteryRouteValidation.mjs";
import { toBurial } from "./cemeteryMappers.mjs";
import { updateBurial } from "./cemeteryBurialMutations.mjs";

test("birth place accepts a verified-place identifier, supports clearing, and rejects free text", () => {
  const id = "12121212-1212-4121-8121-121212121212";
  assert.equal(validateBurialPayload({ firstName: "Alice", birthPlaceId: id }).birthPlaceId, id);
  assert.equal(validateBurialPayload({ firstName: "Alice", birthPlaceId: "" }).birthPlaceId, "");
  assert.throws(() => validateBurialPayload({ firstName: "Alice", birthPlaceId: "Pittsburgh" }), /Birth place/);
});

test("birth and death places map independently with their authority links", () => {
  const burial = toBurial({ id: "person", birth_place_id: "birth", birth_place_name: "London", birth_place_authority_url: "https://example.org/birth", death_place_id: "death", death_place_name: "Pittsburgh", death_place_authority_url: "https://example.org/death" });
  assert.equal(burial.birthPlace.displayName, "London");
  assert.equal(burial.birthPlace.authorityUrl, "https://example.org/birth");
  assert.equal(burial.deathPlace.displayName, "Pittsburgh");
  assert.equal(toBurial({ id: "person" }).birthPlace, undefined);
});

test("unavailable birth places reject the save and roll back", async () => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("SELECT EXISTS")) return { rows: [{ exists: !sql.includes("FROM places") }] };
      if (sql.includes("FROM burials")) return { rows: [{ id: "person", cemetery_id: "cemetery" }] };
      return { rows: [] };
    },
    release() {},
  };
  await assert.rejects(updateBurial({ connect: async () => client }, "person", { firstName: "Alice", birthPlaceId: "unavailable" }), /Birth place is no longer available/);
  assert.ok(statements.includes("ROLLBACK"));
  assert.ok(!statements.some((sql) => sql.includes("UPDATE burials")));
});
