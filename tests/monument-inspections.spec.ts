import { expect, test, type Page } from '@playwright/test';
import { select, cemeteryId } from './fixtures/cemetery';
import { marker, overviewFixture } from './fixtures/overview';

const condition = {id:'unknown',code:'unknown',label:'Unknown'};
const inspections = () => [
 {id:'nhg',inspectedAt:'2005-10-11',inspectionYear:2005,sourceType:'nhg',source:'North Hills Genealogists',conditionId:condition.id,condition:'Excellent',conditionNotes:'exc cond',inscription:'Earlier NHG reading',updatedAt:'2026-10-21T12:00:00+00:00'},
 {id:'field',inspectedAt:'2026-10-13',inspectionYear:2026,sourceType:'field_survey',source:'Scott Peterson',conditionId:condition.id,condition:'Poor',conditionNotes:'Weathering observed in 2026',inscription:'  Partially visible\nreading  ',updatedAt:'2026-10-21T12:00:00+00:00'},
];
async function setup(page:Page,role='admin',assignedCemeteryIds:string[]=[]){
 await overviewFixture(page);
 await page.route('**/api/me',route=>route.fulfill({json:{role,assignedCemeteryIds,permissions:{canOpenAdminPanel:true,canViewOwnership:true}}}));
 await page.route('**/api/headstone-lookups',route=>route.fulfill({json:{markerTypes:[marker.markerType],markerScopes:[marker.markerScope],materials:[marker.material],conditions:[condition]}}));
 let entries=inspections();
 const patches:Record<string,unknown>[]=[];
 await page.route('**/api/headstones/marker-1',async route=>{
  if(route.request().method()==='PATCH'){
   const payload=route.request().postDataJSON();patches.push(payload);
   for(const deleted of payload.deletedInspections??[]) entries=entries.filter(i=>i.id!==deleted.id);
   for(const added of payload.newInspections??[]) entries.push({...added,condition:'Unknown',inspectionYear:Number(added.inspectedAt.slice(0,4)),updatedAt:'2026-10-22T12:00:00+00:00'});
   for(const edited of payload.updatedInspections??[]) entries=entries.map(i=>i.id===edited.id?{...i,...edited,condition:'Unknown',updatedAt:'2026-10-22T12:00:00+00:00'}:i);
  }
  await route.fulfill({json:{...marker,inspections:entries}});
 });
 await page.goto('/');
 const searchView = page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true});
 if((page.viewportSize()?.width ?? 1280) <= 760) await searchView.click();
 await select(page,'A-TEST');
 await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByRole('button',{name:/HS-OVERVIEW/}).click();
 await page.getByRole('tab',{name:'Details',exact:true}).click();
 return patches;
}

test('latest inspection is selected; dropdown displays only the chosen condition and inscription',async({page})=>{
 await setup(page);
 const history=page.getByRole('region',{name:'Inspections',exact:true});
 await expect(history.getByRole('combobox',{name:'Inspection',exact:true})).toHaveValue('field');
 await expect(history).toContainText('Poor');await expect(history).not.toContainText('exc cond');
 await history.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await expect(history).toContainText('Excellent');await expect(history).toContainText('Earlier NHG reading');
 await expect(history).not.toContainText('Weathering observed in 2026');
});

test('new inspection copies the selected inscription exactly and saves independently',async({page})=>{
 const patches=await setup(page);
 const history=page.getByRole('region',{name:'Inspections',exact:true});
 await history.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspectionStep(page, 'Faces & photos');
 await expect(history.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('  Partially visible\nreading  ');
 await inspectionStep(page, 'Visit & condition');
 await history.getByLabel('Inspection date',{exact:true}).fill('2026-10-22');
 await inspectionStep(page, 'Review & save');
 await history.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(history.getByRole('combobox',{name:'Inspection',exact:true})).not.toHaveValue('field');
 expect(patches).toHaveLength(1);expect(patches[0].inspectionChangesOnly).toBe(true);
 expect((patches[0].newInspections as {inscription:string}[])[0].inscription).toBe('  Partially visible\nreading  ');
 await history.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await history.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspectionStep(page, 'Faces & photos');
 await expect(history.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Earlier NHG reading');
});

test('cemetery admin can edit the selected inspection with a version; NHG date stays fixed',async({page})=>{
 const patches=await setup(page,'cemetery-admin',[cemeteryId]);
 const history=page.getByRole('region',{name:'Inspections',exact:true});
 await history.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await history.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await inspectionStep(page, 'Visit & condition');
 await expect(history.getByLabel('Inspection date',{exact:true})).toHaveValue('2005-10-11');
 await inspectionStep(page, 'Visit & condition');
 await expect(history.getByLabel('Inspection date',{exact:true})).toBeDisabled();
 await inspectionStep(page, 'Faces & photos');
 await history.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Reviewed source reading');
 await inspectionStep(page, 'Visit & condition');
 await history.getByRole('textbox',{name:'Monument condition notes',exact:true}).fill('Reviewed condition');
 await inspectionStep(page, 'Review & save');
 await history.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(history).toContainText('Reviewed source reading');
 expect(patches[0].newInspections).toEqual([]);
 expect((patches[0].updatedInspections as {expectedUpdatedAt:string}[])[0].expectedUpdatedAt).toBe('2026-10-21T12:00:00+00:00');
});

for(const [role,assignments] of [['reader',[cemeteryId]],['power-user',[cemeteryId]]] as [string,string[]][]){
 test(`${role} ${assignments.length?'assigned':'unassigned'} has read-only inspections`,async({page})=>{
  await setup(page,role,assignments);
  const history=page.getByRole('region',{name:'Inspections',exact:true});
  await expect(history.getByRole('button',{name:'Delete inspection',exact:true})).toHaveCount(0);
  await expect(history.getByRole('button',{name:'New inspection',exact:true})).toHaveCount(0);
  await expect(history.getByRole('button',{name:'Edit inspection',exact:true})).toHaveCount(0);
  await history.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
  await expect(history).toContainText('Earlier NHG reading');
 });
}

async function inspectionStep(page: Page, name: string) {
 const steps = page.getByRole('navigation', { name: 'Inspection steps' });
 if (!await steps.isVisible()) return;
 // Next/Return open the full review even when a step shortcut would target a missing field.
 if(name==='Review & save'){
  const forward=page.getByRole('button',{name:/^(Return to review|Next: Review & save)$/});
  if(await forward.isVisible()){await forward.click();return;}
  const faces=page.getByRole('button',{name:'Next: Faces & photos',exact:true});
  if(await faces.isVisible()){
   await faces.click();
   await page.getByRole('button',{name:'Next: Review & save',exact:true}).click();return;
  }
 }
 await steps.getByRole('button', { name: new RegExp(name) }).click();
}

test('focused stages retain edits, explain incomplete visits, and review before saving on phones', async ({page}, testInfo) => {
 await page.setViewportSize({width:390,height:844});
 const patches = await setup(page);
 const history = page.getByRole('region',{name:'Inspections',exact:true});
 await history.getByRole('button',{name:'New inspection',exact:true}).click();
 await expect(history.getByLabel('Inspection date',{exact:true})).toBeVisible();
 await expect(history.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveCount(0);
 await history.getByLabel('Inspection source',{exact:true}).fill('');
 await history.getByRole('button',{name:'Next: Faces & photos',exact:true}).click();
 await expect(history.getByRole('heading',{name:'Faces & photos',exact:true})).toBeFocused();
 await history.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Phone inspection\nSecond line');
 await history.getByRole('button',{name:'Next: Review & save',exact:true}).click();
 await expect(history.getByRole('button',{name:'Save inspection',exact:true})).toBeDisabled();
 await expect(history).toContainText('Required: enter an inspection source');
 await history.getByRole('button',{name:'Back',exact:true}).click();
 await expect(history.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Phone inspection\nSecond line');
 await history.getByRole('button',{name:'Back',exact:true}).click();
 await history.getByLabel('Inspection source',{exact:true}).fill('Phone field visit');
 await inspectionStep(page,'Review & save');
 await expect(history).toContainText('Phone field visit');
 await expect(history).toContainText('Phone inspection');
 expect(patches).toHaveLength(0);
 await history.getByRole('button',{name:'Save inspection',exact:true}).scrollIntoViewIfNeeded();
 const readingBox = await history.locator('.inspection-stage:not([hidden]) .inscription-box').boundingBox();
 const saveBox = await history.getByRole('button',{name:'Save inspection',exact:true}).boundingBox();
 expect(readingBox).not.toBeNull(); expect(saveBox).not.toBeNull();
 expect(readingBox!.y + readingBox!.height).toBeLessThan(saveBox!.y);
 await page.screenshot({path:testInfo.outputPath('inspection-review-phone.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await history.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(history.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(patches).toHaveLength(1);
});

test('marker information is a small independent form, with face and source editing still available', async ({page}, testInfo) => {
 const patches = await setup(page);
 await page.getByRole('button',{name:'Edit marker information HS-OVERVIEW',exact:true}).click();
 const form = page.locator('form.headstone-record');
 await expect(form.getByRole('combobox',{name:'Material',exact:true})).toBeVisible();
 await expect(form.getByRole('combobox',{name:'Monument condition',exact:true})).toHaveCount(0);
 await expect(form.getByLabel('Last inspected',{exact:true})).toHaveCount(0);
 await expect(form.getByRole('textbox',{name:'Inscription',exact:true})).toHaveCount(0);
 await expect(form.getByLabel('Review status',{exact:true})).toHaveCount(0);
 await form.getByLabel('Vase notes',{exact:true}).fill('Vase beside marker');
 await form.screenshot({path:testInfo.outputPath('marker-information.png')});
 await expect(form.getByRole('textbox',{name:'Flourishes or designs',exact:true})).toHaveCount(0);
 await form.getByRole('button',{name:'Save marker',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit marker information HS-OVERVIEW',exact:true})).toBeVisible();
 expect(patches).toHaveLength(1);
 expect(patches[0].vaseNotes).toBe('Vase beside marker');
 expect(patches[0].conditionId).toBe(marker.condition.id);
 expect(patches[0].inscription).toBe(marker.inscription);
 expect(patches[0].newInspections).toEqual([]);
 await page.getByRole('button',{name:'Edit sources & review',exact:true}).click();
 await expect(form.getByRole('combobox',{name:'NHG inclusion',exact:true})).toBeVisible();
 await expect(form.getByRole('combobox',{name:'Material',exact:true})).toHaveCount(0);
 await form.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Edit face records',exact:true}).click();
 await expect(form.getByRole('textbox',{name:'Inscription',exact:true})).toBeVisible();
 await expect(form.getByRole('combobox',{name:'NHG inclusion',exact:true})).toHaveCount(0);
});

test('opening a marker editor protects an inspection draft', async ({page}) => {
 await setup(page);
 const history = page.getByRole('region',{name:'Inspections',exact:true});
 await history.getByRole('button',{name:'New inspection',exact:true}).click();
 await history.getByLabel('Inspection source',{exact:true}).fill('Keep this visit');
 page.once('dialog',dialog=>dialog.dismiss());
 await page.getByRole('button',{name:'Edit marker information HS-OVERVIEW',exact:true}).click();
 await expect(history.getByLabel('Inspection source',{exact:true})).toHaveValue('Keep this visit');
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Edit marker information HS-OVERVIEW',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Material',exact:true})).toBeVisible();
 await expect(history).toHaveCount(0);
});

for (const role of ['admin','cemetery-admin']) {
 test(`${role} can confirm deletion while cancellation keeps the inspection`,async({page})=>{
  const patches=await setup(page,role,[cemeteryId]);
  const button=page.getByRole('button',{name:'Delete inspection',exact:true});
  page.once('dialog',dialog=>dialog.dismiss());
  await button.click(); expect(patches).toHaveLength(0);
  page.once('dialog',async dialog=>{expect(dialog.message()).toContain('Photos will stay in the marker gallery');await dialog.accept();});
  await button.click();
  await expect(page.getByRole('combobox',{name:'Inspection',exact:true})).toHaveValue('nhg');
  expect(patches[0].deletedInspections).toEqual([{id:'field',expectedUpdatedAt:'2026-10-21T12:00:00+00:00'}]);
 });
}
