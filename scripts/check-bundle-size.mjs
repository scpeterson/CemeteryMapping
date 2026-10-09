import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export const budgets = [
  { label: "application entry", pattern: /^index-.*\.js$/u, gzipKilobytes: 50 },
  { label: "admin shell", pattern: /^AdminPanel-.*\.js$/u, gzipKilobytes: 22 },
  { label: "React vendor", pattern: /^vendor-react-.*\.js$/u, gzipKilobytes: 70 },
  { label: "authentication vendor", pattern: /^vendor-auth-.*\.js$/u, gzipKilobytes: 65 },
  // MapLibre 6.12.0 measures 141.42 KiB gzip; allow modest upgrade headroom.
  { label: "individual map vendor chunk", pattern: /^vendor-map-.*\.js$/u, gzipKilobytes: 145 },
];
export const totalJavaScriptGzipBudgetKilobytes = 700;

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
if (totalGzipBytes > totalJavaScriptGzipBudgetKilobytes * 1024) {
  failures.push(`all JavaScript: ${(totalGzipBytes / 1024).toFixed(2)} KiB gzip exceeds ${totalJavaScriptGzipBudgetKilobytes} KiB`);
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
