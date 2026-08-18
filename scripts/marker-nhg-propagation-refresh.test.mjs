import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const recordMutationsSource = readFileSync(new URL("../src/hooks/useRecordMutations.ts", import.meta.url), "utf8");

test("marker NHG propagation refreshes selected details so associated burials update immediately", () => {
  const saveHeadstone = recordMutationsSource.match(
    /const saveHeadstone = async[\s\S]+?\n {2}\};\n\n {2}const createHeadstoneForGrave/u,
  )?.[0];

  assert.ok(saveHeadstone, "expected to find saveHeadstone");
  assert.match(saveHeadstone, /if \(saved\.burialNhgPropagation\)/u);
  assert.match(saveHeadstone, /refreshDetails\(\{ preserveCurrent: true \}\)/u);
});
