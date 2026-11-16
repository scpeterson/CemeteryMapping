import { expect, test } from "@playwright/test";
import { cemeteryId, fixture, geometry, summaries, showApplicationActions } from "./fixtures/cemetery";
import { markerSummary } from "./fixtures/overview";
import { reportDefinitions } from "../server/reports/definitions.mjs";
import { runReport } from "../server/reportsRepository.mjs";

const readerCemetery="22222222-2222-4222-8222-222222222222";
const standaloneCemetery="33333333-3333-4333-8333-333333333333";
const definition=reportDefinitions.find(report=>report.id==="unreadable-monument-inscriptions")!;
const user={role:"power-user",cemeteryAccess:[{cemeteryId,role:"power-user"}]};
const visit=(year:number,faces:Record<string,unknown>[])=>({inspectionYear:year,inspectedAt:`${year}-11-10`,source:year===2026?"Field survey":"Earlier survey",inscription:"",faces});
const rows=[{marker_uuid:"marker-1",monument:"TLC-HS-0567",cemetery_id:cemeteryId,cemetery:"Test Cemetery",section:"C",geometry:markerSummary.geometry,
 inspections:[visit(2026,[{id:"front",label:"Front",inscription:"",inscriptionStatus:"illegible"},{id:"back",label:"Back",inscription:"Name [illegible] 1880",currentLegibility:"partially_legible"}]),
 visit(2005,[{id:"front",label:"Front",inscription:"Name 1880",currentLegibility:"legible"},{id:"back",label:"Back",inscription:"",inscriptionStatus:"illegible"}])]},
 {marker_uuid:"recovered",monument:"TLC-HS-0568",cemetery_id:cemeteryId,cemetery:"Test Cemetery",section:"C",
 inspections:[visit(2026,[{id:"front",label:"Front",inscription:"Recovered name",currentLegibility:"legible"}]),visit(2005,[{id:"front",label:"Front",inscription:"",inscriptionStatus:"illegible"}])]}];

for(const width of [1280,390]) test(`legibility filters and previous-visit evidence are usable at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});
 await fixture(page);
 await page.route("**/api/me",route=>route.fulfill({json:{role:"power-user",assignedCemeteryIds:[cemeteryId,readerCemetery,standaloneCemetery],cemeteryMemberships:[{cemeteryId,role:"power-user"},{cemeteryId:readerCemetery,role:"reader"},{cemeteryId:standaloneCemetery,role:"power-user"}],permissions:{}}}));
 await page.route("**/api/cemetery-map",route=>route.fulfill({json:{boundaries:[{type:"Feature",properties:{id:cemeteryId,name:"Test Cemetery"},geometry},{type:"Feature",properties:{id:readerCemetery,name:"Reader Cemetery"},geometry},{type:"Feature",properties:{id:standaloneCemetery,name:"Standalone Cemetery"},geometry}],graves:summaries,sections:[{id:"section-c",cemeteryId,name:"C",geometry}],lots:[],headstones:[]}}));
 await page.route("**/api/reports",route=>route.fulfill({json:[definition]}));
 const requests:Record<string,string>[]=[];
 await page.route("**/api/reports/run",async route=>{
  const payload=route.request().postDataJSON();expect(payload.reportId).toBe(definition.id);requests.push(payload.parameters);
  const pool={async connect(){return {async query(){return {rows};},release(){}};}};
  await route.fulfill({json:await runReport(pool,definition.id,payload.parameters,user)});
 });
 await page.goto("/");
 await showApplicationActions(page);
 await page.getByRole("button",{name:"Open reports: run saved cemetery reports and guided queries",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Reports",exact:true});
 const cemetery=dialog.getByRole("combobox",{name:"Cemetery",exact:true});
 await expect(cemetery.getByRole("option",{name:"Reader Cemetery",exact:true})).toHaveCount(0);
 await expect(cemetery.getByRole("option",{name:"Standalone Cemetery",exact:true})).toHaveCount(1);
 await cemetery.selectOption(cemeteryId);
 await dialog.getByRole("combobox",{name:"Section",exact:true}).selectOption("C");
 await dialog.getByRole("combobox",{name:"Include plot markers",exact:true}).selectOption("no");
 await dialog.getByRole("combobox",{name:"Show",exact:true}).selectOption("history");
 await dialog.getByRole("button",{name:"Run",exact:true}).click();
 expect(requests[0]).toEqual({cemeteryId,sectionName:"C",includePlotMarkers:"no",legibility:"history"});
 await expect(dialog.getByRole("columnheader",{name:"Previous inspection / source",exact:true})).toBeVisible();
 await expect(dialog.getByRole("cell",{name:"Fully illegible",exact:true})).toHaveCount(3);
 await expect(dialog.getByRole("cell",{name:"Partially illegible",exact:true})).toHaveCount(1);
 await expect(dialog.getByRole("cell",{name:"Worsened",exact:true})).toBeVisible();
 await expect(dialog.getByRole("cell",{name:"Improved",exact:true})).toHaveCount(2);
 await expect(dialog.getByRole("cell",{name:"2005-11-10 · Earlier survey",exact:true})).toHaveCount(3);
 await expect(dialog.getByRole("cell",{name:"Recovered name",exact:true})).toBeVisible();
 const table=dialog.locator(".report-table-wrap");
 await expect.poll(async()=> (await table.boundingBox())?.height??0).toBeGreaterThan(100);
 await expect(dialog.getByRole("combobox",{name:"Section",exact:true})).toHaveCSS("border-top-left-radius","7px");
 await table.scrollIntoViewIfNeeded();
 await dialog.getByRole("cell",{name:"Worsened",exact:true}).scrollIntoViewIfNeeded();
 await dialog.screenshot({path:testInfo.outputPath(`legibility-report-${width}.png`)});
 await page.emulateMedia({media:"print"});
 await expect(page.locator(".report-table-wrap")).toHaveCSS("max-height","none");
 await expect(page.locator(".report-table-wrap")).toHaveCSS("overflow","visible");
 await page.emulateMedia({media:"screen"});
 await dialog.getByRole("combobox",{name:"Show",exact:true}).selectOption("full");
 await expect(dialog.getByText(/Previous results—filters changed/)).toBeVisible();
 await dialog.getByRole("button",{name:"Run",exact:true}).click();
 await expect(dialog.getByRole("cell",{name:"Recovered name",exact:true})).toHaveCount(0);
 await expect(dialog.getByRole("cell",{name:"Worsened",exact:true})).toBeVisible();
 await cemetery.selectOption(standaloneCemetery);
 await expect(dialog.getByRole("combobox",{name:"Section",exact:true})).toHaveValue("");
 await expect(dialog.getByRole("combobox",{name:"Section",exact:true}).getByRole("option",{name:"C",exact:true})).toHaveCount(0);
});
