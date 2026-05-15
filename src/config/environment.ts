export type AppEnvironment = "DEV" | "TEST" | "STAGE" | "PROD";

export const appEnvironment = (import.meta.env.VITE_APP_ENV ?? "DEV") as AppEnvironment;
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";
