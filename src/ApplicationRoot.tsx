import { lazy, Suspense } from "react";
import { isAuth0Enabled } from "./config/environment";

const App = lazy(() => import("./App"));
const Auth0AppProvider = lazy(() => import("./auth/Auth0AppProvider").then((module) => ({ default: module.Auth0AppProvider })));
const RequestAccessPage = lazy(() => import("./components/RequestAccessPage").then((module) => ({ default: module.RequestAccessPage })));

export function ApplicationRoot() {
  if (window.location.pathname.replace(/\/$/u, "") === "/request-access") {
    return <Suspense fallback={<main className="auth-screen" role="status">Loading request form…</main>}><RequestAccessPage /></Suspense>;
  }
  const application = <Suspense fallback={<main className="auth-screen" role="status">Loading cemetery map…</main>}><App /></Suspense>;
  if (!isAuth0Enabled) return application;
  return <Suspense fallback={<main className="auth-screen" role="status">Connecting to cemetery access…</main>}><Auth0AppProvider>{application}</Auth0AppProvider></Suspense>;
}
