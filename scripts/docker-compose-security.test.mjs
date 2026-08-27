import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const compose = fs.readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");

test("PostgreSQL is published only on the host loopback interface", () => {
  assert.match(compose, /- "127\.0\.0\.1:\$\{POSTGRES_PORT:-5432\}:5432"/u);
  assert.doesNotMatch(compose, /- "\$\{POSTGRES_PORT:-5432\}:5432"/u);
});
