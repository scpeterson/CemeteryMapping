import assert from "node:assert/strict";
import test from "node:test";
import { getCemeteryData, getDetailedCemeteryData, getGraveSpace } from "./cemeteryRepository.mjs";

function queryRows(sql) {
  if (sql.includes("information_schema.columns")) return [{ exists: true }];
  if (sql.includes("FROM cemeteries")) {
    return [{ id: "11111111-1111-4111-8111-111111111111", name: "Sequential Cemetery", geometry: "{}" }];
  }
  if (sql.includes("FROM sections")) return [];
  if (sql.includes("FROM lots")) return [];
  if (sql.includes("FROM gravesites") && sql.includes("LIMIT 1")) {
    return [
      {
        uuid: "22222222-2222-4222-8222-222222222222",
        cemetery_id: "11111111-1111-4111-8111-111111111111",
        cemetery_name: "Sequential Cemetery",
        section_id: "A",
        lot_id: "1",
        grave_id: "1",
        gravesite_id: "A-01-01",
        status: "occupied",
        geometry: "{}",
      },
    ];
  }
  if (sql.includes("ST_AsGeoJSON(headstones.geometry)::json")) {
    return [
      {
        id: "33333333-3333-4333-8333-333333333333",
        headstone_id: "HS-1",
        cemetery_id: "11111111-1111-4111-8111-111111111111",
        cemetery_name: "Sequential Cemetery",
        gravesite_id: "A-01-01",
        marker_type_label: "Upright headstone",
        condition_code: "good",
        geometry: '{"type":"Point","coordinates":[-80,40]}',
      },
    ];
  }
  if (sql.includes("FROM gravesites")) return [];
  if (sql.includes("FROM owners")) return [];
  if (sql.includes("FROM burials")) return [];
  if (sql.includes("FROM north_hills_ocr_entry_gravesite_links")) return [];
  if (sql.includes("FROM headstones")) {
    return [
      {
        id: "33333333-3333-4333-8333-333333333333",
        headstone_id: "HS-1",
        marker_type_id: "44444444-4444-4444-8444-444444444444",
        marker_type_code: "upright_headstone",
        marker_type_label: "Upright headstone",
        material_id: "55555555-5555-4555-8555-555555555555",
        material_code: "granite",
        material_label: "Granite",
        condition_id: "66666666-6666-4666-8666-666666666666",
        condition_code: "good",
        condition_label: "Good",
        condition_notes: "Stable and legible",
        inscription: "In memory",
        photo_url: "",
        last_inspected_at: "2026-05-28",
        relationship_type: "primary",
        relationship_notes: "",
        burial_ids: [],
      },
    ];
  }
  throw new Error(`Unexpected query: ${sql}`);
}

function strictSequentialPool() {
  return {
    async connect() {
      let activeQueries = 0;
      return {
        async query(sql) {
          activeQueries += 1;
          assert.equal(activeQueries, 1, "queries on a checked-out pg client must not overlap");
          await Promise.resolve();
          activeQueries -= 1;
          return { rows: queryRows(sql) };
        },
        release() {},
      };
    },
  };
}

test("repository read queries do not overlap on the same pg client", async () => {
  const pool = strictSequentialPool();

  await getCemeteryData(pool);
  await getDetailedCemeteryData(pool);
  await getGraveSpace(pool, "11111111-1111-4111-8111-111111111111", "A-01-01");
});

test("cemetery map data includes lightweight headstone point summaries", async () => {
  const data = await getCemeteryData(strictSequentialPool());

  assert.deepEqual(data.headstones[0], {
    id: "33333333-3333-4333-8333-333333333333",
    headstoneId: "HS-1",
    cemeteryId: "11111111-1111-4111-8111-111111111111",
    cemeteryName: "Sequential Cemetery",
    gravesiteId: "A-01-01",
    graveKey: "11111111-1111-4111-8111-111111111111:A-01-01",
    label: "HS-1",
    markerType: "Upright headstone",
    condition: "good",
    geometry: { type: "Point", coordinates: [-80, 40] },
  });
});

test("repository can redact ownership data from grave detail reads", async () => {
  let ownerQueryCount = 0;
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql.includes("FROM owners")) ownerQueryCount += 1;
          return { rows: queryRows(sql) };
        },
        release() {},
      };
    },
  };

  const grave = await getGraveSpace(pool, "11111111-1111-4111-8111-111111111111", "A-01-01", { includeOwnership: false });

  assert.equal(ownerQueryCount, 0);
  assert.deepEqual(grave.owners, []);
  assert.deepEqual(grave.currentOwnerIds, []);
  assert.deepEqual(grave.ownershipHistory, []);
  assert.equal(grave.headstones[0].condition.label, "Good");
});
