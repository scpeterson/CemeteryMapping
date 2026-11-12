import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the installed package version has bundled user-facing release notes", () => {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  const releases = JSON.parse(readFileSync(new URL("../src/data/releaseNotes.json", import.meta.url)));
  assert(Object.hasOwn(releases, version), `Add plain-language release notes for ${version} when preparing the release`);
  const changes = releases[version];
  assert(Array.isArray(changes) && changes.length > 0);
  assert(changes.every((change) => typeof change === "string" && change.trim()));
});
