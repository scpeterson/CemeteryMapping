import { StrictMode, useContext, useState } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Context, type Auth0ContextInterface } from "@auth0/auth0-react";
import "maplibre-gl/dist/maplibre-gl.css";
import "../src/styles.css";
import App from "../src/App";
import { AuthenticatedShell } from "../src/auth/Auth0AppProvider";

// Exercise the production shell with a controlled identity-provider boundary.
export function AuthHarness() {
  const defaults = useContext(Auth0Context);
  const [isAuthenticated, setAuthenticated] = useState(true);
  const identity = new URLSearchParams(window.location.search).get("identity") ?? "A very long signed in user name that must never push the Sign out button off screen@example.test";
  return <Auth0Context.Provider value={{ ...defaults, isLoading: false, isAuthenticated,
    user: identity ? { email: identity } : undefined,
    getAccessTokenSilently: (async () => "fixture-token") as Auth0ContextInterface["getAccessTokenSilently"],
    loginWithRedirect: async () => { setAuthenticated(true); },
    logout: async () => { setAuthenticated(false); },
  }}><AuthenticatedShell><App /></AuthenticatedShell></Auth0Context.Provider>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><AuthHarness /></StrictMode>);
