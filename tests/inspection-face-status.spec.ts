import { expect, test, type Page } from '@playwright/test';
import { select } from './fixtures/cemetery';
import { marker, overviewFixture } from './fixtures/overview';
import type { InspectionFace, MonumentInspection } from '../src/types';

const sourceHistory = [{id:'history-one',text:'Earlier source reading',source:'Old register',sourceDate:'1901'}];
const mixed = '  Blank family\nName [illegible] 1880  ';
const faces: InspectionFace[] = [
 {id:'front',label:'Front',inscription:'',historicalTranscriptions:sourceHistory},
 {id:'back',label:'Back',inscription:' \n[ILLEGIBLE]\t',historicalTranscriptions:sourceHistory},
 {id:'side',label:'Side',inscription:mixed,historicalTranscriptions:sourceHistory},
];
const condition={id:'unknown',code:'unknown',label:'Unknown'};
async function setup(page: Page) {
 await overviewFixture(page);
 await page.route('**/api/headstone-lookups*',route=>route.fulfill({json:{markerTypes:[marker.markerType],markerScopes:[marker.markerScope],materials:[marker.material],conditions:[condition]}}));
 let entries: MonumentInspection[] = [
  {id:'old',inspectedAt:'2005-10-11',inspectionYear:2005,sourceType:'nhg',source:'North Hills Genealogists',conditionId:condition.id,condition:'Unknown',conditionNotes:'',inscription:'Older inspection reading',faces:[{id:'old-front',label:'Front',inscription:'Older inspection reading'}],updatedAt:'2026-01-01T00:00:00Z'},
  {id:'latest',inspectedAt:'2026-11-14',inspectionYear:2026,sourceType:'field_survey',source:'Field observer',conditionId:condition.id,condition:'Unknown',conditionNotes:'',inscription:'Separate unassigned text',faces:structuredClone(faces),updatedAt:'2026-11-14T00:00:00Z'},
 ];
 const patches: Record<string, unknown>[]=[];
 await page.route('**/api/headstones/marker-1',async route=>{
  if(route.request().method()==='PATCH'){
   const payload=route.request().postDataJSON();patches.push(payload);
   for(const entry of payload.updatedInspections??[]) entries=entries.map(old=>old.id===entry.id?{...old,...entry,updatedAt:'2026-11-15T00:00:00Z'}:old);
   for(const entry of payload.newInspections??[]) entries.push({...entry,inspectionYear:Number(entry.inspectedAt.slice(0,4)),condition:'Unknown',updatedAt:'2026-11-15T00:00:00Z'});
  }
  await route.fulfill({json:{...marker,inscription:'Stored summary reading',historicalTranscriptions:sourceHistory,inspections:entries}});
 });
 const open=async()=>{
  await page.goto('/');
  if((page.viewportSize()?.width??1280)<800) await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
  await select(page,'A-TEST');
  await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByRole('button',{name:/HS-OVERVIEW/}).click();
  await page.getByRole('tab',{name:'Details',exact:true}).click();
 };
 await open();
 return {patches,open,entries:()=>entries};
}
const step=async(page:Page,name:string)=>page.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:new RegExp(name)}).click();

for(const width of [1280,390]) test(`inspection face flags preserve sources, exclude text and round-trip at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});
 const {patches,open,entries}=await setup(page);
 const beforeOld=structuredClone(entries()[0]);
 const inspections=page.getByRole('region',{name:'Inspections',exact:true});
 const current=page.getByRole('region',{name:'Current marker reading',exact:true});
 await expect(current).toContainText('Source inspection:');await expect(current).toContainText('Field observer');
 await expect(current).toContainText('Nov 14, 2026');await expect(current).toContainText('2026');
 await expect(current).toContainText('Separate unassigned text');
 await expect(current).not.toContainText('Stored summary reading');
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('old');
 await expect(current).toContainText('Field observer');await expect(current).not.toContainText('Older inspection reading');
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('latest');
 await inspections.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await step(page,'Faces & photos');
 const front=inspections.getByRole('group',{name:'Inspection face 1',exact:true});
 const frontText=front.getByRole('textbox',{name:'Face inscription',exact:true});
 const blank=front.getByRole('checkbox',{name:'Blank',exact:true});
 const illegible=front.getByRole('checkbox',{name:'Illegible',exact:true});
 await illegible.check();await expect(frontText).toBeDisabled();await expect(blank).not.toBeChecked();
 await blank.check();await expect(illegible).not.toBeChecked();
 await blank.uncheck();await expect(frontText).toBeEnabled();
 await frontText.fill('[blank] surname');await expect(blank).toBeDisabled();await expect(illegible).toBeDisabled();
 await frontText.fill('[blank]');await expect(blank).toBeEnabled();
 await frontText.fill('');await illegible.check();
 await expect(front.getByRole('region',{name:'Historical transcriptions'})).toContainText('Earlier source reading');
 await inspections.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
 const back=inspections.getByRole('group',{name:'Inspection face 2',exact:true});
 await expect(back.getByRole('checkbox',{name:'Illegible',exact:true})).toBeChecked();
 await expect(back.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('');
 await back.getByRole('checkbox',{name:'Blank',exact:true}).check();
 await inspections.getByRole('button',{name:'Select face 3: Side',exact:true}).click();
 const side=inspections.getByRole('group',{name:'Inspection face 3',exact:true});
 await expect(side.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue(mixed);
 await expect(side.getByRole('checkbox',{name:'Blank',exact:true})).toBeDisabled();
 await expect(side.getByRole('checkbox',{name:'Illegible',exact:true})).toBeDisabled();
 await inspections.getByRole('button',{name:'Next: Review & save',exact:true}).click();
 await expect(inspections).toContainText('Inscription status: Illegible');await expect(inspections).toContainText('Inscription status: Blank');
 await inspections.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(inspections.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(patches).toHaveLength(1);expect(patches[0].inspectionChangesOnly).toBe(true);
 expect(patches[0].historicalTranscriptions).toEqual(sourceHistory);
 const saved=entries().find(entry=>entry.id==='latest')!;
 expect(saved.faces?.[0]).toMatchObject({inscription:'',inscriptionStatus:'illegible',currentLegibility:'illegible',historicalTranscriptions:sourceHistory});
 expect(saved.faces?.[1]).toMatchObject({inscription:'',inscriptionStatus:'blank',currentLegibility:'blank',historicalTranscriptions:sourceHistory});
 expect(saved.faces?.[2].inscription).toBe(mixed);expect(entries()[0]).toEqual(beforeOld);
 await open();
 await expect(current).toContainText('Inscription status: Illegible');await expect(current).toContainText('Inscription status: Blank');
 await inspections.getByRole('button',{name:'New inspection',exact:true}).click();
 await step(page,'Faces & photos');
 await expect(front.getByRole('checkbox',{name:'Illegible',exact:true})).toBeChecked();
 await expect(front).toContainText('Earlier source reading');
 // Browser-local recovery retains new structured fields as well as readings.
 await expect.poll(()=>page.evaluate(()=>Object.keys(localStorage).filter(key=>key.includes('inspection-draft')).map(key=>localStorage.getItem(key)).join(''))).toContain('"inscriptionStatus":"illegible"');
 await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 page.once('dialog',dialog=>dialog.accept());
 await open();
 await inspections.getByRole('button',{name:'Resume draft',exact:true}).click();
 await expect(front.getByRole('checkbox',{name:'Illegible',exact:true})).toBeChecked();
 await expect(front).toContainText('Earlier source reading');
});

test('year-only latest readings and the marker fallback identify their provenance explicitly',async({page})=>{
 await setup(page);
 await page.route('**/api/headstones/marker-1',route=>route.fulfill({json:{...marker,inspections:[
  {id:'year-only',inspectionYear:2027,sourceType:'historical',source:'Year-only source',conditionId:condition.id,condition:'Unknown',conditionNotes:'',inscription:'',faces:[{id:'blank-face',label:'Front',inscription:'',inscriptionStatus:'blank',currentLegibility:'blank'}]},
  {id:'older',inspectedAt:'2026-11-14',inspectionYear:2026,sourceType:'field_survey',source:'Old observer',conditionId:condition.id,condition:'Unknown',conditionNotes:'',inscription:'Older readable text'},
 ]}}));
 await page.reload();
 await select(page,'A-TEST');
 await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByRole('button',{name:/HS-OVERVIEW/}).click();
 await page.getByRole('tab',{name:'Details',exact:true}).click();
 const current=page.getByRole('region',{name:'Current marker reading',exact:true});
 await expect(current).toContainText('2027 (exact date unknown)');
 await expect(current).toContainText('Historical inspection');await expect(current).toContainText('Year-only source');
 await expect(current).toContainText('Inscription status: Blank');await expect(current).not.toContainText('Older readable text');
 await page.route('**/api/headstones/marker-1',route=>route.fulfill({json:{...marker,inspections:[]}}));
 await page.reload();
 await select(page,'A-TEST');
 await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByRole('button',{name:/HS-OVERVIEW/}).click();
 await page.getByRole('tab',{name:'Details',exact:true}).click();
 await expect(current).toContainText('Marker summary — no source inspection recorded.');
 await expect(current).toContainText('Family marker');
});
