import test from "node:test";
import assert from "node:assert/strict";
import { settings, xml, runtimeEnvironment } from "./local-runtime.mjs";

test("managed environments reject hosted or production targets and use separate ports and directories", () => {
  for (const name of ["prod", "stage", "hosted-test", "../dev"]) assert.throws(() => settings(name, "/checkout"));
  const dev = settings("dev", "/checkout"), target = settings("test", "/checkout");
  assert.notEqual(dev.home, target.home);
  assert.deepEqual([dev.api, dev.web, target.api, target.web], [3001, 5173, 3003, 5174]);
});
test("managed startup fails closed on missing authentication and overrides stale release and port settings", () => {
  const config = settings("test", "/checkout");
  const release = { gitSha: "a".repeat(40), buildTime: "2026-11-24T01:00:00Z", version: "0.3.0" };
  for (const profile of [{}, { AUTH_MODE: "disabled" }, { AUTH_MODE: "auth0", AUTH0_DOMAIN: "example.auth0.com" }]) assert.throws(() => runtimeEnvironment(config, profile, release));
  const profile = { AUTH_MODE: "auth0", AUTH0_DOMAIN: "example.auth0.com", AUTH0_AUDIENCE: "test", API_PORT: "3001", APP_ENV: "dev", GIT_SHA: "old", MEDIA_UPLOAD_DIR: "/private/media" };
  assert.throws(() => runtimeEnvironment(config, { ...profile, AUTH0_DOMAIN: "example.auth0.com MallocNanoZone=0" }, release));
  const env = runtimeEnvironment(config, profile, release);
  assert.equal(env.APP_ENV, "test"); assert.equal(env.API_PORT, "3003"); assert.equal(env.GIT_SHA, release.gitSha);
  assert.equal(env.AUTH0_AUDIENCE, "test"); assert.equal(env.MEDIA_UPLOAD_DIR, profile.MEDIA_UPLOAD_DIR);
});
test("launchd paths are XML escaped", () => {
  assert.equal(xml('/Users/A&B/"<repo>\''), "/Users/A&amp;B/&quot;&lt;repo&gt;&apos;");
});
