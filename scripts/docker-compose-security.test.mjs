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
  const expectedImage = "cemeterymapping-postgis:18-3.7-tiger3.6.4";
  for (const source of [compose, hosted]) {
    assert.equal(source.match(/image: (cemeterymapping-postgis:\S+)/u)?.[1], expectedImage);
    assert.doesNotMatch(source, /:\/var\/lib\/postgresql\/data\b/u);
    assert.match(source, /:\/var\/lib\/postgresql\s*$/mu);
  }
  assert.match(compose, /context: \.\/deploy\/database/u);
  assert.match(hosted, /context: \.\.\/database/u);
  for (const source of [compose, hosted]) assert.match(source, /pull_policy: build/u);
  const databaseDockerfile = fs.readFileSync(new URL("../deploy/database/Dockerfile", import.meta.url), "utf8");
  assert.match(databaseDockerfile, /FROM postgis\/postgis:18-3\.7@sha256:c5d1ba4292ff7b4471ff41cd515c677633797b72cdd2a7bb691cadaab91f1a1f/u);
  assert.match(databaseDockerfile, /FROM postgis\/postgis:18-3\.6@sha256:4a43e3c3e5d55b9208240fc71db543b79c638766280c625a425bd0a2390989c4 AS tiger_sql/u);
  assert.match(databaseDockerfile, /COPY --from=tiger_sql \/usr\/share\/postgresql\/18\/extension\/postgis_tiger_geocoder\*/u);
  assert.match(hosted, /database_pg18:\s*\n\s*name: nhcemeteries-test-postgresql18/u);
});
