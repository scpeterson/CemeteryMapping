import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function appVersionMetadata(config) {
  return {
    version: process.env.APP_VERSION ?? packageJson.version,
    gitSha: process.env.GIT_SHA ?? gitSha(),
    buildTime: process.env.BUILD_TIME ?? "",
    environment: config.appEnv.toUpperCase(),
  };
}
