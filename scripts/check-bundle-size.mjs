import { gzipSync } from "node:zlib";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const assetDirectory = resolve(process.cwd(), "dist", "assets");
const budgets = [
  { label: "application entry", pattern: /^index-.*\.js$/u, gzipKilobytes: 45 },
  { label: "admin shell", pattern: /^AdminPanel-.*\.js$/u, gzipKilobytes: 22 },
  { label: "React vendor", pattern: /^vendor-react-.*\.js$/u, gzipKilobytes: 65 },
  { label: "authentication vendor", pattern: /^vendor-auth-.*\.js$/u, gzipKilobytes: 65 },
  { label: "individual map vendor chunk", pattern: /^vendor-map-.*\.js$/u, gzipKilobytes: 140 },
];
const totalJavaScriptGzipBudgetKilobytes = 500;

const filenames = (await readdir(assetDirectory)).filter((filename) => filename.endsWith(".js"));
const assets = await Promise.all(filenames.map(async (filename) => {
  const contents = await readFile(resolve(assetDirectory, filename));
  return { filename, gzipBytes: gzipSync(contents).byteLength };
}));
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

if (failures.length) {
  console.error(`Bundle size check failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Bundle size check passed: ${assets.length} JavaScript chunks, ${(totalGzipBytes / 1024).toFixed(2)} KiB gzip total.`);
}
