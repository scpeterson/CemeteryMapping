import React from "react";
import ReactDOM from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import App from "./App";
import { Auth0AppProvider } from "./auth/Auth0AppProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Auth0AppProvider>
      <App />
    </Auth0AppProvider>
  </React.StrictMode>,
);
