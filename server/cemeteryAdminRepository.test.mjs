import assert from "node:assert/strict";
import test from "node:test";
import { listCemeteryAdminRecords, updateCemeteryText, updateLotText, updateSectionText } from "./cemeteryAdminRepository.mjs";

function transactionPool(queryHandler) {
  return {
    async connect() {
      return {
        async query(sql, values) {
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
          if (String(sql).includes("set_config")) return { rows: [] };
          return queryHandler(sql, values);
        },
        release() {},
      };
    },
  };
}

test("listCemeteryAdminRecords returns editable cemetery, section, and lot text", async () => {
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql.includes("information_schema.columns")) return { rows: [{ exists: true }] };
          if (sql.includes("FROM cemeteries")) {
            return {
              rows: [
                {
                  id: "cemetery-1",
                  name: "St. Mark",
                  full_address: "100 Church Road",
                  municipality: "North Hills",
                  agency: "Church",
                  agency_url: "https://example.test",
                  operational_hours: "Dawn to dusk",
                  contact_name: "Pat Admin",
                  contact_phone: "412-555-1212",
                  contact_email: "pat@example.test",
                  image_url: "https://example.test/cemetery.jpg",
                  notes: "Main cemetery",
                  created_at: "2026-01-01T12:00:00.000Z",
                  updated_at: "2026-01-02T12:00:00.000Z",
                },
              ],
            };
          }
          if (sql.includes("FROM sections")) {
            return {
              rows: [
                {
                  id: "section-1",
                  cemetery_id: "cemetery-1",
                  name: "B",
                  alternate_names: ["OC", "Original Cemetery"],
                  notes: "Section notes",
                  created_at: "2026-01-01T12:30:00.000Z",
                  updated_at: "2026-01-02T12:30:00.000Z",
                },
              ],
            };
          }
          if (sql.includes("FROM lots")) {
            return {
              rows: [
                {
                  id: "lot-1",
                  cemetery_id: "cemetery-1",
                  section_id: "B",
                  lot_id: "12",
                  name: "Lot 12",
                  created_at: "2026-01-01T13:00:00.000Z",
                  updated_at: "2026-01-02T13:00:00.000Z",
                },
              ],
            };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {},
      };
    },
  };

  assert.deepEqual(await listCemeteryAdminRecords(pool), {
    cemeteries: [
      {
        id: "cemetery-1",
        name: "St. Mark",
        fullAddress: "100 Church Road",
        municipality: "North Hills",
        agency: "Church",
        agencyUrl: "https://example.test",
        operationalHours: "Dawn to dusk",
        contactName: "Pat Admin",
        contactPhone: "412-555-1212",
        contactEmail: "pat@example.test",
        imageUrl: "https://example.test/cemetery.jpg",
        notes: "Main cemetery",
        createdAt: "2026-01-01T12:00:00.000Z",
        updatedAt: "2026-01-02T12:00:00.000Z",
      },
    ],
    sections: [
      {
        id: "section-1",
        cemeteryId: "cemetery-1",
        sectionId: "B",
        name: "B",
        alternateNames: ["OC", "Original Cemetery"],
        notes: "Section notes",
        createdAt: "2026-01-01T12:30:00.000Z",
        updatedAt: "2026-01-02T12:30:00.000Z",
      },
    ],
    lots: [
      {
        id: "lot-1",
        cemeteryId: "cemetery-1",
        sectionId: "B",
        lotId: "12",
        name: "Lot 12",
        createdAt: "2026-01-01T13:00:00.000Z",
        updatedAt: "2026-01-02T13:00:00.000Z",
      },
    ],
  });
});

test("updateCemeteryText saves all editable cemetery text fields", async () => {
  let queryValues;
  const pool = transactionPool((_sql, values) => {
    queryValues = values;
    return {
      rows: [
        {
          id: values[0],
          name: values[1],
          full_address: values[2],
          municipality: values[3],
          agency: values[4],
          agency_url: values[5],
          operational_hours: values[6],
          contact_name: values[7],
          contact_phone: values[8],
          contact_email: values[9],
          image_url: values[10],
          notes: values[11],
          created_at: "2026-01-01T12:00:00.000Z",
          updated_at: "2026-01-03T12:00:00.000Z",
        },
      ],
    };
  });

  const cemetery = await updateCemeteryText(pool, "cemetery-1", {
    name: "St. Mark",
    fullAddress: "100 Church Road",
    municipality: "North Hills",
    agency: "Church",
    agencyUrl: "https://example.test",
    operationalHours: "Dawn to dusk",
    contactName: "Pat Admin",
    contactPhone: "412-555-1212",
    contactEmail: "pat@example.test",
    imageUrl: "https://example.test/cemetery.jpg",
    notes: "Main cemetery",
  });

  assert.deepEqual(queryValues, [
    "cemetery-1",
    "St. Mark",
    "100 Church Road",
    "North Hills",
    "Church",
    "https://example.test",
    "Dawn to dusk",
    "Pat Admin",
    "412-555-1212",
    "pat@example.test",
    "https://example.test/cemetery.jpg",
    "Main cemetery",
  ]);
  assert.equal(cemetery.contactEmail, "pat@example.test");
  assert.equal(cemetery.updatedAt, "2026-01-03T12:00:00.000Z");
});

test("updateSectionText deduplicates and trims alternate names", async () => {
  let queryValues;
  const pool = transactionPool((sql, values) => {
    if (sql.includes("information_schema.columns")) return { rows: [{ exists: true }] };
    queryValues = values;
    return {
      rows: [
        {
          id: "section-1",
          cemetery_id: "cemetery-1",
          name: "B",
          alternate_names: values[2],
          notes: values[3],
          created_at: "2026-01-01T12:30:00.000Z",
          updated_at: "2026-01-03T12:30:00.000Z",
        },
      ],
    };
  });

  const section = await updateSectionText(pool, "section-1", {
    name: "Section B",
    alternateNames: ["OC", " Original Cemetery ", "OC", ""],
    notes: "Section notes",
  });

  assert.deepEqual(queryValues, ["section-1", "Section B", ["OC", "Original Cemetery"], "Section notes"]);
  assert.deepEqual(section.alternateNames, ["OC", "Original Cemetery"]);
  assert.equal(section.notes, "Section notes");
  assert.equal(section.updatedAt, "2026-01-03T12:30:00.000Z");
});

test("updateLotText returns lot audit timestamps", async () => {
  let queryValues;
  const pool = transactionPool((_sql, values) => {
    queryValues = values;
    return {
      rows: [
        {
          id: values[0],
          cemetery_id: "cemetery-1",
          section_id: "B",
          lot_id: "12",
          name: values[1],
          created_at: "2026-01-01T13:00:00.000Z",
          updated_at: "2026-01-03T13:00:00.000Z",
        },
      ],
    };
  });

  const lot = await updateLotText(pool, "lot-1", { name: "Lot 12" });

  assert.deepEqual(queryValues, ["lot-1", "Lot 12"]);
  assert.equal(lot.createdAt, "2026-01-01T13:00:00.000Z");
  assert.equal(lot.updatedAt, "2026-01-03T13:00:00.000Z");
});

test("listCemeteryAdminRecords uses current section columns", async () => {
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql.includes("FROM cemeteries")) {
            return { rows: [{ id: "cemetery-1", name: "St. Mark", notes: null, created_at: "2026-01-01T12:00:00.000Z", updated_at: "2026-01-02T12:00:00.000Z" }] };
          }
          if (sql.includes("FROM sections")) {
            assert.match(sql, /name, alternate_names, notes, created_at/u);
            return {
              rows: [
                {
                  id: "section-1",
                  cemetery_id: "cemetery-1",
                  name: "B",
                  alternate_names: [],
                  notes: null,
                  created_at: "2026-01-01T12:30:00.000Z",
                  updated_at: "2026-01-02T12:30:00.000Z",
                },
              ],
            };
          }
          if (sql.includes("FROM lots")) return { rows: [] };
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {},
      };
    },
  };

  const records = await listCemeteryAdminRecords(pool);

  assert.deepEqual(records.sections[0].alternateNames, []);
});
