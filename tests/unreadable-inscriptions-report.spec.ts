import { expect, test } from "@playwright/test";
import { fixture } from "./fixtures/cemetery";
import { reportDefinitions } from "../server/reports/definitions.mjs";

test("power users can run the unreadable inscription report and see inspection evidence", async ({ page }) => {
  await fixture(page);
  await page.route("**/api/me", route => route.fulfill({json:{role:"power-user",assignedCemeteryIds:[],permissions:{}}}));
  const definition = reportDefinitions.find(r => r.id === "unreadable-monument-inscriptions")!;
  await page.route("**/api/reports", route => route.fulfill({json:[definition]}));
  await page.route("**/api/reports/run", async route => {
    expect(route.request().postDataJSON()).toEqual({reportId:definition.id,parameters:{}});
    await route.fulfill({json:{report:definition,summary:"1 monument has unreadable text in its latest inspection.",generatedAt:new Date().toISOString(),
      columns:[{key:"monument",label:"Monument ID"},{key:"inspection_date",label:"Inspection date/year"},{key:"inspection_source",label:"Inspection source"},{key:"inscription",label:"Latest inspection inscription"},{key:"affected_surfaces",label:"Affected surfaces"}],
      rows:[{monument:"TLC-HS-0567",inspection_date:"2026-11-10",inspection_source:"Field survey",inscription:"Back: Johann [ILLEGIBLE LINES] [ - ]",affected_surfaces:"Back"}],notes:["Older inspections do not cause a match."]}});
  });
  await page.goto("/");
  await page.getByRole("button",{name:"Open reports: run saved cemetery reports and guided queries",exact:true}).click();
  await expect(page.getByRole("button",{name:`${definition.title} power-user`,exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Run",exact:true}).click();
  await expect(page.getByRole("cell",{name:"TLC-HS-0567",exact:true})).toBeVisible();
  await expect(page.getByRole("cell",{name:"2026-11-10",exact:true})).toBeVisible();
  await expect(page.getByRole("cell",{name:"Back: Johann [ILLEGIBLE LINES] [ - ]",exact:true})).toBeVisible();
});
