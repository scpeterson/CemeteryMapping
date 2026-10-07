import assert from "node:assert/strict";
import test from "node:test";
import { budgets, checkBundleAssets, totalJavaScriptGzipBudgetKilobytes } from "./check-bundle-size.mjs";
const baseline = () => budgets.map((budget) => ({ filename: `${budget.pattern.source.match(/\^([\w-]+)/u)[1]}fixture.js`, gzipBytes: 1024 }));
test("requires each budgeted chunk and accepts an under-budget build", () => {
  assert.deepEqual(checkBundleAssets(baseline()).failures, []);
  assert.ok(checkBundleAssets([]).failures.length >= budgets.length);
});
test("fails individual chunk overages", () => {
  const assets = baseline();
  assets[0].gzipBytes = budgets[0].gzipKilobytes * 1024 + 1;
  assert.match(checkBundleAssets(assets).failures.join("\n"), /exceeds 50 KiB/u);
});
test("counts lazy chunks and workers toward the total budget", () => {
  const assets = [...baseline(), { filename: "worker.js", gzipBytes: totalJavaScriptGzipBudgetKilobytes * 1024 }];
  assert.match(checkBundleAssets(assets).failures.join("\n"), /all JavaScript/u);
});
