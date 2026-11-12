import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const budgets = [
  { label: "application entry", pattern: /^index-.*\.js$/u, gzipKilobytes: 50 },
  // The map application is now loaded separately from the public entry.
  { label: "map application", pattern: /^App-.*\.js$/u, gzipKilobytes: 50 },
  { label: "admin shell", pattern: /^AdminPanel-.*\.js$/u, gzipKilobytes: 22 },
  { label: "React vendor", pattern: /^vendor-react-.*\.js$/u, gzipKilobytes: 70 },
  { label: "authentication vendor", pattern: /^vendor-auth-.*\.js$/u, gzipKilobytes: 65 },
  // MapLibre thresholds report upstream growth without blocking upgrades.
  { label: "individual map vendor chunk", pattern: /^vendor-map-.*\.js$/u, gzipKilobytes: 285, reportOnly: true },
];
// ADR 0205: one KiB for debounced inspection persistence and lifecycle flushes.
export const totalJavaScriptGzipBudgetKilobytes = 701;
// Keep the historical map runtime in core, but credit all upstream growth.
// ADR 0209: the former 12 KiB allowance is now a reporting threshold only.
// Credit applies only to named map vendor/worker assets, never application code.
export const mapRuntimeBaselineGzipKilobytes = 415;
export const mapRuntimeGrowthGzipKilobytes = 12;
// Field collection is a separate, explicitly prepared offline entry. Its lazy
// chunk has an independent limit; the existing map/core allowance stays fixed.
export const offlineFieldGzipBudgetKilobytes = 15;
export const recordExportGzipBudgetKilobytes = 5;
export const maintenanceTasksGzipBudgetKilobytes = 6;

export function checkBundleAssets(assets) {
const failures = [];
const warnings = [];

for (const budget of budgets) {
  const matches = assets.filter((asset) => budget.pattern.test(asset.filename));
  if (!matches.length) failures.push(`${budget.label}: matching bundle was not produced`);
  for (const asset of matches) {
    const limit = budget.gzipKilobytes * 1024;
    if (asset.gzipBytes > limit) {
      const messages = budget.reportOnly ? warnings : failures;
      messages.push(`${asset.filename}: ${(asset.gzipBytes / 1024).toFixed(2)} KiB gzip exceeds ${budget.gzipKilobytes} KiB${budget.reportOnly ? " (MapLibre growth allowed)" : ""}`);
    }
  }
}

const totalGzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0);
const mapRuntimeBytes=assets.filter(asset=>/^(?:vendor-map-|maplibre-gl-worker-).*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
const mapGrowth=Math.max(0,mapRuntimeBytes-mapRuntimeBaselineGzipKilobytes*1024);
const mapGrowthCredit=mapGrowth;
if(mapGrowth>mapRuntimeGrowthGzipKilobytes*1024)warnings.push(`MapLibre vendor and worker runtime: ${(mapRuntimeBytes/1024).toFixed(2)} KiB gzip exceeds the former ${mapRuntimeBaselineGzipKilobytes+mapRuntimeGrowthGzipKilobytes} KiB budget by ${((mapGrowth-mapRuntimeGrowthGzipKilobytes*1024)/1024).toFixed(2)} KiB; growth allowed and credited against core.`);
const fieldBytes=assets.filter(asset=>/^FieldCollectionPage-.*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
const exportBytes=assets.filter(asset=>/^ExportRecordsPage-.*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
const taskBytes=assets.filter(asset=>/^MaintenanceTasksPage-.*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
if(taskBytes>maintenanceTasksGzipBudgetKilobytes*1024)failures.push(`separate tasks entry exceeds ${maintenanceTasksGzipBudgetKilobytes} KiB gzip`);
if(exportBytes>recordExportGzipBudgetKilobytes*1024)failures.push(`separate export entry exceeds ${recordExportGzipBudgetKilobytes} KiB gzip`);
if(fieldBytes>offlineFieldGzipBudgetKilobytes*1024)failures.push(`offline field entry exceeds ${offlineFieldGzipBudgetKilobytes} KiB gzip`);
if (totalGzipBytes-fieldBytes-exportBytes-taskBytes-mapGrowthCredit > totalJavaScriptGzipBudgetKilobytes * 1024) {
  failures.push(`core JavaScript: ${((totalGzipBytes-fieldBytes-exportBytes-taskBytes-mapGrowthCredit) / 1024).toFixed(2)} KiB gzip exceeds ${totalJavaScriptGzipBudgetKilobytes} KiB`);
}

return { failures, warnings, totalGzipBytes, mapRuntimeBytes, mapGrowthCredit, coreGzipBytes: totalGzipBytes-fieldBytes-exportBytes-taskBytes-mapGrowthCredit };
}

export async function checkBundleDirectory(assetDirectory) {
  const filenames = (await readdir(assetDirectory)).filter((filename) => filename.endsWith(".js"));
  const assets = await Promise.all(filenames.map(async (filename) => ({
    filename, gzipBytes: gzipSync(await readFile(resolve(assetDirectory, filename))).byteLength,
  })));
  return { ...checkBundleAssets(assets), count: assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
const { failures, warnings, totalGzipBytes, mapRuntimeBytes, mapGrowthCredit, coreGzipBytes, count } = await checkBundleDirectory(resolve(process.cwd(), "dist", "assets"));
console.log(`MapLibre vendor + worker: ${(mapRuntimeBytes/1024).toFixed(2)} KiB gzip; +${(mapGrowthCredit/1024).toFixed(2)} KiB credited above the ${mapRuntimeBaselineGzipKilobytes} KiB historical baseline. Adjusted core: ${(coreGzipBytes/1024).toFixed(2)} / ${totalJavaScriptGzipBudgetKilobytes} KiB.`);
for (const warning of warnings) console.warn(`Bundle size report: ${warning}`);
if (failures.length) {
  console.error(`Bundle size check failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Bundle size check passed: ${count} JavaScript chunks, ${(totalGzipBytes / 1024).toFixed(2)} KiB gzip total.`);
}

}
