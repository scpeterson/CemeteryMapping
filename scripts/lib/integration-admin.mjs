import { loadDbEnvironment } from "./run-liquibase.mjs";

// Schema fixture creation is test infrastructure, not an application privilege.
export function integrationAdminDatabase(config) {
  if (config.appEnv !== "test") throw new Error("Schema fixtures require APP_ENV=test");
  const admin = loadDbEnvironment("test");
  return { ...config.database, user: admin.POSTGRES_USER, password: admin.POSTGRES_PASSWORD };
}
