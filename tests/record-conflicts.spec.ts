import { expect, test } from "@playwright/test";
import { cemeteryId, gravePath, select, fixture } from "./fixtures/cemetery";
import { overviewFixture, overviewGrave } from "./fixtures/overview";

test("a stale burial keeps edits until an explicit confirmed reload and then saves the fresh version",async({page})=>{
  await overviewFixture(page);
  const record={...overviewGrave("A-TEST").burials[0],version:"10"};
  await page.route(gravePath("A-TEST"),route=>route.fulfill({json:{...overviewGrave("A-TEST"),burials:[record]}}));
  let attempts=0;let reloads=0;
  await page.route("**/api/burials/alice",async route=>{
    if(route.request().method()==="GET"){
      reloads++;
      return route.fulfill({json:{...record,version:"11",person:{...record.person,firstName:"Latest"}}});
    }
    const body=route.request().postDataJSON();attempts++;
    expect(body.expectedVersion).toBe(attempts===1?"10":"11");
    if(attempts===1)return route.fulfill({status:409,json:{error:"This record changed. Reload the latest values."}});
    return route.fulfill({json:{...record,version:"12",person:{...record.person,firstName:body.firstName}}});
  });
  await page.goto("/");await select(page,"A-TEST");await page.getByRole("tab",{name:"People and ownership"}).click();
  await page.getByRole("button",{name:"Edit burial Alice Example"}).click();
  const first=page.getByRole("textbox",{name:"First name",exact:true});await first.fill("Draft");
  await page.getByRole("button",{name:"Save burial",exact:true}).click();
  await expect(first).toHaveValue("Draft");
  const reload=page.getByRole("button",{name:"Reload latest values (discard edits)",exact:true});
  await page.setViewportSize({width:320,height:900});
  const details=page.getByRole("navigation",{name:"Workspace views"}).getByRole("button",{name:"Details",exact:true});
  if(await details.isVisible())await details.click();
  expect(await page.locator(".detail-panel").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  page.once("dialog",dialog=>dialog.dismiss());await reload.click();
  expect(reloads).toBe(0);await expect(first).toHaveValue("Draft");
  page.once("dialog",dialog=>dialog.accept());await reload.click();
  await expect(first).toHaveValue("Latest");await first.fill("Reviewed");
  await page.getByRole("button",{name:"Save burial",exact:true}).click();await expect(page.getByText("Reviewed Example",{exact:false}).first()).toBeVisible();
});

test("profile conflicts retain contact edits and reload a fresh account snapshot",async({page})=>{
  await fixture(page);
  let version="20";
  await page.route("**/api/me/profile",async route=>{
    if(route.request().method()==="PUT"){
      expect(route.request().postDataJSON().expectedVersion).toBe("20");version="21";
      return route.fulfill({status:409,json:{error:"This record changed."}});
    }
    return route.fulfill({json:{version,displayName:version==="20"?"Original":"Latest",phone:"",organization:"",preferredCemeteryId:"",email:"profile@example.test",createdAt:"2026-11-05"}});
  });
  await page.goto("/");await page.getByRole("button",{name:"My profile",exact:true}).click();
  const profile=page.getByRole("dialog",{name:"My profile"});const name=profile.getByRole("textbox",{name:"Display name",exact:true});
  await name.fill("Draft contact");await profile.getByRole("button",{name:"Save profile",exact:true}).click();
  await expect(name).toHaveValue("Draft contact");
  page.once("dialog",dialog=>dialog.accept());await profile.getByRole("button",{name:"Reload latest values (discard edits)",exact:true}).click();
  await expect(name).toHaveValue("Latest");
});

test("system user forms retain a conflicted membership snapshot and reload by account ID",async({page})=>{
  await fixture(page);
  const user={id:cemeteryId,version:"30:abc",externalSubject:"fixture|user",email:"member@example.test",displayName:"Original",role:"reader",assignedCemeteryIds:[cemeteryId],cemeteryMemberships:[{cemeteryId,role:"reader"}],isActive:true,createdAt:"2026-11-05",updatedAt:"2026-11-05"};
  await page.route("**/api/admin/cemetery-records",route=>route.fulfill({json:{cemeteries:[{id:cemeteryId,name:"Test Cemetery"}],sections:[],lots:[]}}));
  await page.route("**/api/admin/roles",route=>route.fulfill({json:[{name:"reader",description:"Reader",userCount:1}]}));
  await page.route("**/api/admin/access-requests",route=>route.fulfill({json:[]}));
  await page.route("**/api/admin/access-request-stats",route=>route.fulfill({json:{pending:0,lastHour:0,limits:{pending:200,hourly:100}}}));
  await page.route("**/api/admin/users**",async route=>{
    if(route.request().method()==="PUT"){
      expect(route.request().postDataJSON().expectedVersion).toBe("30:abc");
      return route.fulfill({status:409,json:{error:"This account or its memberships changed."}});
    }
    return route.fulfill({json:new URL(route.request().url()).pathname.endsWith(cemeteryId)?{...user,version:"31:def",displayName:"Latest"}:[user]});
  });
  await page.goto("/");await page.getByRole("button",{name:/^Open administration:/}).click();
  const admin=page.getByRole("dialog",{name:"Admin management"});await admin.locator(".admin-user-edit").filter({hasText:user.email}).click();
  const name=admin.getByRole("textbox",{name:"Display name",exact:true});await name.fill("Draft user");
  await admin.getByRole("button",{name:"Save user",exact:true}).click();await expect(name).toHaveValue("Draft user");
  page.once("dialog",dialog=>dialog.accept());await admin.getByRole("button",{name:"Reload latest values (discard edits)",exact:true}).click();await expect(name).toHaveValue("Latest");
});
