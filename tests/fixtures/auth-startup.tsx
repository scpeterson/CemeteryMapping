import { Auth0Context, type Auth0ContextInterface } from "@auth0/auth0-react";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { AuthenticatedShell } from "../../src/auth/Auth0AppProvider";
import { authorizedFetch } from "../../src/api/apiClient";

const identity = {
  isLoading: false,
  isAuthenticated: true,
  user: { sub: "test-user", email: "test@example.test" },
  getAccessTokenSilently: async () => "startup-test-token",
} as Auth0ContextInterface;

export function StartupRequest() {
  useEffect(() => { void authorizedFetch("/auth-startup-probe"); }, []);
  return <p>Authenticated child mounted</p>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Context.Provider value={identity}>
      <AuthenticatedShell><StartupRequest /></AuthenticatedShell>
    </Auth0Context.Provider>
  </StrictMode>,
);
