import { lazy, Suspense } from "react";
import { isAuth0Enabled } from "./config/environment";

const MaintenanceTasksPage = lazy(() => import("./components/MaintenanceTasksPage").then(module => ({default:module.MaintenanceTasksPage})));
const ExportRecordsPage = lazy(() => import("./components/ExportRecordsPage").then(module => ({default:module.ExportRecordsPage})));
const App = lazy(() => import("./App"));
const Auth0AppProvider = lazy(() => import("./auth/Auth0AppProvider").then((module) => ({ default: module.Auth0AppProvider })));
const RequestAccessPage = lazy(() => import("./components/RequestAccessPage").then((module) => ({ default: module.RequestAccessPage })));
const FieldCollectionPage = lazy(() => import("./components/field/FieldCollectionPage").then((module) => ({ default: module.FieldCollectionPage })));

const pending=<main className="auth-screen" role="status">Loading cemetery workspace…</main>;

export function ApplicationRoot() {
  const path=window.location.pathname.replace(/\/$/u, "");
  if(path==="/field")return <Suspense fallback={pending}><FieldCollectionPage/></Suspense>;
  if (path === "/request-access") {
    return <Suspense fallback={pending}><RequestAccessPage /></Suspense>;
  }
  const application = <Suspense fallback={pending}>{path==="/exports"?<ExportRecordsPage/>:path==="/tasks"?<MaintenanceTasksPage/>:<App />}</Suspense>;
  if (!isAuth0Enabled) return application;
  return <Suspense fallback={pending}><Auth0AppProvider>{application}</Auth0AppProvider></Suspense>;
}
