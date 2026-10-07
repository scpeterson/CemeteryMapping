import { lazy, Suspense } from "react";
import App from "./App";
import { Auth0AppProvider } from "./auth/Auth0AppProvider";

const RequestAccessPage = lazy(() => import("./components/RequestAccessPage").then((module) => ({ default: module.RequestAccessPage })));

export function ApplicationRoot() {
  if (window.location.pathname.replace(/\/$/u, "") === "/request-access") {
    return <Suspense fallback={<main className="auth-screen">Loading request form…</main>}><RequestAccessPage /></Suspense>;
  }
  return <Auth0AppProvider><App /></Auth0AppProvider>;
}
