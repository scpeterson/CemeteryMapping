export type AppEnvironment = "DEV" | "TEST" | "STAGE" | "PROD";
export type AppVersionMetadata = {
  version: string;
  gitSha: string;
  buildTime: string;
  environment: AppEnvironment;
};

export const appEnvironment = (import.meta.env.VITE_APP_ENV ?? "DEV") as AppEnvironment;
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";
export const appVersionMetadata: AppVersionMetadata = {
  version: __APP_VERSION__,
  gitSha: __GIT_SHA__,
  buildTime: __BUILD_TIME__,
  environment: appEnvironment,
};

export const auth0Domain = import.meta.env.VITE_AUTH0_DOMAIN;
export const auth0ClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
export const auth0Audience = import.meta.env.VITE_AUTH0_AUDIENCE;
export const auth0Scope = import.meta.env.VITE_AUTH0_SCOPE ?? "read:cemetery write:cemetery read:deeds write:deeds";
export const isAuth0Enabled = Boolean(auth0Domain && auth0ClientId && auth0Audience);
