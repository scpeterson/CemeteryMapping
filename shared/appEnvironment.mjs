const environments = new Set(["DEV", "TEST", "STAGE", "PROD"]);
const modes = { dev: "DEV", development: "DEV", test: "TEST", stage: "STAGE", prod: "PROD", production: "PROD" };

export function resolveAppEnvironment(configured, mode) {
  const explicit = configured?.trim().toUpperCase();
  if (explicit) {
    if (!environments.has(explicit)) throw new Error("VITE_APP_ENV must be DEV, TEST, STAGE or PROD.");
    return explicit;
  }
  const environment = Object.hasOwn(modes, mode) ? modes[mode] : undefined;
  if (!environment) throw new Error(`Unknown frontend environment mode: ${mode}`);
  return environment;
}
