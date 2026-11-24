import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const shardCount = 4;
const defaultSeconds = 10;
const specFile = /\.(?:test|spec)\.(?:c|m)?[jt]sx?$/u;
const weights: Record<string, number> = JSON.parse(
  readFileSync(new URL("../fixture-shard-seconds.json", import.meta.url), "utf8"),
);

function collectSpecs(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSpecs(path);
    return entry.isFile() && specFile.test(entry.name) ? [path] : [];
  });
}

export function fixtureShardMatch(testDir: string, selector: string, isDatabaseSpec: (path: string) => boolean) {
  if (!/^[1-4]$/u.test(selector)) throw new Error("BROWSER_FIXTURE_SHARD must be 1, 2, 3, or 4.");

  const files = collectSpecs(testDir)
    .map(path => relative(testDir, path).split(sep).join("/"))
    .filter(path => !isDatabaseSpec(path))
    .map(path => ({ path, seconds: weights[path] ?? defaultSeconds }))
    .sort((first, second) => second.seconds - first.seconds || first.path.localeCompare(second.path, "en"));
  const shards = Array.from({ length: shardCount }, () => ({ seconds: 0, paths: [] as string[] }));

  for (const { path, seconds } of files) {
    const lightest = shards.reduce((best, shard) => shard.seconds < best.seconds ? shard : best);
    lightest.paths.push(path);
    lightest.seconds += seconds;
  }

  const separator = String.raw`[/\\]`;
  return shards[Number(selector) - 1].paths.map(path => {
    const pattern = path.split("/").map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join(separator);
    return new RegExp(`${separator}tests${separator}${pattern}$`, "u");
  });
}
