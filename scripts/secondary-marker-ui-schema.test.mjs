import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const detailPanel = readFileSync(new URL("../src/components/DetailPanel.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const cemeteryMap = readFileSync(new URL("../src/components/CemeteryMap.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/api/cemeteryApi.ts", import.meta.url), "utf8");
const serverIndex = readFileSync(new URL("../server/index.mjs", import.meta.url), "utf8");
const cemeteryRoutes = readFileSync(new URL("../server/routes/cemeteryRoutes.mjs", import.meta.url), "utf8");
const headstoneMutations = readFileSync(new URL("../server/cemeteryHeadstoneMutations.mjs", import.meta.url), "utf8");
const migration = readFileSync(new URL("../db/changelog/changes/224-headstone-gravesite-secondary-relationships.sql", import.meta.url), "utf8");
const changelog = readFileSync(new URL("../db/changelog/db.changelog-root.yaml", import.meta.url), "utf8");

test("gravesite detail panel exposes an add marker workflow", () => {
  assert.match(detailPanel, /function CreateHeadstoneForm/u);
  assert.match(detailPanel, /Add marker/u);
  assert.match(detailPanel, /Pick point on map/u);
  assert.match(detailPanel, /<option value="footstone">Footstone<\/option>/u);
  assert.match(detailPanel, /onCreateHeadstone\(grave, headstone\)/u);
});

test("map point picking fills the add marker coordinates without selecting map features", () => {
  assert.match(app, /const \[isPickingMarkerPoint, setIsPickingMarkerPoint\]/u);
  assert.match(app, /setPickedMarkerPoint\(\{ \.\.\.point, pickedAt: Date\.now\(\) \}\)/u);
  assert.match(app, /onPickMarkerPoint=\{pickMarkerPoint\}/u);
  assert.match(detailPanel, /pickedMarkerPoint\.latitude\.toFixed\(8\)/u);
  assert.match(detailPanel, /pickedMarkerPoint\.longitude\.toFixed\(8\)/u);
  assert.match(cemeteryMap, /onPickMarkerPointRef\.current\?\.\(\{ latitude: event\.lngLat\.lat, longitude: event\.lngLat\.lng \}\)/u);
  assert.match(cemeteryMap, /isMeasuringRef\.current \|\| isPickingMarkerPointRef\.current/u);
  assert.match(cemeteryMap, /Pick marker point/u);
});

test("create marker API posts to the selected gravesite route", () => {
  assert.match(api, /createGravesiteHeadstone/u);
  assert.match(api, /\/cemeteries\/\$\{encodeURIComponent\(cemeteryId\)\}\/gravesites\/\$\{encodeURIComponent\(graveSpaceId\)\}\/headstones/u);
  assert.match(cemeteryRoutes, /app\.post\("\/api\/cemeteries\/:cemeteryId\/gravesites\/:graveSpaceId\/headstones"/u);
  assert.match(serverIndex, /validateCreateHeadstonePayload/u);
});

test("created markers are linked to the selected gravesite with secondary relationship types", () => {
  assert.match(headstoneMutations, /INSERT INTO headstones/u);
  assert.match(headstoneMutations, /INSERT INTO headstone_gravesites/u);
  assert.match(serverIndex, /\["primary", "spans", "nearby", "inferred", "footstone", "secondary"\]/u);
  assert.match(migration, /'footstone'/u);
  assert.match(migration, /'secondary'/u);
  assert.match(changelog, /changes\/224-headstone-gravesite-secondary-relationships\.sql/u);
});
