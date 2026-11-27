import {test,expect} from '@playwright/test';
import {fixture,cemeteryId,showApplicationActions} from './fixtures/cemetery';
const section='22222222-2222-4222-8222-222222222222',block='33333333-3333-4333-8333-333333333333';
function snapshot(){return {revision:'4',catalog:[{key:'flat_markers_only',label:'Flat markers only'},{key:'no_gravesites',label:'Prohibit gravesites'}],cemeteries:[{id:cemeteryId,name:'Example Cemetery'}],sections:[{id:section,cemeteryId,name:'G'}],blocks:[{id:block,cemeteryId,sectionId:section,name:'1'}],policies:[{cemetery_id:null,section_uuid:null,block_uuid:null,rule_key:'flat_markers_only',enabled:true,reason:'System default'},{cemetery_id:cemeteryId,section_uuid:null,block_uuid:null,rule_key:'flat_markers_only',enabled:false,reason:'Cemetery exception'},{cemetery_id:cemeteryId,section_uuid:section,block_uuid:null,rule_key:'flat_markers_only',enabled:true,reason:'Section rule'},{cemetery_id:cemeteryId,section_uuid:section,block_uuid:block,rule_key:'flat_markers_only',enabled:false,reason:'Block exception'}],history:[] as unknown[]};}
async function setup(page:import('@playwright/test').Page,role='admin',hasAccount=true){
 await fixture(page);
 await page.route('**/api/me',r=>r.fulfill({json:{...(hasAccount?{id:'44444444-4444-4444-8444-444444444444'}:{}),role,assignedCemeteryIds:[cemeteryId],cemeteryAccess:[{cemeteryId,role,canEdit:true}],permissions:{canManageUsers:role==='admin',canOpenAdminPanel:true,canViewOwnership:true}}}));
 await page.route('**/api/admin/**',r=>r.fulfill({json:[]}));
 await page.route('**/api/admin/access-request-stats',r=>r.fulfill({json:{pending:0,lastHour:0,limits:{pending:100,hourly:100}}}));
 await page.route('**/api/maintenance-tasks/summary**',r=>r.fulfill({json:{}}));
 await page.route('**/api/admin/cemetery-records',r=>r.fulfill({json:{cemeteries:[],sections:[],lots:[]}}));
 const data=snapshot();await page.route('**/api/admin/policies',r=>r.fulfill({json:data}));
 await page.goto('/');await showApplicationActions(page);await page.getByRole('button',{name:/^Open administration:/}).click();
 return {admin:page.getByRole('dialog',{name:'Admin management'}),data};
}
for(const width of [1280,390])test(`policy inheritance, preview protection and audited save fit at ${width}px`,async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:1000});const {admin,data}=await setup(page);
 await admin.getByRole('button',{name:'Policies',exact:true}).click();
 await expect(admin).toContainText('Source: System');
 await admin.getByRole('combobox',{name:'Cemetery',exact:true}).selectOption(cemeteryId);await expect(admin).toContainText('Source: Example Cemetery');
 await admin.getByRole('combobox',{name:'Section',exact:true}).selectOption(section);await expect(admin).toContainText('Source: Section G');
 await admin.getByRole('combobox',{name:'Block',exact:true}).selectOption(block);await expect(admin).toContainText('Source: Block 1');
 await admin.getByRole('button',{name:'Edit Flat markers only',exact:true}).click();
 await expect(admin.getByRole('combobox',{name:'Local value',exact:true})).toHaveValue('disabled');
 await admin.getByRole('combobox',{name:'Local value',exact:true}).selectOption('inherit');await admin.getByRole('textbox',{name:'Reason',exact:true}).fill('Remove reviewed block exception');
 const save=admin.getByRole('button',{name:'Save policy',exact:true});await expect(save).toBeDisabled();
 let previews=0,saves=0;
 await page.route('**/api/admin/policies/preview',r=>{previews++;expect(r.request().postDataJSON()).toMatchObject({cemeteryId,sectionId:section,blockId:block,value:null,revision:'4'});return r.fulfill({json:{previewToken:'proof',impact:{graves:1,markers:1,burials:2}}});});
 await page.route('**/api/admin/policies/save',r=>{saves++;expect(r.request().postDataJSON().previewToken).toBe('proof');data.policies.pop();data.revision='5';data.history=[{id:'history',created_at:'2026-11-19T15:00:00Z',actor_email:'admin@example.test',scope_label:'Example Cemetery / Section G / Block 1',rule_key:'flat_markers_only',before_value:{enabled:false},after_value:null,reason:'Remove reviewed block exception'}];return r.fulfill({json:{revision:'5'}});});
 await admin.getByRole('button',{name:'Preview change',exact:true}).click();await expect(admin).toContainText('No conflicts found');await expect(save).toBeEnabled();
 await admin.getByRole('textbox',{name:'Reason',exact:true}).fill('Updated reviewed exception');await expect(save).toBeDisabled();
 await admin.getByRole('button',{name:'Preview change',exact:true}).click();await expect(save).toBeEnabled();await save.click();
 await expect(admin).toContainText('Policy saved.');await expect(admin).toContainText('Disabled → Inherit');expect(previews).toBe(2);expect(saves).toBe(1);
 const overflow=await admin.locator('.policies-admin').evaluate(el=>el.scrollWidth>el.clientWidth+1);expect(overflow).toBe(false);expect(errors).toEqual([]);await admin.screenshot({path:testInfo.outputPath(`policies-${width}.png`)});
});
test('cemetery administrator has no system option and a conflicting preview cannot be saved',async({page})=>{
 const {admin}=await setup(page,'cemetery-admin');await admin.getByRole('button',{name:'Policies',exact:true}).click();
 await expect(admin.getByRole('combobox',{name:'Cemetery',exact:true})).toHaveValue(cemeteryId);await expect(admin.getByRole('option',{name:'System defaults',exact:true})).toHaveCount(0);
 await admin.getByRole('button',{name:'Edit Prohibit gravesites',exact:true}).click();await admin.getByRole('combobox',{name:'Local value',exact:true}).selectOption('enabled');await admin.getByRole('textbox',{name:'Reason',exact:true}).fill('Review grave exclusion');
 await page.route('**/api/admin/policies/preview',r=>r.fulfill({status:409,json:{error:'Policy conflict: Existing graves are prohibited by this rule. No policy was saved.'}}));
 await admin.getByRole('button',{name:'Preview change',exact:true}).click();await expect(admin.getByRole('alert')).toContainText('Existing graves');await expect(admin.getByRole('button',{name:'Save policy',exact:true})).toBeDisabled();
});
test('power users cannot open policy administration',async({page})=>{const {admin}=await setup(page,'power-user');await expect(admin.getByRole('button',{name:'Policies',exact:true})).toHaveCount(0);});

test('sessions without an attributable account cannot preview or save policies',async({page})=>{
 const {admin}=await setup(page,'admin',false);await admin.getByRole('button',{name:'Policies',exact:true}).click();
 await expect(admin).toContainText('A signed-in application account is required');await expect(admin.getByRole('button',{name:'Preview change',exact:true})).toBeDisabled();await expect(admin.getByRole('button',{name:'Save policy',exact:true})).toBeDisabled();
});

test('failed policy load stops loading and retry clears the error',async({page})=>{
 const {admin,data}=await setup(page,'cemetery-admin');
 await page.route('**/api/admin/policies',r=>r.fulfill({status:404,json:{}}));
 await admin.getByRole('button',{name:'Policies',exact:true}).click();
 await expect(admin.getByRole('alert')).toContainText('no longer available');
 await expect(admin.getByText('Loading policies…',{exact:true})).toHaveCount(0);
 await page.route('**/api/admin/policies',r=>r.fulfill({json:data}));
 await admin.getByRole('button',{name:'Reload policies',exact:true}).click();
 await expect(admin.getByRole('alert')).toHaveCount(0);
 await expect(admin.getByRole('combobox',{name:'Cemetery',exact:true})).toHaveValue(cemeteryId);
 await expect(admin).toContainText('Source: Example Cemetery');
});

test("a Trinity administrator can view and update one plot's approved exceptions", async ({ page }) => {
  const { admin, data } = await setup(page);
  Object.assign(data.cemeteries[0], { facilityId: "1", name: "Trinity Lutheran Church Cemetery" });
  const approval = "Signed G-72 deed";
  const burial = { max_ashes_without_casket: 3, max_ashes_with_casket: 0, approval_reference: approval };
  const marker = { max_width_inches: 36, approval_reference: approval };
  await page.route("**/api/admin/policies/gravesite-exceptions**", route => {
    if (route.request().method() === "GET") {
      expect(new URL(route.request().url()).searchParams.get("query")).toBe("G-72");
      return route.fulfill({ json: [{ id: block, plotId: "G-072", capacityEnforced: true, burial, marker }] });
    }
    expect(route.request().postDataJSON()).toMatchObject({
      cemeteryId, graveId: block, rule: "marker", expected: marker, markerWidth: 37, approval: "Updated written approval",
    });
    return route.fulfill({ json: { max_width_inches: 37, approval_reference: "Updated written approval" } });
  });
  await admin.getByRole("button", { name: "Policies", exact: true }).click();
  await admin.getByRole("combobox", { name: "Cemetery", exact: true }).selectOption(cemeteryId);
  await admin.getByText("Gravesite exceptions", { exact: true }).click();
  await admin.getByLabel("Gravesite ID").fill("G-72");
  await admin.getByRole("button", { name: "Find gravesite" }).click();
  await expect(admin.getByLabel("Maximum sets of ashes without a casket")).toHaveValue("3");
  const width = admin.getByRole("form", { name: "Flush marker width exception" });
  await expect(width.getByLabel("Maximum width (inches)")).toHaveValue("36");
  await width.getByLabel("Maximum width (inches)").fill("37");
  await width.getByLabel("Written approval reference").fill("Updated written approval");
  await width.getByRole("button", { name: "Update marker width exception" }).click();
  await expect(admin.getByRole("status")).toHaveText("Approved exception saved.");
});
