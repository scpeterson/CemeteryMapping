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
  const previousAuthMode = process.env.AUTH_MODE;
  const previousAuth0Domain = process.env.AUTH0_DOMAIN;
  const previousAuth0Audience = process.env.AUTH0_AUDIENCE;
  const previousPostgresPassword = process.env.POSTGRES_PASSWORD;
  const previousAuth0ManagementClientId = process.env.AUTH0_MANAGEMENT_CLIENT_ID;
  const previousAuth0ManagementClientSecret = process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
  const previousAuth0ManagementConnection = process.env.AUTH0_MANAGEMENT_CONNECTION;
  const previousAuth0PasswordResetClientId = process.env.AUTH0_PASSWORD_RESET_CLIENT_ID;
  const projectDir = mkdtempSync(join(tmpdir(), "cemetery-config-"));

  try {
    mkdirSync(join(projectDir, "db", "env"), { recursive: true });

    for (const [path, contents] of Object.entries(files)) {
      writeFileSync(join(projectDir, path), contents);
    }

    process.chdir(projectDir);
    delete process.env.PGPORT;
  delete process.env.AUTH_MODE;
  delete process.env.AUTH0_DOMAIN;
  delete process.env.AUTH0_AUDIENCE;
  delete process.env.POSTGRES_PASSWORD;
    process.env.AUTH0_MANAGEMENT_CLIENT_ID = "management-client";
    process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = "management-secret";
    process.env.AUTH0_MANAGEMENT_CONNECTION = "Username-Password-Authentication";
    process.env.AUTH0_PASSWORD_RESET_CLIENT_ID = "spa-client";
    process.env.APP_ENV = "dev";

    fn(realpathSync(projectDir));
  } finally {
    process.chdir(previousCwd);
    if (previousAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = previousAppEnv;
    if (previousPgPort === undefined) delete process.env.PGPORT;
    else process.env.PGPORT = previousPgPort;
  if (previousAuthMode === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = previousAuthMode;
  if (previousAuth0Domain === undefined) delete process.env.AUTH0_DOMAIN;
  else process.env.AUTH0_DOMAIN = previousAuth0Domain;
  if (previousAuth0Audience === undefined) delete process.env.AUTH0_AUDIENCE;
  else process.env.AUTH0_AUDIENCE = previousAuth0Audience;
  if (previousPostgresPassword === undefined) delete process.env.POSTGRES_PASSWORD;
  else process.env.POSTGRES_PASSWORD = previousPostgresPassword;
    if (previousAuth0ManagementClientId === undefined) delete process.env.AUTH0_MANAGEMENT_CLIENT_ID;
    else process.env.AUTH0_MANAGEMENT_CLIENT_ID = previousAuth0ManagementClientId;
    if (previousAuth0ManagementClientSecret === undefined) delete process.env.AUTH0_MANAGEMENT_CLIENT_SECRET;
    else process.env.AUTH0_MANAGEMENT_CLIENT_SECRET = previousAuth0ManagementClientSecret;
    if (previousAuth0ManagementConnection === undefined) delete process.env.AUTH0_MANAGEMENT_CONNECTION;
    else process.env.AUTH0_MANAGEMENT_CONNECTION = previousAuth0ManagementConnection;
    if (previousAuth0PasswordResetClientId === undefined) delete process.env.AUTH0_PASSWORD_RESET_CLIENT_ID;
    else process.env.AUTH0_PASSWORD_RESET_CLIENT_ID = previousAuth0PasswordResetClientId;
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
      assert.deepEqual(config.auth.auth0.management, {
        clientId: "management-client",
        clientSecret: "management-secret",
        connection: "Username-Password-Authentication",
        passwordResetClientId: "spa-client",
      });
      assert.equal(dbEnv.POSTGRES_PORT, "5436");
      assert.equal(dbEnv.POSTGRES_PASSWORD, "local_password");
      assert.deepEqual(composeArgs.slice(-2), ["--env-file", join(projectDir, "db", "env", "dev.local.env")]);
    },
  );
});

test("stage and production fail closed when authentication is not explicitly configured", () => {
  withTemporaryProject(
    {
      "db/env/stage.env": "APP_ENV=stage\nPOSTGRES_DB=cemetery_mapping_stage\nPOSTGRES_USER=cemetery_app\nPOSTGRES_PASSWORD=stage_password\n",
      "db/env/prod.env": "APP_ENV=prod\nPOSTGRES_DB=cemetery_mapping_prod\nPOSTGRES_USER=cemetery_app\nPOSTGRES_PASSWORD=prod_password\n",
    },
    () => {
      process.env.APP_ENV = "stage";
      assert.throws(() => loadApiConfig(), /AUTH_MODE=auth0 is required when APP_ENV=stage/u);
      process.env.APP_ENV = "prod";
      assert.throws(() => loadApiConfig(), /AUTH_MODE=auth0 is required when APP_ENV=prod/u);
    },
  );
});

test("stage and production reject disabled and trusted-header authentication", () => {
  withTemporaryProject(
    {
      "db/env/prod.env": "APP_ENV=prod\nPOSTGRES_DB=cemetery_mapping_prod\nPOSTGRES_USER=cemetery_app\nPOSTGRES_PASSWORD=prod_password\n",
    },
    () => {
      process.env.APP_ENV = "prod";
      process.env.AUTH_MODE = "disabled";
      assert.throws(() => loadApiConfig(), /AUTH_MODE must be auth0 when APP_ENV=prod/u);
      process.env.AUTH_MODE = "trusted-header";
      assert.throws(() => loadApiConfig(), /AUTH_MODE must be auth0 when APP_ENV=prod/u);
    },
  );
});

test("production accepts complete Auth0 configuration", () => {
  withTemporaryProject(
    {
      "db/env/prod.env": "APP_ENV=prod\nPOSTGRES_DB=cemetery_mapping_prod\nPOSTGRES_USER=cemetery_app\nPOSTGRES_PASSWORD=prod_password\n",
    },
    () => {
      process.env.APP_ENV = "prod";
      process.env.AUTH_MODE = "auth0";
      process.env.AUTH0_DOMAIN = "cemetery.example.auth0.com";
      process.env.AUTH0_AUDIENCE = "https://cemetery.example/api";
      const config = loadApiConfig();
      assert.equal(config.auth.mode, "auth0");
    },
  );
});

test("database tooling requires an external password when a tracked environment has none", () => {
  withTemporaryProject(
    {
      "db/env/stage.env": "APP_ENV=stage\nPOSTGRES_DB=cemetery_mapping_stage\nPOSTGRES_USER=cemetery_app\nPOSTGRES_PORT=5434\n",
    },
    () => {
      assert.throws(() => loadDbEnvironment("stage"), /POSTGRES_PASSWORD is required for stage/u);
      process.env.POSTGRES_PASSWORD = "injected-stage-password";
      assert.equal(loadDbEnvironment("stage").POSTGRES_PASSWORD, "injected-stage-password");
    },
  );
});
