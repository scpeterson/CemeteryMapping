import {test,expect} from '@playwright/test';
import {fixture,geometry,summaries,detail,gravePath,select} from './fixtures/cemetery';

for(const width of [390,1280]) {
 test(`stack editor preserves historical authorization and reports cutoff errors at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:1000});await fixture(page);
  const requests:Record<string,unknown>[]=[];
  await page.route(gravePath('A-TEST'),route=>{
   if(route.request().method()==='PATCH') {requests.push(route.request().postDataJSON());return route.fulfill({status:400,json:{error:'New stacking authorizations must predate 2027-03-01; earlier reservations remain valid.'}});}
   return route.fulfill({json:detail('A-TEST')});
  });
  await page.goto('/');
  if(width===390)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
  await select(page,'A-TEST');await page.getByRole('tab',{name:'Location and geometry',exact:true}).click();
  await expect(page.locator('article.grave-record')).toContainText('Single-level');
  await page.getByRole('button',{name:/Edit gravesite/}).click();
  await expect(page.getByLabel('Stacking authorization date')).toHaveCount(0);
  await page.getByLabel('Stack group',{exact:true}).fill('Family stack');
  await page.getByLabel('Level (1 = bottom)',{exact:true}).fill('2');
  await expect(page.getByLabel('Stacking authorization date')).toHaveAttribute('required','');
  await page.getByLabel('Stacking authorization date').fill('2027-03-01');
  await page.getByLabel('Authorization reference',{exact:true}).fill('Reservation register 12');
  await page.getByRole('button',{name:'Save gravesite',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('must predate 2027-03-01');
  expect(requests[0]).toMatchObject({stackGroup:'Family stack',stackLevel:2,stackingAuthorizedOn:'2027-03-01',stackingAuthorizationReference:'Reservation register 12'});
  await page.getByLabel('Stacking authorization date').fill('2027-02-28');
  await page.screenshot({path:testInfo.outputPath(`grave-stack-${width}.png`),fullPage:true});
  const field=page.getByRole('group',{name:'Vertical stacking'});
  for(const input of await field.locator('input').all()) {const box=await input.boundingBox();expect(box!.width).toBeGreaterThan(100);expect(box!.x+box!.width).toBeLessThanOrEqual(width);}
  await page.getByLabel('Stack group',{exact:true}).fill('');
  await page.getByRole('button',{name:'Save gravesite',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(2);
  expect(requests[1]).toMatchObject({stackGroup:'',stackLevel:null,stackingAuthorizedOn:'',stackingAuthorizationReference:''});
 });
}

test('map click offers separate top and bottom graves without changing their footprints',async({page})=>{
 await page.setViewportSize({width:1280,height:1000});await fixture(page);
 const graves=summaries.map((grave,i)=>({...grave,stackGroup:'Family stack',stackLevel:i+1,stackTopLevel:2,status:i===0?'occupied':'reserved'}));
 await page.route('**/api/cemetery-map',route=>route.fulfill({json:{boundaries:[{type:'Feature',properties:{name:'Test Cemetery'},geometry}],sections:[],lots:[],graves,headstones:[]}}));
 await page.goto('/tests/map-highlighting.html');
 await expect.poll(()=>page.evaluate(()=>Boolean(window.mapHighlightTest?.map.getLayer('graves-fill')))).toBe(true);
 await page.getByRole('button',{name:/^Diagram view:/}).click();
 await expect.poll(()=>page.evaluate(()=>window.mapHighlightTest.map.isMoving())).toBe(false);
 await page.evaluate(()=>{const map=window.mapHighlightTest.map;map.fire('click',{point:map.project([-80,40]),lngLat:{lng:-80,lat:40},originalEvent:{target:map.getCanvas()}});});
 const choices=page.getByRole('region',{name:'Stacked graves'});
 await expect(choices).toContainText('Level 2 (Top)');await expect(choices).toContainText('Level 1 (Bottom)');
 await choices.getByRole('button',{name:/Level 1/}).click();await expect(page.locator('.detail-panel')).toContainText('Record ID: A-TEST');
 await choices.getByRole('button',{name:/Level 2/}).click();await expect(page.locator('.detail-panel')).toContainText('Record ID: B-TEST');
 expect(graves[0].geometry).toEqual(graves[1].geometry);
});

for(const role of ['admin','cemetery-admin','power-user']) test(`cemetery cutoff controls enforce ${role} access`,async({page})=>{
 const {showApplicationActions,cemeteryId}=await import('./fixtures/cemetery');
 await fixture(page);
 if(role!=='admin')await page.route('**/api/me',route=>route.fulfill({json:{role,assignedCemeteryIds:[cemeteryId],cemeteryMemberships:[{cemeteryId,role}],permissions:{canManageUsers:false,canOpenAdminPanel:true,canViewOwnership:true,canUpdateGravesites:true}}}));
 const cemetery={id:cemeteryId,name:'Trinity Lutheran Church Cemetery',fullAddress:'',municipality:'',agency:'',agencyUrl:'',operationalHours:'',contactName:'',contactPhone:'',contactEmail:'',imageUrl:'',notes:'',stackingAuthorizationCutoff:'2027-03-01',stackingPolicyNotes:'Earlier reservations honored',createdAt:'',updatedAt:''};
 await page.route('**/api/admin/**',route=>{
  const path=new URL(route.request().url()).pathname;
  return route.fulfill({json:path.endsWith('/cemetery-records')?{cemeteries:[cemetery],sections:[],lots:[]}:path.endsWith('/access-request-stats')?{pending:0,lastHour:0,limits:{pending:200,hourly:100}}:[]});
 });
 await page.goto('/');await showApplicationActions(page);await page.getByRole('button',{name:/^Open administration:/}).click();
 const admin=page.getByRole('dialog',{name:'Admin management'});
 await admin.getByRole('button',{name:'Records',exact:true}).click();
 await admin.getByRole('combobox',{name:'Cemetery',exact:true}).selectOption(cemeteryId);
 const cutoff=admin.getByLabel('No new stacking authorizations on or after');
 await expect(cutoff).toHaveValue('2027-03-01');
 if(role!=='power-user')await expect(cutoff).toBeEnabled();else await expect(cutoff).toBeDisabled();
});
