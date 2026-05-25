import assert from "node:assert/strict";
import test from "node:test";
import { listCemeteryAdminRecords, updateSectionText } from "./cemeteryAdminRepository.mjs";

test("listCemeteryAdminRecords returns editable cemetery, section, and lot text", async () => {
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql.includes("information_schema.columns")) return { rows: [{ exists: true }] };
          if (sql.includes("FROM cemeteries")) {
            return { rows: [{ id: "cemetery-1", name: "St. Mark", notes: "Main cemetery" }] };
          }
          if (sql.includes("FROM sections")) {
            return {
              rows: [
                {
                  id: "section-1",
                  cemetery_id: "cemetery-1",
                  section_id: "B",
                  name: "Section B",
                  alternate_names: ["OC", "Original Cemetery"],
                },
              ],
            };
          }
          if (sql.includes("FROM lots")) {
            return { rows: [{ id: "lot-1", cemetery_id: "cemetery-1", section_id: "B", lot_id: "12", name: "Lot 12" }] };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {},
      };
    },
  };

  assert.deepEqual(await listCemeteryAdminRecords(pool), {
    cemeteries: [{ id: "cemetery-1", name: "St. Mark", notes: "Main cemetery" }],
    sections: [{ id: "section-1", cemeteryId: "cemetery-1", sectionId: "B", name: "Section B", alternateNames: ["OC", "Original Cemetery"] }],
    lots: [{ id: "lot-1", cemeteryId: "cemetery-1", sectionId: "B", lotId: "12", name: "Lot 12" }],
  });
});

test("updateSectionText deduplicates and trims alternate names", async () => {
  let queryValues;
  const pool = {
    async query(sql, values) {
      if (sql.includes("information_schema.columns")) return { rows: [{ exists: true }] };
      queryValues = values;
      return {
        rows: [
          {
            id: "section-1",
            cemetery_id: "cemetery-1",
            section_id: "B",
            name: "Section B",
            alternate_names: values[2],
          },
        ],
      };
    },
  };

  const section = await updateSectionText(pool, "section-1", {
    name: "Section B",
    alternateNames: ["OC", " Original Cemetery ", "OC", ""],
  });

  assert.deepEqual(queryValues, ["section-1", "Section B", ["OC", "Original Cemetery"]]);
  assert.deepEqual(section.alternateNames, ["OC", "Original Cemetery"]);
});

test("listCemeteryAdminRecords tolerates databases before the alternate names migration", async () => {
  const pool = {
    async connect() {
      return {
        async query(sql) {
          if (sql.includes("FROM cemeteries")) {
            return { rows: [{ id: "cemetery-1", name: "St. Mark", notes: null }] };
          }
          if (sql.includes("information_schema.columns")) return { rows: [{ exists: false }] };
          if (sql.includes("FROM sections")) {
            assert.match(sql, /'\{\}'::text\[\] AS alternate_names/);
            return {
              rows: [{ id: "section-1", cemetery_id: "cemetery-1", section_id: "B", name: "Section B", alternate_names: [] }],
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
