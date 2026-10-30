import assert from "node:assert/strict";
import test from "node:test";
import { previewHtml, summarizePreview, validatePreviewOptions } from "./lib/spatial-repair-preview.mjs";

const options = { table: "lots", cemetery: "54fae28c-9177-4f31-b45f-22d54ab82caa", section: "C", srid: "32617" };
test("preview requires a narrow scope and metric tolerances with automatic snapping disabled", () => {
  assert.equal(validatePreviewOptions(options).snap, 0);
  for (const invalid of [{ table: "users" }, { section: "" }, { srid: "4326" }, { "snap-meters": "-1" }, { "gap-meters": "Infinity" }, { "gap-meters": "0.2" }]) {
    assert.throws(() => validatePreviewOptions({ ...options, ...invalid }));
  }
});

test("candidate summary exposes collapses, non-estimated edits and worsening containment", () => {
  const summary = summarizePreview([{ changed_area_m2: 2, valid: true, empty: false, geometry_confidence: "surveyed",
    overlap_pairs_before: 1, overlap_pairs_after: 0, outside_parent_before_m2: 0, outside_parent_after_m2: 1, hausdorff_m: 0.5 },
  { changed_area_m2: 1, valid: true, empty: true, geometry_confidence: "estimated", overlap_pairs_before: 0,
    overlap_pairs_after: 0, outside_parent_before_m2: null, outside_parent_after_m2: null, hausdorff_m: null }]);
  assert.equal(summary.protectedGeometryChanges, 1);
  assert.equal(summary.invalidOrEmpty, 1);
  assert.equal(summary.parentContainmentWorsened, 1);
  assert.equal(summary.overlapPairsAfter, 0);
});

test("local viewer embeds labels as inert data even when records contain HTML", () => {
  const html = previewHtml({ options: { section: '</script><script>alert("injected")</script>' }, records: [] });
  assert.ok(!html.includes('</script><script>alert("injected")'));
  const embedded = html.match(/<script type="application\/json" id="data">(.*?)<\/script>/s)[1];
  assert.equal(JSON.parse(embedded).options.section, '</script><script>alert("injected")</script>');
  assert.ok(!html.includes('src="http'));
});
