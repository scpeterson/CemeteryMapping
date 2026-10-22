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
   for(const added of payload.newInspections??[]) entries.push({...added,condition:'Unknown',inspectionYear:Number(added.inspectedAt.slice(0,4)),updatedAt:'2026-10-22T12:00:00+00:00'});
   for(const edited of payload.updatedInspections??[]) entries=entries.map(i=>i.id===edited.id?{...i,...edited,condition:'Unknown',updatedAt:'2026-10-22T12:00:00+00:00'}:i);
  }
  await route.fulfill({json:{...marker,inspections:entries}});
 });
 await page.goto('/');await select(page,'A-TEST');
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
 await expect(history.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('  Partially visible\nreading  ');
 await history.getByLabel('Inspection date',{exact:true}).fill('2026-10-22');
 await history.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(history.getByRole('combobox',{name:'Inspection',exact:true})).not.toHaveValue('field');
 expect(patches).toHaveLength(1);expect(patches[0].inspectionChangesOnly).toBe(true);
 expect((patches[0].newInspections as {inscription:string}[])[0].inscription).toBe('  Partially visible\nreading  ');
 await history.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await history.getByRole('button',{name:'New inspection',exact:true}).click();
 await expect(history.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Earlier NHG reading');
});

test('cemetery admin can edit the selected inspection with a version; NHG date stays fixed',async({page})=>{
 const patches=await setup(page,'cemetery-admin',[cemeteryId]);
 const history=page.getByRole('region',{name:'Inspections',exact:true});
 await history.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await history.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await expect(history.getByLabel('Inspection date',{exact:true})).toHaveValue('2005-10-11');
 await expect(history.getByLabel('Inspection date',{exact:true})).toBeDisabled();
 await history.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Reviewed source reading');
 await history.getByRole('textbox',{name:'Inspection condition notes',exact:true}).fill('Reviewed condition');
 await history.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(history).toContainText('Reviewed source reading');
 expect(patches[0].newInspections).toEqual([]);
 expect((patches[0].updatedInspections as {expectedUpdatedAt:string}[])[0].expectedUpdatedAt).toBe('2026-10-21T12:00:00+00:00');
});

for(const [role,assignments] of [['reader',[cemeteryId]],['power-user',[cemeteryId]]] as [string,string[]][]){
 test(`${role} ${assignments.length?'assigned':'unassigned'} has read-only inspections`,async({page})=>{
  await setup(page,role,assignments);
  const history=page.getByRole('region',{name:'Inspections',exact:true});
  await expect(history.getByRole('button',{name:'New inspection',exact:true})).toHaveCount(0);
  await expect(history.getByRole('button',{name:'Edit inspection',exact:true})).toHaveCount(0);
  await history.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
  await expect(history).toContainText('Earlier NHG reading');
 });
}
