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
  // MapLibre runtime chunks have separate dependency limits; application limits stay fixed.
  { label: "individual map vendor chunk", pattern: /^vendor-map-.*\.js$/u, gzipKilobytes: 285 },
];
export const totalJavaScriptGzipBudgetKilobytes = 700;
// ADR 0204: count the historical map runtime inside core, with at most 12 KiB
// additional allowance for the measured 6.16 vendor + worker growth. This credit
// applies only to those assets, never to application/shared JavaScript.
export const mapRuntimeBaselineGzipKilobytes = 415;
export const mapRuntimeGrowthGzipKilobytes = 12;
// Field collection is a separate, explicitly prepared offline entry. Its lazy
// chunk has an independent limit; the existing map/core allowance stays fixed.
export const offlineFieldGzipBudgetKilobytes = 15;
export const recordExportGzipBudgetKilobytes = 5;
export const maintenanceTasksGzipBudgetKilobytes = 6;

export function checkBundleAssets(assets) {
const failures = [];

for (const budget of budgets) {
  const matches = assets.filter((asset) => budget.pattern.test(asset.filename));
  if (!matches.length) failures.push(`${budget.label}: matching bundle was not produced`);
  for (const asset of matches) {
    const limit = budget.gzipKilobytes * 1024;
    if (asset.gzipBytes > limit) failures.push(`${asset.filename}: ${(asset.gzipBytes / 1024).toFixed(2)} KiB gzip exceeds ${budget.gzipKilobytes} KiB`);
  }
}

const totalGzipBytes = assets.reduce((total, asset) => total + asset.gzipBytes, 0);
const mapRuntimeBytes=assets.filter(asset=>/^(?:vendor-map-|maplibre-gl-worker-).*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
const mapGrowth=Math.max(0,mapRuntimeBytes-mapRuntimeBaselineGzipKilobytes*1024);
const mapGrowthCredit=Math.min(mapGrowth,mapRuntimeGrowthGzipKilobytes*1024);
if(mapGrowth>mapRuntimeGrowthGzipKilobytes*1024)failures.push(`map vendor and worker runtime exceeds ${mapRuntimeBaselineGzipKilobytes+mapRuntimeGrowthGzipKilobytes} KiB gzip`);
const fieldBytes=assets.filter(asset=>/^FieldCollectionPage-.*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
const exportBytes=assets.filter(asset=>/^ExportRecordsPage-.*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
const taskBytes=assets.filter(asset=>/^MaintenanceTasksPage-.*\.js$/u.test(asset.filename)).reduce((n,asset)=>n+asset.gzipBytes,0);
if(taskBytes>maintenanceTasksGzipBudgetKilobytes*1024)failures.push(`separate tasks entry exceeds ${maintenanceTasksGzipBudgetKilobytes} KiB gzip`);
if(exportBytes>recordExportGzipBudgetKilobytes*1024)failures.push(`separate export entry exceeds ${recordExportGzipBudgetKilobytes} KiB gzip`);
if(fieldBytes>offlineFieldGzipBudgetKilobytes*1024)failures.push(`offline field entry exceeds ${offlineFieldGzipBudgetKilobytes} KiB gzip`);
if (totalGzipBytes-fieldBytes-exportBytes-taskBytes-mapGrowthCredit > totalJavaScriptGzipBudgetKilobytes * 1024) {
  failures.push(`core JavaScript: ${((totalGzipBytes-fieldBytes-exportBytes-taskBytes-mapGrowthCredit) / 1024).toFixed(2)} KiB gzip exceeds ${totalJavaScriptGzipBudgetKilobytes} KiB`);
}

return { failures, totalGzipBytes };
}

export async function checkBundleDirectory(assetDirectory) {
  const filenames = (await readdir(assetDirectory)).filter((filename) => filename.endsWith(".js"));
  const assets = await Promise.all(filenames.map(async (filename) => ({
    filename, gzipBytes: gzipSync(await readFile(resolve(assetDirectory, filename))).byteLength,
  })));
  return { ...checkBundleAssets(assets), count: assets.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
const { failures, totalGzipBytes, count } = await checkBundleDirectory(resolve(process.cwd(), "dist", "assets"));
if (failures.length) {
  console.error(`Bundle size check failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Bundle size check passed: ${count} JavaScript chunks, ${(totalGzipBytes / 1024).toFixed(2)} KiB gzip total.`);
}

}
