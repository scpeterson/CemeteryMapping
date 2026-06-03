import assert from "node:assert/strict";
import test from "node:test";
import { createOwnershipEvent, getCemeteryData, getDetailedCemeteryData, getGraveSpace, updateBurial, updateGraveSpace, updateHeadstone } from "./cemeteryRepository.mjs";

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
  if (sql.includes("FROM gravesite_media_assets")) return [];
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
        media_assets: [],
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
  assert.deepEqual(grave.mediaAssets, []);
});

test("repository maps generalized gravesite ownership rights into owner detail", async () => {
  const graveUuid = "22222222-2222-4222-8222-222222222222";
  const ownerId = "ownership-party-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql.includes("FROM gravesites") && sql.includes("LIMIT 1")) {
            return {
              rows: [
                {
                  uuid: graveUuid,
                  cemetery_id: "11111111-1111-4111-8111-111111111111",
                  cemetery_name: "Sequential Cemetery",
                  section_id: "G",
                  lot_id: null,
                  grave_id: "50",
                  gravesite_id: "G-050",
                  status: "sold",
                  cost: null,
                  geometry: "{}",
                },
              ],
            };
          }
          if (sql.includes("FROM owners") && sql.includes("current_ownership_right_owners")) {
            return {
              rows: [
                {
                  id: ownerId,
                  gravesite_uuid: graveUuid,
                  owner: null,
                  co_owner: null,
                  display_name: "Baur, L & R",
                  full_address: null,
                  phone: null,
                  email: null,
                  sale_date: null,
                  effective_date: null,
                  recorded_at: "2026-06-03T12:00:00.000Z",
                  event_type: "deed",
                  recorded_by: "Section G Plot Plan With Notations.pdf",
                  document_reference: "Section G Plot Plan With Notations.pdf page 2",
                  notes: "burial_right gravesite Imported from page 2 deed holder list.",
                  created_at: "2026-06-03T12:00:00.000Z",
                  ownership_event_id: "ownership-event-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                },
              ],
            };
          }
          if (sql.includes("FROM burials")) return { rows: [] };
          if (sql.includes("FROM headstones")) return { rows: [] };
          if (sql.includes("FROM north_hills_ocr_entry_gravesite_links")) return { rows: [] };
          if (sql.includes("FROM gravesite_media_assets")) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {},
      };
    },
  };

  const grave = await getGraveSpace(pool, "11111111-1111-4111-8111-111111111111", "G-050");

  assert.equal(grave.owners[0].id, ownerId);
  assert.equal(grave.owners[0].displayName, "Baur, L & R");
  assert.match(grave.owners[0].contactNote, /Section G Plot Plan With Notations\.pdf page 2/u);
  assert.deepEqual(grave.currentOwnerIds, [ownerId]);
  assert.deepEqual(grave.ownershipHistory[0], {
    id: "ownership-event-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ownerIds: [ownerId],
    eventType: "purchase",
    effectiveDate: "2026-06-03",
    recordedBy: "Section G Plot Plan With Notations.pdf",
    documentReference: "Section G Plot Plan With Notations.pdf page 2",
    notes: "burial_right gravesite Imported from page 2 deed holder list.",
  });
});

test("repository maps generalized lot ownership rights into grave owner detail", async () => {
  const graveUuid = "22222222-2222-4222-8222-222222222222";
  const lotUuid = "99999999-9999-4999-8999-999999999999";
  const ownerId = "ownership-party-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql.includes("FROM gravesites") && sql.includes("LIMIT 1")) {
            return {
              rows: [
                {
                  uuid: graveUuid,
                  cemetery_id: "11111111-1111-4111-8111-111111111111",
                  cemetery_name: "Sequential Cemetery",
                  section_id: "B",
                  lot_id: "166",
                  lot_uuid: lotUuid,
                  grave_id: "1",
                  gravesite_id: "B-0166-01",
                  status: "sold",
                  cost: null,
                  geometry: "{}",
                },
              ],
            };
          }
          if (sql.includes("FROM owners") && sql.includes("current_ownership_right_owners")) {
            return {
              rows: [
                {
                  id: ownerId,
                  gravesite_uuid: graveUuid,
                  owner: null,
                  co_owner: null,
                  display_name: "Charles R. and Ruth M. Soergel",
                  full_address: null,
                  phone: null,
                  email: null,
                  sale_date: null,
                  effective_date: "2026-05-31",
                  recorded_at: "2026-06-03T12:00:00.000Z",
                  event_type: "deed",
                  recorded_by: "power@example.test",
                  document_reference: "Deed book 1 page 2",
                  notes: "burial_right lot Manual ownership workflow target: selected lot.",
                  created_at: "2026-06-03T12:00:00.000Z",
                  ownership_event_id: "ownership-event-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                },
              ],
            };
          }
          if (sql.includes("FROM burials")) return { rows: [] };
          if (sql.includes("FROM headstones")) return { rows: [] };
          if (sql.includes("FROM north_hills_ocr_entry_gravesite_links")) return { rows: [] };
          if (sql.includes("FROM gravesite_media_assets")) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {},
      };
    },
  };

  const grave = await getGraveSpace(pool, "11111111-1111-4111-8111-111111111111", "B-0166-01");
  const ownershipQuery = queries.find((query) => query.sql.includes("current_ownership_right_owners"))?.sql ?? "";

  assert.match(ownershipQuery, /current_ownership_right_owners\.target_type = 'lot'/u);
  assert.equal(grave.owners[0].displayName, "Charles R. and Ruth M. Soergel");
  assert.deepEqual(grave.currentOwnerIds, [ownerId]);
  assert.equal(grave.ownershipHistory[0].documentReference, "Deed book 1 page 2");
});

test("createOwnershipEvent records a scoped whole-lot ownership event", async () => {
  const queries = [];
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
          if (sql.includes("SELECT set_config")) return { rows: [] };
          if (sql.includes("FROM gravesites") && sql.includes("LIMIT 1")) {
            return {
              rows: [
                {
                  id: "22222222-2222-4222-8222-222222222222",
                  cemetery_id: "11111111-1111-4111-8111-111111111111",
                  gravesite_id: "B-0166-01",
                  lot_uuid: "99999999-9999-4999-8999-999999999999",
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO ownership_parties")) return { rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] };
          if (sql.includes("INSERT INTO ownership_events")) return { rows: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }] };
          if (sql.includes("INSERT INTO ownership_event_parties")) return { rows: [] };
          if (sql.includes("INSERT INTO ownership_event_rights")) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const created = await createOwnershipEvent(
    pool,
    "11111111-1111-4111-8111-111111111111",
    "B-0166-01",
    {
      ownerDisplayName: "Charles R. and Ruth M. Soergel",
      eventType: "deed",
      targetScope: "selected_lot",
      effectiveDate: "2026-05-31",
      documentReference: "Deed book 1 page 2",
      notes: "Entered from scanned deed.",
    },
    {
      actorUser: { email: "power@example.test" },
      allowedCemeteryIds: ["11111111-1111-4111-8111-111111111111"],
    },
  );

  const eventQuery = queries.find((query) => query.sql.includes("INSERT INTO ownership_events"));
  const rightQuery = queries.find((query) => query.sql.includes("INSERT INTO ownership_event_rights"));

  assert.deepEqual(created, { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
  assert.deepEqual(eventQuery?.values, [
    "11111111-1111-4111-8111-111111111111",
    "deed",
    "2026-05-31",
    "power@example.test",
    "Deed book 1 page 2",
    "Entered from scanned deed.",
  ]);
  assert.deepEqual(rightQuery?.values, [
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "lot",
    "99999999-9999-4999-8999-999999999999",
    null,
    "burial_right | lot | Manual ownership workflow target: selected lot.",
  ]);
});

test("updateHeadstone mutation state query qualifies joined id columns", async () => {
  const queries = [];
  const headstoneRow = {
    id: "33333333-3333-4333-8333-333333333333",
    cemetery_id: "11111111-1111-4111-8111-111111111111",
    headstone_id: "HS-1",
    marker_type_id: "44444444-4444-4444-8444-444444444444",
    marker_type_code: "upright_headstone",
    marker_type_label: "Upright headstone",
    material_id: "55555555-5555-4555-8555-555555555555",
    material_type_id: "55555555-5555-4555-8555-555555555555",
    material_type_code: "granite",
    material_code: "granite",
    material_label: "Granite",
    condition_id: "66666666-6666-4666-8666-666666666666",
    condition_type_id: "66666666-6666-4666-8666-666666666666",
    condition_type_code: "good",
    condition_code: "good",
    condition_label: "Good",
    condition: "good",
    condition_notes: "Stable and legible",
    inscription: "In memory",
    photo_url: "",
    last_inspected_at: "2026-05-28",
    updated_at: "2026-05-31T12:00:00.000Z",
    relationship_type: "primary",
    relationship_notes: "",
    burial_ids: [],
    north_hills_evidence: [],
    media_assets: [],
  };
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
          if (sql.includes("SELECT set_config")) return { rows: [] };
          if (sql.includes("FOR UPDATE")) return { rows: [headstoneRow] };
          if (sql.includes("UPDATE headstones")) return { rows: [headstoneRow] };
          if (sql.includes("FROM audit_events") && sql.includes("transaction_id")) return { rows: [] };
          if (sql.includes("INSERT INTO audit_events")) return { rows: [{ id: "77777777-7777-4777-8777-777777777777" }] };
          if (sql.includes("FROM headstones") && sql.includes("WHERE headstones.id = $1")) return { rows: [headstoneRow] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const updated = await updateHeadstone(pool, "33333333-3333-4333-8333-333333333333", {
    markerTypeId: "44444444-4444-4444-8444-444444444444",
    materialId: "55555555-5555-4555-8555-555555555555",
    conditionId: "66666666-6666-4666-8666-666666666666",
    conditionNotes: "Stable and legible",
    inscription: "In memory",
    photoUrl: "",
    lastInspectedAt: "2026-05-28",
  });

  const mutationStateQuery = queries.find((query) => query.sql.includes("FOR UPDATE"))?.sql ?? "";
  assert.match(mutationStateQuery, /headstones\.id::text/u);
  assert.match(mutationStateQuery, /FOR UPDATE OF headstones/u);
  assert.doesNotMatch(mutationStateQuery, /SELECT\s+id::text,/u);
  assert.equal(updated?.id, "33333333-3333-4333-8333-333333333333");
});

test("updateGraveSpace updates editable gravesite fields with cemetery scope", async () => {
  const queries = [];
  const graveRow = {
    uuid: "22222222-2222-4222-8222-222222222222",
    cemetery_id: "11111111-1111-4111-8111-111111111111",
    cemetery_name: "Trinity Lutheran Church Cemetery",
    section_id: "C",
    lot_id: "166",
    grave_id: "0166A",
    gravesite_id: "TLC-GPS-0166-01",
    name: "Ruth M. Soergel",
    status_type_id: "99999999-9999-4999-8999-999999999999",
    status: "occupied",
    cost: "1200.00",
    geometry: { type: "MultiPolygon", coordinates: [] },
    updated_at: "2026-05-31T12:00:00.000Z",
  };
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
          if (sql.includes("SELECT set_config")) return { rows: [] };
          if (sql.includes("FOR UPDATE")) return { rows: [graveRow] };
          if (sql.includes("UPDATE gravesites")) return { rows: [graveRow] };
          if (sql.includes("FROM audit_events") && sql.includes("transaction_id")) return { rows: [] };
          if (sql.includes("INSERT INTO audit_events")) return { rows: [{ id: "77777777-7777-4777-8777-777777777777" }] };
          if (sql.includes("FROM gravesites") && sql.includes("LIMIT 1")) return { rows: [graveRow] };
          if (sql.includes("FROM owners")) return { rows: [] };
          if (sql.includes("FROM burials")) return { rows: [] };
          if (sql.includes("FROM headstones")) return { rows: [] };
          if (sql.includes("FROM north_hills_ocr_entry_gravesite_links")) return { rows: [] };
          if (sql.includes("FROM gravesite_media_assets")) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const updated = await updateGraveSpace(
    pool,
    "11111111-1111-4111-8111-111111111111",
    "TLC-GPS-0166-01",
    {
      name: "Ruth M. Soergel",
      status: "occupied",
      cost: 1200,
    },
    { allowedCemeteryIds: ["11111111-1111-4111-8111-111111111111"] },
  );

  const updateQuery = queries.find((query) => query.sql.includes("UPDATE gravesites"));
  assert.match(updateQuery?.sql ?? "", /SET name = \$2/u);
  assert.match(updateQuery?.sql ?? "", /status_type_id = \(/u);
  assert.doesNotMatch(updateQuery?.sql ?? "", /status = \$3/u);
  assert.deepEqual(updateQuery?.values, ["22222222-2222-4222-8222-222222222222", "Ruth M. Soergel", "occupied", 1200]);
  assert.equal(updated?.name, "Ruth M. Soergel");
  assert.equal(updated?.status, "occupied");
  assert.equal(updated?.cost, 1200);
});

test("updateBurial updates person and date fields with cemetery scope", async () => {
  const queries = [];
  const burialRow = {
    id: "88888888-8888-4888-8888-888888888888",
    cemetery_id: "11111111-1111-4111-8111-111111111111",
    gravesite_uuid: "22222222-2222-4222-8222-222222222222",
    first_name: "Ruth M.",
    last_name: "Soergel",
    full_name: "Ruth M. Soergel",
    birth_date: "1925-10-04",
    death_date: "2017-10-22",
    burial_date: null,
    interment_type: "urn",
    funeral_home: null,
    notes: "Imported note",
    updated_at: "2026-05-31T12:00:00.000Z",
  };
  const pool = {
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
          if (sql.includes("SELECT set_config")) return { rows: [] };
          if (sql.includes("FOR UPDATE OF burials")) return { rows: [burialRow] };
          if (sql.includes("UPDATE burials")) return { rows: [burialRow] };
          if (sql.includes("FROM audit_events") && sql.includes("transaction_id")) return { rows: [] };
          if (sql.includes("INSERT INTO audit_events")) return { rows: [{ id: "77777777-7777-4777-8777-777777777777" }] };
          if (sql.includes("FROM burials") && sql.includes("LIMIT 1")) return { rows: [burialRow] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {
          queries.push({ sql: "RELEASE", values: [] });
        },
      };
    },
  };

  const updated = await updateBurial(
    pool,
    "88888888-8888-4888-8888-888888888888",
    {
      firstName: "Ruth M.",
      lastName: "Soergel",
      birthDate: "1925-10-04",
      deathDate: "2017-10-22",
      burialDate: "",
      intermentType: "urn",
      funeralHome: "Brandt Funeral Home",
      notes: "Confirmed from marker photo.",
    },
    { allowedCemeteryIds: ["11111111-1111-4111-8111-111111111111"] },
  );

  const updateQuery = queries.find((query) => query.sql.includes("UPDATE burials"));
  assert.match(updateQuery?.sql ?? "", /SET first_name = \$2/u);
  assert.deepEqual(updateQuery?.values, [
    "88888888-8888-4888-8888-888888888888",
    "Ruth M.",
    "Soergel",
    "Ruth M. Soergel",
    "1925-10-04",
    "2017-10-22",
    null,
    "urn",
    "Brandt Funeral Home",
    "Confirmed from marker photo.",
  ]);
  assert.equal(updated?.person.firstName, "Ruth M.");
  assert.equal(updated?.person.lastName, "Soergel");
  assert.equal(updated?.person.birthDate, "1925-10-04");
  assert.equal(updated?.person.deathDate, "2017-10-22");
  assert.equal(updated?.intermentType, "urn");
  assert.equal(updated?.recordNotes, "Imported note");
});
