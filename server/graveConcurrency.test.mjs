import assert from "node:assert/strict";
import test from "node:test";
import { updateGraveSpaceMutation } from "./cemeteryGraveMutations.mjs";
import { ConflictError } from "./requestValidation.mjs";
import { validateGraveSpacePayload } from "./routes/cemeteryRouteValidation.mjs";

test("stale grave edits roll back without updating or auditing the record", async () => {
  const queries = [];
  const pool = { async connect() { return {
    async query(sql) {
      queries.push(sql);
      if (sql.includes("FOR UPDATE")) return { rows: [{ uuid: "grave", cemetery_id: "cemetery", version: "2" }] };
      return { rows: [] };
    }, release() { queries.push("RELEASE"); },
  }; } };
  await assert.rejects(updateGraveSpaceMutation(pool, "cemetery", "A", { expectedVersion: "1" }, {}, () => {}), ConflictError);
  assert.ok(!queries.some((sql) => sql.includes("UPDATE gravesites") || sql.includes("INSERT INTO audit_events")));
  assert.deepEqual(queries.slice(-2), ["ROLLBACK", "RELEASE"]);
});

test("grave updates require an opaque version obtained from the read API", () => {
  assert.throws(() => validateGraveSpacePayload({ name: "Name" }), /Record version/);
  assert.throws(() => validateGraveSpacePayload({ expectedVersion: "bad" }), /Record version/);
  assert.equal(validateGraveSpacePayload({ expectedVersion: "123" }).expectedVersion, "123");
});
