import { selectBurialsForGrave } from "../server/cemeteryBurialQueries.mjs";
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

let querySql;
await selectBurialsForGrave({ query: async (sql) => { querySql = sql; return { rows: [] }; } }, "grave-1");
const mutations = readFileSync(new URL("../server/cemeteryBurialMutations.mjs", import.meta.url), "utf8");
const mappers = readFileSync(new URL("../server/cemeteryMappers.mjs", import.meta.url), "utf8");
const validation = readFileSync(new URL("../server/routes/cemeteryRouteValidation.mjs", import.meta.url), "utf8");
const detailPanel = readFileSync(new URL("../src/components/detail/BurialRecord.tsx", import.meta.url), "utf8");

test("burial API reads and maps normalized death places", () => {
  assert.match(querySql, /death_places\.id::text AS death_place_id/u);
  assert.match(querySql, /LEFT JOIN places AS death_places/u);
  assert.match(mappers, /deathPlace: burial\.death_place_id/u);
  assert.match(mappers, /authorityIdentifier/u);
});

test("burial mutation accepts only verified place identifiers", () => {
  assert.match(validation, /validateUuid\(deathPlaceIdText, "Death place"\)/u);
  assert.match(mutations, /verification_status = 'verified'/u);
  assert.match(mutations, /Death place is no longer available/u);
  assert.match(mutations, /death_place_uuid = \$/u);
});

test("burial editor selects and displays verified death locations", () => {
  assert.match(detailPanel, /Death location/u);
  assert.match(detailPanel, /lookups\.verifiedPlaces/u);
  assert.match(detailPanel, /Only places verified against an authoritative geographic registry/u);
  assert.match(detailPanel, /burial\.deathPlace\.authorityUrl/u);
});
