import assert from "node:assert/strict";
import test from "node:test";
import { searchCemetery } from "./cemeterySearch.mjs";
import { validateBurialPayload } from "./routes/cemeteryRouteValidation.mjs";
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
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            {
              has_veteran_column: true,
              has_legacy_military_branch_column: false,
              has_legacy_military_wars_column: false,
              has_military_branch_lookup: true,
              has_military_war_service_lookup: true,
              has_military_rank_lookup: true,
            },
          ],
        };
      }
      assert.match(sql, /JOIN gravesite_status_types status_type|LEFT JOIN gravesite_status_types status_type/u);
      assert.match(sql, /CROSS JOIN LATERAL/u);
      assert.match(sql, /FROM burials status_burials/u);
      assert.match(sql, /FROM current_ownership_right_owners status_rights/u);
      assert.match(sql, /OR derived_status\.status = ANY\(\$2::text\[\]\)/u);
      assert.match(sql, /SELECT 'Cemetery'/u);
      assert.match(sql, /SELECT 'Cemetery facility ID'/u);
      assert.match(sql, /SELECT 'Lot name'/u);
      assert.match(sql, /SELECT 'Lot number'/u);
      assert.match(sql, /SELECT 'Veteran'/u);
      assert.match(sql, /SELECT 'Military branch'/u);
      assert.match(sql, /SELECT 'Military rank'/u);
      assert.match(sql, /SELECT 'War service'/u);
      assert.doesNotMatch(sql, /SELECT 'Cemetery ID'/u);
      assert.doesNotMatch(sql, /SELECT 'Lot ID'/u);
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

test("burial payload validation accepts recorded cemetery date text", () => {
  const basePayload = {
    firstName: "Henry",
    lastName: "McWilliams",
    maidenName: "Smith",
    birthDate: "1909",
    deathDate: "Dec 16, 1965",
    burialDate: "",
    intermentType: "casket",
    funeralHome: "",
    veteran: false,
    militaryBranchCode: "",
    militaryRankCode: "",
    militaryWarServiceCode: "",
    notes: "",
  };

  assert.equal(validateBurialPayload(basePayload).deathDate, "Dec 16, 1965");
  assert.equal(validateBurialPayload(basePayload).maidenName, "Smith");
  assert.equal(validateBurialPayload({ ...basePayload, deathPlaceId: "12121212-1212-4121-8121-121212121212" }).deathPlaceId, "12121212-1212-4121-8121-121212121212");
  assert.equal(validateBurialPayload({ ...basePayload, birthDate: "Nov. 1929," }).birthDate, "Nov. 1929,");
  assert.equal(validateBurialPayload({ ...basePayload, deathDate: "December 16 1965" }).deathDate, "December 16 1965");
});

test("burial payload validation rejects an invalid death place identifier", () => {
  assertBadRequest(
    () =>
      validateBurialPayload({
        firstName: "William",
        lastName: "Wiskeman",
        birthDate: "1898",
        deathDate: "1955-05-10",
        deathPlaceId: "Jonesboro",
        burialDate: "1955-06-06",
        intermentType: "urn",
        funeralHome: "",
        veteran: false,
        militaryBranchCode: "",
        militaryRankCode: "",
        militaryWarServiceCode: "",
        notes: "",
      }),
    "Death place must be a UUID.",
  );
});

test("burial payload validation rejects unsupported date text", () => {
  assertBadRequest(
    () =>
      validateBurialPayload({
        firstName: "Henry",
        lastName: "McWilliams",
        birthDate: "winter 1909",
        deathDate: "",
        burialDate: "",
        intermentType: "casket",
        funeralHome: "",
        veteran: false,
        militaryBranchCode: "",
        militaryRankCode: "",
        militaryWarServiceCode: "",
        notes: "",
      }),
    "Birth date must use YYYY, YYYY-MM, YYYY-MM-DD, Month YYYY, or Month DD YYYY format.",
  );
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
      if (sql.includes("information_schema.columns")) {
        return {
          rows: [
            {
              has_veteran_column: true,
              has_legacy_military_branch_column: false,
              has_legacy_military_wars_column: false,
              has_military_branch_lookup: true,
              has_military_war_service_lookup: true,
            },
          ],
        };
      }
      assert.match(sql, /current_ownership_right_owners/);
      assert.deepEqual(values, ["baur", [], false, []]);
      return { rows: [] };
    },
  };

  const matches = await searchCemetery(pool, { query: "Baur", statuses: [], includeOwnership: false, ownershipCemeteryIds: [] });

  assert.deepEqual(matches, []);
});

test("search returns cemetery name and lot field reasons", async () => {
  const pool = {
    async query(_sql, values) {
      if (_sql.includes("information_schema.columns")) {
        return {
          rows: [
            {
              has_veteran_column: true,
              has_legacy_military_branch_column: false,
              has_legacy_military_wars_column: false,
              has_military_branch_lookup: true,
              has_military_war_service_lookup: true,
            },
          ],
        };
      }
      assert.deepEqual(values, ["trinity", [], true, undefined]);
      return {
        rows: [
          {
            cemetery_id: "11111111-1111-4111-8111-111111111111",
            cemetery_name: "Trinity Lutheran Church Cemetery",
            section_id: "OC",
            lot_id: "61",
            grave_id: "1",
            gravesite_id: "OC-61-1",
            status: "available",
            geometry: null,
            reason_label: "Cemetery",
            reason_value: "Trinity Lutheran Church Cemetery",
          },
          {
            cemetery_id: "11111111-1111-4111-8111-111111111111",
            cemetery_name: "Trinity Lutheran Church Cemetery",
            section_id: "OC",
            lot_id: "61",
            grave_id: "1",
            gravesite_id: "OC-61-1",
            status: "available",
            geometry: null,
            reason_label: "Lot name",
            reason_value: "Lot 61",
          },
          {
            cemetery_id: "11111111-1111-4111-8111-111111111111",
            cemetery_name: "Trinity Lutheran Church Cemetery",
            section_id: "OC",
            lot_id: "61",
            grave_id: "1",
            gravesite_id: "OC-61-1",
            status: "available",
            geometry: null,
            reason_label: "Lot number",
            reason_value: "61",
          },
        ],
      };
    },
  };

  const matches = await searchCemetery(pool, { query: "Trinity", statuses: [] });

  assert.equal(matches.length, 1);
  assert.deepEqual(matches[0].reasons, ["Cemetery: Trinity Lutheran Church Cemetery", "Lot name: Lot 61", "Lot number: 61"]);
});
