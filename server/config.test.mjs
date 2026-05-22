import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { dockerComposeArgs, loadDbEnvironment } from "../scripts/lib/run-liquibase.mjs";
import { loadApiConfig } from "./config.mjs";

function withTemporaryProject(files, fn) {
  const previousCwd = process.cwd();
  const previousAppEnv = process.env.APP_ENV;
  const previousPgPort = process.env.PGPORT;
  const projectDir = mkdtempSync(join(tmpdir(), "cemetery-config-"));

  try {
    mkdirSync(join(projectDir, "db", "env"), { recursive: true });

    for (const [path, contents] of Object.entries(files)) {
      writeFileSync(join(projectDir, path), contents);
    }

    process.chdir(projectDir);
    delete process.env.PGPORT;
    process.env.APP_ENV = "dev";

    fn(realpathSync(projectDir));
  } finally {
    process.chdir(previousCwd);
    if (previousAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;
    if (previousPgPort === undefined) delete process.env.PGPORT;
    else process.env.PGPORT = previousPgPort;
    rmSync(projectDir, { recursive: true, force: true });
  }
}

test("local environment files override checked-in database defaults", () => {
  withTemporaryProject(
    {
      "db/env/dev.env": [
        "APP_ENV=dev",
        "POSTGRES_DB=cemetery_mapping_dev",
        "POSTGRES_USER=cemetery_app",
        "POSTGRES_PASSWORD=base_password",
        "POSTGRES_PORT=5432",
      ].join("\n"),
      "db/env/dev.local.env": "POSTGRES_PORT=5436\nPOSTGRES_PASSWORD=local_password\n",
    },
    (projectDir) => {
      const config = loadApiConfig();
      const dbEnv = loadDbEnvironment("dev");
      const composeArgs = dockerComposeArgs("dev");

      assert.equal(config.database.port, 5436);
      assert.equal(config.database.database, "cemetery_mapping_dev");
      assert.equal(config.database.password, "local_password");
      assert.equal(dbEnv.POSTGRES_PORT, "5436");
      assert.equal(dbEnv.POSTGRES_PASSWORD, "local_password");
      assert.deepEqual(composeArgs.slice(-2), ["--env-file", join(projectDir, "db", "env", "dev.local.env")]);
    },
  );
});
