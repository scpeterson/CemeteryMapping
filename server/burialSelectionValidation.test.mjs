import assert from "node:assert/strict";
import test from "node:test";
import { updateBurial } from "./cemeteryBurialMutations.mjs";
import { BadRequestError } from "./requestValidation.mjs";

for (const [unavailable, message] of [
  ["burial_interment_types", /Interment type is no longer available/],
  ["burial_record_status_types", /Burial record status is no longer available/],
  ["places", /Death place is no longer available/],
  ["decorations", /military decorations are no longer available/],
]) {
  test(`unavailable ${unavailable} is a user validation error and rolls back`, async () => {
    const statements = [];
    let released = false;
    const client = {
      async query(sql) {
        statements.push(sql);
        if (sql.includes("SELECT EXISTS") || sql.includes("AS exists")) {
          return { rows: [{ exists: !sql.includes(`FROM ${unavailable}`) }] };
        }
        if (sql.includes("FROM burials")) return { rows: [{ id: "burial-1", cemetery_id: "cemetery-1" }] };
        if (sql.includes("UPDATE burials")) return { rows: [{ id: "burial-1" }] };
        return { rows: [] };
      },
      release() { released = true; },
    };
    await assert.rejects(updateBurial({ connect: async () => client }, "burial-1", {
      firstName: "Alice", intermentType: "casket", recordStatusCode: "interred", deathPlaceId: "place-1",
      veteran: unavailable === "decorations", militaryDecorationCodes: ["missing"],
    }), (error) => error instanceof BadRequestError && message.test(error.message));
    assert.ok(statements.includes("ROLLBACK"));
    assert.ok(!statements.includes("COMMIT"));
    assert.ok(released);
  });
}
