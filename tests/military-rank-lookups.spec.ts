import { expect, test } from "@playwright/test";
import { fixture, showApplicationActions } from "./fixtures/cemetery";

for (const width of [1280, 390]) test(`military rank administration creates, edits and retains inactive ranks at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({width,height:1000});
  await fixture(page);
  const branchId="11111111-1111-4111-8111-111111111111";
  const row={id:"22222222-2222-4222-8222-222222222222",code:"tec4",label:"Technician Fourth Grade",description:"Historical Army rank",militaryBranchId:branchId,abbreviation:"Tec 4",payGrade:"4th Grade",rankGroup:"enlisted",isActive:true,usageCount:1,usageLabel:"burials",createdAt:"",updatedAt:""};
  let rows=[row];
  let lookupRequests=0;
  await page.route("**/api/headstone-lookups",route=>{lookupRequests++;return route.fulfill({json:{}});});
  await page.route("**/api/admin/lookups",route=>route.fulfill({json:{
    tables:[{table:"military_rank_types",label:"Military ranks",hasSourceFields:false,hasRankFields:true}],
    lookups:{military_rank_types:rows,military_branch_types:[{...row,id:branchId,label:"Army",code:"army"}]},
  }}));
  await page.route("**/api/admin/lookups/military_rank_types**",route=>{
    const body=route.request().postDataJSON();
    expect(body.militaryBranchId).toBe(branchId);
    expect(body.rankGroup).toBe("enlisted");
    if(route.request().method()==="POST"){
      const created={...row,...body,id:"33333333-3333-4333-8333-333333333333",usageCount:0};
      rows=[...rows,created];return route.fulfill({json:created});
    }
    const id=route.request().url().split("/").pop();
    const saved={...rows.find(r=>r.id===id)!,...body};
    rows=rows.map(r=>r.id===id?saved:r);return route.fulfill({json:saved});
  });
  await page.goto("/");await showApplicationActions(page);
  await page.getByRole("button",{name:/^Open administration:/}).click();
  const admin=page.getByRole("dialog",{name:"Admin management"});
  await admin.getByRole("button",{name:"Lookups",exact:true}).click();
  const tec=admin.locator(".lookup-row-list .lookup-row").first();
  await expect(tec.getByLabel("Military branch",{exact:true})).toBeDisabled();
  await expect(tec.getByLabel("Abbreviation",{exact:true})).toHaveValue("Tec 4");
  const newRow=admin.locator(".lookup-row-new");
  await newRow.getByLabel("Label",{exact:true}).fill("Technician Third Grade");
  await newRow.getByLabel("Description",{exact:true}).fill("Historical technical rank");
  await expect(newRow.getByRole("button",{name:"Add value",exact:true})).toBeDisabled();
  await newRow.getByLabel("Military branch",{exact:true}).selectOption(branchId);
  await newRow.getByLabel("Abbreviation",{exact:true}).fill("Tec 3");
  await newRow.getByLabel("Pay grade (optional)",{exact:true}).fill("3rd Grade");
  await newRow.getByRole("button",{name:"Add value",exact:true}).click();
  await expect(admin.locator(".lookup-row-list .lookup-row")).toHaveCount(2);
  await expect.poll(()=>lookupRequests).toBeGreaterThan(1);
  const added=admin.locator(".lookup-row-list .lookup-row").filter({has:page.locator('input[value="Technician Third Grade"]')});
  await added.getByLabel("Abbreviation",{exact:true}).fill("T/3");
  await added.getByRole("button",{name:"Save",exact:true}).click();
  await expect(admin).toContainText("Technician Third Grade saved.");
  await admin.getByRole("button",{name:"Refresh",exact:true}).click();
  await expect(added.getByLabel("Abbreviation",{exact:true})).toHaveValue("T/3");
  expect(await admin.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  if (width < 800) {
    const boxes = await added.locator(":scope > *").evaluateAll(elements => elements.map(el => {
      const rect = el.getBoundingClientRect(); return {top:rect.top,bottom:rect.bottom};
    }));
    for (let i=1;i<boxes.length;i++) expect(boxes[i].top).toBeGreaterThanOrEqual(boxes[i-1].bottom-1);
  }
  await added.scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath(`military-ranks-${width}.png`)});
  await added.getByLabel("Active",{exact:true}).uncheck();
  await added.getByRole("button",{name:"Save",exact:true}).click();
  await expect(admin.locator(".lookup-row-list .lookup-row")).toHaveCount(1);
  await admin.getByLabel("Show inactive",{exact:true}).check();
  await expect(added.getByLabel("Active",{exact:true})).not.toBeChecked();
});
