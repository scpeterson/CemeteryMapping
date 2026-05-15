import { spawnSync } from "node:child_process";
import { currentEnvironment, dockerComposeArgs } from "./lib/run-liquibase.mjs";

const command = process.argv[2];
const environment = currentEnvironment();

const commands = {
  up: ["up", "-d", "db"],
  down: ["down"],
  logs: ["logs", "-f", "db"],
};

if (!command || !commands[command]) {
  console.error("Usage: node scripts/db-compose.mjs <up|down|logs>");
  process.exit(1);
}

const result = spawnSync("docker", [...dockerComposeArgs(environment), ...commands[command]], {
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
