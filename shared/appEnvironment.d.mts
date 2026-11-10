export type AppEnvironment = "DEV" | "TEST" | "STAGE" | "PROD";
export function resolveAppEnvironment(configured: string | undefined, mode: string): AppEnvironment;
