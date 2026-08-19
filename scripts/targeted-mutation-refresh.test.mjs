import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mutationSource = readFileSync(new URL("../src/hooks/useRecordMutations.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("record mutations do not reload the full cemetery map", () => {
  assert.doesNotMatch(mutationSource, /fetchCemeteryData/u);
  assert.match(appSource, /fetchCemeteryData\(\)/u);
});

test("creating a positioned marker updates the map summary from the mutation response", () => {
  const createHeadstone = mutationSource.match(
    /const createHeadstoneForGrave = async[\s\S]+?\n {2}\};\n\n\n {2}const refreshHeadstoneDetails/u,
  )?.[0];

  assert.ok(createHeadstone, "expected to find createHeadstoneForGrave");
  assert.match(createHeadstone, /headstoneSummaryFromCreate\(saved, grave, headstone\)/u);
  assert.match(createHeadstone, /setData\(\(current\) =>/u);
  assert.match(createHeadstone, /appendHeadstoneSummary\(current, summary\)/u);
  assert.doesNotMatch(createHeadstone, /refreshDetails/u);
});

test("lot assignment updates the selected grave and map summary from the mutation response", () => {
  const saveGraveLot = mutationSource.match(
    /const saveGraveLot = async[\s\S]+?\n {2}\};\n\n {2}return/u,
  )?.[0];

  assert.ok(saveGraveLot, "expected to find saveGraveLot");
  assert.match(saveGraveLot, /const saved = await updateGraveLot/u);
  assert.match(saveGraveLot, /assignLotInMapData\(current, selectedGrave, saved\.lotId\)/u);
  assert.match(saveGraveLot, /assignLotToSelectedGrave\(current, selectedGrave, saved\.lotId\)/u);
  assert.match(saveGraveLot, /setSelectedGraveDetails/u);
  assert.doesNotMatch(saveGraveLot, /refreshDetails/u);
});

test("locally resolvable deletes and photo moves do not refetch selected details", () => {
  for (const [start, end, helper] of [
    ["deleteSavedGraveFeature", "updateSavedMaintenanceRecord", "removeFeatureFromGrave"],
    ["deletePhoto", "movePhoto", "removeMediaAsset"],
    ["movePhoto", "saveOwnershipEvent", "moveMediaAssetInRecord"],
  ]) {
    const mutation = mutationSource.match(new RegExp(`const ${start} = async[\\s\\S]+?\\n {2}\\};\\n\\n {2}const ${end}`, "u"))?.[0];
    assert.ok(mutation, `expected to find ${start}`);
    assert.match(mutation, new RegExp(helper, "u"));
    assert.doesNotMatch(mutation, /refreshDetails/u);
  }
});
