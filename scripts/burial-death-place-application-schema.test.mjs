import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const queries = readFileSync(new URL("../server/cemeteryBurialQueries.mjs", import.meta.url), "utf8");
const mutations = readFileSync(new URL("../server/cemeteryBurialMutations.mjs", import.meta.url), "utf8");
const mappers = readFileSync(new URL("../server/cemeteryMappers.mjs", import.meta.url), "utf8");
const validation = readFileSync(new URL("../server/routes/cemeteryRouteValidation.mjs", import.meta.url), "utf8");
const detailPanel = readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");

test("burial API reads and maps normalized death places", () => {
  assert.match(queries, /burialDeathPlaceSql/u);
  assert.match(mappers, /deathPlace: burial\.death_place_id/u);
  assert.match(mappers, /authorityIdentifier/u);
});

test("burial mutation accepts only verified place identifiers", () => {
  assert.match(validation, /validateUuid\(deathPlaceIdText, "Death place"\)/u);
  assert.match(mutations, /verification_status = 'verified'/u);
  assert.match(mutations, /Death place must reference an active verified place/u);
  assert.match(mutations, /death_place_uuid = \$/u);
});

test("burial editor selects and displays verified death locations", () => {
  assert.match(detailPanel, /Death location/u);
  assert.match(detailPanel, /lookups\.verifiedPlaces/u);
  assert.match(detailPanel, /Only places verified against an authoritative geographic registry/u);
  assert.match(detailPanel, /burial\.deathPlace\.authorityUrl/u);
});
