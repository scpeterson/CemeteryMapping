import assert from "node:assert/strict";
import test from "node:test";
import { appVersionMetadata } from "./version.mjs";

test("appVersionMetadata reports package version and environment", () => {
  const metadata = appVersionMetadata({ appEnv: "test" });

  assert.match(metadata.version, /^\d+\.\d+\.\d+/u);
  assert.equal(metadata.environment, "TEST");
  assert.equal(typeof metadata.gitSha, "string");
  assert.equal(typeof metadata.buildTime, "string");
});
