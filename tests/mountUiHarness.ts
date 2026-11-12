import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { ConfirmationProvider } from "../src/components/ui/ConfirmationProvider";
import { ConfirmationHarness, WhatsNewHarness } from "./uiHarness";

export function mountWhatsNewHarness(version: string) {
  const host = document.createElement("div");
  document.body.append(host);
  createRoot(host).render(createElement(WhatsNewHarness, { version }));
}
export function mountConfirmationHarness() {
  const host = document.createElement("div");
  document.body.append(host);
  createRoot(host).render(createElement(ConfirmationProvider, { children: createElement(ConfirmationHarness) }));
}
