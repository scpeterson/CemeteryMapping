import React from "react";
import ReactDOM from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import App from "./App";
const RequestAccessPage = React.lazy(() => import("./components/RequestAccessPage").then((module) => ({ default: module.RequestAccessPage })));
import { Auth0AppProvider } from "./auth/Auth0AppProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/u, "") === "/request-access" ? <React.Suspense fallback={<main className="auth-screen">Loading request form…</main>}><RequestAccessPage /></React.Suspense> : (
      <Auth0AppProvider>
        <App />
      </Auth0AppProvider>
    )}
  </React.StrictMode>,
);
