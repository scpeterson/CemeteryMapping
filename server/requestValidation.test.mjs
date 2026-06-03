import assert from "node:assert/strict";
import test from "node:test";
import { searchCemetery } from "./cemeterySearch.mjs";
import {
  BadRequestError,
  validateCemeteryId,
  validateGraveSpaceId,
  validateMutationReason,
  validateSearchQuery,
  validateStatuses,
} from "./requestValidation.mjs";

function assertBadRequest(fn, message) {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof BadRequestError, true);
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, message);
    return true;
  });
}

function emptyCemeteryPool() {
  let queryCount = 0;
  return {
    get queryCount() {
      return queryCount;
    },
    async query(sql, values) {
      queryCount += 1;
      assert.match(sql, /JOIN gravesite_status_types status_type|LEFT JOIN gravesite_status_types status_type/u);
      assert.match(sql, /CROSS JOIN LATERAL/u);
      assert.match(sql, /FROM burials status_burials/u);
      assert.match(sql, /FROM current_ownership_right_owners status_rights/u);
      assert.match(sql, /OR derived_status\.status = ANY\(\$2::text\[\]\)/u);
      assert.doesNotMatch(sql, /WITH status_labels/u);
      assert.deepEqual(values, ["garcia'; drop table gravesites; --", [], true, undefined]);
      return { rows: [] };
    },
  };
}

test("grave space id validation rejects SQL-like ids", () => {
  assertBadRequest(
    () => validateGraveSpaceId("A-01-01' OR '1'='1"),
    "Grave space id must be 1-30 characters and contain only letters, numbers, underscores, or hyphens.",
  );
});

test("grave space id validation accepts current demo and imported id shapes", () => {
  assert.equal(validateGraveSpaceId("A-01-01"), "A-01-01");
  assert.equal(validateGraveSpaceId("TLC-GPS-0042"), "TLC-GPS-0042");
});

test("cemetery id validation requires a UUID", () => {
  assert.equal(validateCemeteryId("87ab43c8-3281-4e7c-b034-8d5a7b0f8b31"), "87ab43c8-3281-4e7c-b034-8d5a7b0f8b31");
  assertBadRequest(() => validateCemeteryId("DEMO-ST-MARK"), "Cemetery id must be a valid UUID.");
});

test("search validation rejects oversized queries", () => {
  assertBadRequest(() => validateSearchQuery("x".repeat(121)), "Search query must be 120 characters or fewer.");
});

test("search validation treats SQL-like query text as plain data when it is within limits", () => {
  assert.equal(validateSearchQuery("Garcia'; DROP TABLE gravesites; --"), "Garcia'; DROP TABLE gravesites; --");
});

test("status validation rejects unsupported SQL-like status filters", () => {
  assertBadRequest(
    () => validateStatuses("occupied'); DROP TABLE gravesites; --"),
    "Unsupported grave status: occupied'); drop table gravesites; --.",
  );
});

test("status validation accepts comma-separated known statuses", () => {
  assert.deepEqual(validateStatuses("available,occupied,sold,reserved,needs_review,unknown"), [
    "available",
    "occupied",
    "sold",
    "reserved",
    "needs_review",
    "unknown",
  ]);
});

test("mutation reason validation rejects oversized reasons", () => {
  assertBadRequest(() => validateMutationReason("x".repeat(501)), "Reason must be 500 characters or fewer.");
});

test("mutation reason validation trims empty reasons to undefined", () => {
  assert.equal(validateMutationReason("   "), undefined);
});

test("search runs SQL-like text without expanding results or building dynamic SQL", async () => {
  const pool = emptyCemeteryPool();
  const matches = await searchCemetery(pool, { query: validateSearchQuery("Garcia'; DROP TABLE gravesites; --"), statuses: [] });

  assert.deepEqual(matches, []);
  assert.equal(pool.queryCount, 1);
});

test("search includes generalized ownership rights only through ownership-aware search", async () => {
  const pool = {
    async query(sql, values) {
      assert.match(sql, /current_ownership_right_owners/);
      assert.deepEqual(values, ["baur", [], false, []]);
      return { rows: [] };
    },
  };

  const matches = await searchCemetery(pool, { query: "Baur", statuses: [], includeOwnership: false, ownershipCemeteryIds: [] });

  assert.deepEqual(matches, []);
});
