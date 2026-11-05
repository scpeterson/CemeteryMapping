import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const compose = fs.readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");

test("PostgreSQL is published only on the host loopback interface", () => {
  assert.match(compose, /- "127\.0\.0\.1:\$\{POSTGRES_PORT:-5432\}:5432"/u);
  assert.doesNotMatch(compose, /- "\$\{POSTGRES_PORT:-5432\}:5432"/u);
});

test("all environments use the same verified database image and PostgreSQL 18 volume layout", () => {
  const hosted = fs.readFileSync(new URL("../deploy/test/compose.yaml", import.meta.url), "utf8");
  const expectedImage = "postgis/postgis:18-3.6@sha256:4a43e3c3e5d55b9208240fc71db543b79c638766280c625a425bd0a2390989c4";
  for (const source of [compose, hosted]) {
    assert.equal(source.match(/image: (postgis\/postgis:\S+)/u)?.[1], expectedImage);
    assert.doesNotMatch(source, /:\/var\/lib\/postgresql\/data\b/u);
    assert.match(source, /:\/var\/lib\/postgresql\s*$/mu);
  }
  assert.match(hosted, /database_pg18:\s*\n\s*name: nhcemeteries-test-postgresql18/u);
});
