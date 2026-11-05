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
  assert.match(checkBundleAssets(assets).failures.join("\n"), /core JavaScript/u);
});

test("allows the upstream MapLibre chunk while retaining application limits", () => {
  const assets = baseline();
  assets.find(asset => asset.filename.startsWith("vendor-map-")).gzipBytes = 274 * 1024;
  assert.deepEqual(checkBundleAssets(assets).failures, []);
  for (const prefix of ["index-", "App-", "AdminPanel-"]) {
    const applicationAssets = assets.map(asset => ({ ...asset }));
    const budget = budgets.find(budget => budget.pattern.test(`${prefix}fixture.js`));
    applicationAssets.find(asset => asset.filename.startsWith(prefix)).gzipBytes = budget.gzipKilobytes * 1024 + 1;
    assert.equal(checkBundleAssets(applicationAssets).failures.length, 1);
  }
});

test("separate offline entry has a fixed allowance without expanding the map budget",()=>{
 const assets=budgets.map(b=>({filename: b.label==="application entry"?"index-a.js": b.label==="map application"?"App-a.js": b.label==="admin shell"?"AdminPanel-a.js":b.label==="React vendor"?"vendor-react-a.js":b.label==="authentication vendor"?"vendor-auth-a.js":"vendor-map-a.js",gzipBytes:1024}));
 assert.ok(checkBundleAssets([...assets,{filename:"FieldCollectionPage-a.js",gzipBytes:16*1024}]).failures.some(f=>f.includes("offline field")));
});

test("separate export entry has a fixed cap while every shared chunk stays in the core budget",()=>{
 assert.ok(checkBundleAssets([...baseline(),{filename:'ExportRecordsPage-a.js',gzipBytes:6*1024}]).failures.some(f=>f.includes('export entry')));
 assert.deepEqual(checkBundleAssets([...baseline(),{filename:'ExportRecordsPage-a.js',gzipBytes:4*1024}]).failures,[]);
});

test('the standalone task page has a fixed budget and shared reminders remain in core',()=>{
 assert.ok(checkBundleAssets([...baseline(),{filename:'MaintenanceTasksPage-a.js',gzipBytes:7*1024}]).failures.some(f=>f.includes('tasks entry')));
 assert.deepEqual(checkBundleAssets([...baseline(),{filename:'MaintenanceTasksPage-a.js',gzipBytes:5*1024}]).failures,[]);
 assert.ok(checkBundleAssets([...baseline(),{filename:'TaskReminderLink-a.js',gzipBytes:701*1024}]).failures.some(f=>f.includes('core JavaScript')));
});
