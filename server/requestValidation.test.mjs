import assert from "node:assert/strict";
import test from "node:test";
import { searchCemetery } from "./cemeterySearch.mjs";
import {
  BadRequestError,
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
  let connectCount = 0;
  return {
    get connectCount() {
      return connectCount;
    },
    async connect() {
      connectCount += 1;
      return {
        async query(sql) {
          if (sql.includes("FROM cemeteries")) return { rows: [] };
          throw new Error(`Unexpected client query: ${sql}`);
        },
        release() {},
      };
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
  assert.deepEqual(validateStatuses("occupied,reserved,unknown"), ["occupied", "reserved", "unknown"]);
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
  assert.equal(pool.connectCount, 1);
});
