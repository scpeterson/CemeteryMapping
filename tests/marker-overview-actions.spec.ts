import {expect,test,type Page} from '@playwright/test';
import {marker,overviewFixture} from './fixtures/overview';
import {cemeteryId,select} from './fixtures/cemetery';
import type {MonumentInspection} from '../src/types';

const conditions=[{id:'unknown',code:'unknown',label:'Unknown'},{id:'poor',code:'poor',label:'Poor'},{id:'good',code:'good',label:'Good'}];
const visits:MonumentInspection[]=[
 {id:'latest',inspectedAt:'2026-10-22',inspectionYear:2026,sourceType:'field_survey',source:'October field visit',conditionId:'poor',condition:'Poor',conditionNotes:'Crack along the base',inscription:'Latest visit reading',updatedAt:'2026-10-22T12:00:00Z',faces:[{id:'front',label:'Front',inscription:'Latest visit reading'}]},
 {id:'older',inspectedAt:'2025-01-01',inspectionYear:2025,sourceType:'historical',source:'Older edited source',conditionId:'good',condition:'Good',conditionNotes:'Older condition',inscription:'Old reading',updatedAt:'2026-10-23T15:00:00Z'},
];
const overview=(page:Page)=>page.getByRole('tabpanel',{name:'Overview',exact:true});
const actions=(page:Page)=>overview(page).getByRole('region',{name:'Marker quick actions',exact:true});
async function setup(page:Page,{entries=visits,role='admin',optionsFail=false}:{entries?:MonumentInspection[];role?:string;optionsFail?:boolean}={}){
 await overviewFixture(page);
 await page.route('**/api/me',route=>route.fulfill({json:{role,assignedCemeteryIds:role==='admin'?[]:[cemeteryId],permissions:{}}}));
 let failing=optionsFail;
 await page.route('**/api/headstone-lookups',route=>failing?route.fulfill({status:500,json:{error:'Test editing options failure'}}):route.fulfill({json:{markerTypes:[marker.markerType],markerScopes:[marker.markerScope],materials:[marker.material],conditions,maintenanceIssueTypes:[{id:'weathering',code:'weathering',label:'Weathering'}],maintenanceActionTypes:[{id:'cleaning',code:'cleaning',label:'Cleaning'}],maintenancePriorities:[{id:'normal',code:'normal',label:'Normal'}]}}));
 let inspections=structuredClone(entries);
 const photos=[...marker.mediaAssets];
 const maintenance:Record<string,unknown>[]=[];
 const patches:Record<string,unknown>[]=[];
 const uploads:URLSearchParams[]=[];
 const work:Record<string,unknown>[]=[];
 let vaseNotes='';
 const current=()=>({...marker,condition:conditions[2],conditionNotes:'Marker summary condition',lastInspectedAt:'2020-02-03',vaseNotes,inspections,mediaAssets:photos,maintenanceRecords:maintenance});
 await page.route('**/api/headstones/marker-1',route=>{
  if(route.request().method()==='PATCH'){
   const input=route.request().postDataJSON();patches.push(input);
   for(const entry of input.newInspections??[])inspections.push({...entry,condition:conditions.find(option=>option.id===entry.conditionId)?.label||'Unknown',inspectionYear:Number(entry.inspectedAt.slice(0,4)),updatedAt:'2026-10-23T16:00:00Z'});
   for(const entry of input.updatedInspections??[])inspections=inspections.map(existing=>existing.id===entry.id?{...existing,...entry}:existing);
   if(!input.inspectionChangesOnly)vaseNotes=input.vaseNotes;
  }
  return route.fulfill({json:current()});
 });
 await page.route('**/api/headstones/marker-1/media-assets?**',route=>{
  const params=new URL(route.request().url()).searchParams;uploads.push(params);
  const photo={...photos[0],id:'overview-upload',fileUrl:'/media/overview-upload.png',originalFilename:'overview-upload.png'};photos.push(photo);
  return route.fulfill({json:photo});
 });
 await page.route('**/api/cemeteries/*/maintenance-records',route=>{
  const input=route.request().postDataJSON();work.push(input);
  const record={...input,id:'overview-work',headstoneUuid:marker.id,priority:{id:'normal',code:'normal',label:'Normal'},issueType:{id:'weathering',label:'Weathering'}};maintenance.push(record);
  return route.fulfill({json:record});
 });
 await page.goto('/');
 if((page.viewportSize()?.width??1280)<=760)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
 await select(page,'A-TEST');
 await overview(page).getByRole('button',{name:/HS-OVERVIEW/}).click();
 await expect(overview(page).getByRole('region',{name:'Latest inspection',exact:true})).toBeVisible();
 return {patches,uploads,work,recoverOptions:()=>{failing=false;}};
}

test('Overview pairs the latest visit condition with its date and source, matching history ordering',async({page})=>{
 await setup(page);
 const summary=overview(page).getByRole('region',{name:'Latest inspection',exact:true});
 await expect(summary).toContainText('Oct 22, 2026');await expect(summary).toContainText('Poor');
 await expect(summary).toContainText('October field visit');await expect(summary).toContainText('Crack along the base');
 await expect(summary).not.toContainText('Good');await expect(summary).not.toContainText('Older edited source');
 await summary.getByRole('button',{name:'View inspection history',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Details',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(page.getByRole('combobox',{name:'Inspection',exact:true})).toHaveValue('latest');
 await expect(page.locator('[data-marker-section="inspections"]').getByRole('heading',{name:'Inspections',exact:true})).toBeFocused();
 await expect(page.getByRole('group',{name:'New inspection',exact:true})).toHaveCount(0);
});

test('year-only latest visits retain unknown condition and do not borrow a known marker condition',async({page})=>{
 await setup(page,{entries:[...visits,{...visits[0],id:'year-only',inspectedAt:undefined,inspectionYear:2027,source:'Year-only record',conditionId:'unknown',condition:'Unknown',conditionNotes:''},{...visits[1],id:'ancient',inspectedAt:undefined,inspectionYear:9}]});
 const summary=overview(page).getByRole('region',{name:'Latest inspection',exact:true});
 await expect(summary).toContainText('2027 (exact date unknown)');await expect(summary).toContainText('Unknown');
 await expect(summary).not.toContainText('Good');await expect(summary).not.toContainText('Poor');
 await summary.getByRole('button',{name:'View inspection history',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Inspection',exact:true})).toHaveValue('year-only');
});

test('no inspection history clearly identifies the marker-summary fallback',async({page})=>{
 await setup(page,{entries:[]});
 const summary=overview(page).getByRole('region',{name:'Latest inspection',exact:true});
 await expect(summary).toContainText('No inspection history recorded.');
 await expect(summary).toContainText('Marker condition');await expect(summary).toContainText('Good');
 await expect(summary).toContainText('Last inspected (marker summary)');await expect(summary).toContainText('Feb 3, 2020');
});

test('Record inspection opens the focused draft, saves independently, and never replays after later edits',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 const state=await setup(page);
 await expect(actions(page).getByRole('button',{name:'Record inspection',exact:true})).toBeInViewport();
 await expect(actions(page).getByRole('button',{name:'Edit marker information',exact:true})).toBeInViewport();
 await page.screenshot({path:testInfo.outputPath('marker-overview-phone.png')});
 await actions(page).screenshot({path:testInfo.outputPath('marker-overview-actions-phone.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await actions(page).getByRole('button',{name:'Record inspection',exact:true}).click();
 const history=page.getByRole('region',{name:'Inspections',exact:true});
 await expect(history.getByRole('heading',{name:'Visit & condition',exact:true})).toBeFocused();
 await history.getByLabel('Inspection date',{exact:true}).fill('2026-10-23');
 expect(state.patches).toHaveLength(0);
 await history.getByRole('button',{name:'Next: Faces & photos',exact:true}).click();
 await expect(history.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Latest visit reading');
 await history.getByRole('button',{name:'Next: Review & save',exact:true}).click();
 await history.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(history.getByRole('group',{name:'New inspection',exact:true})).toHaveCount(0);
 expect(state.patches).toHaveLength(1);expect(state.patches[0].inspectionChangesOnly).toBe(true);
 await page.getByRole('button',{name:'Edit marker information HS-OVERVIEW',exact:true}).click();
 await page.getByRole('button',{name:'Save marker',exact:true}).click();
 await expect(history.getByRole('group',{name:'New inspection',exact:true})).toHaveCount(0);
 await page.getByRole('tab',{name:'Overview',exact:true}).click();
 await expect(overview(page).getByRole('region',{name:'Latest inspection',exact:true})).toContainText('Oct 23, 2026');
 await expect(overview(page).getByRole('region',{name:'Latest inspection',exact:true})).toContainText('Unknown');
 await page.getByRole('tab',{name:'Details',exact:true}).click();
 await expect(history.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
});

test('Add photos opens upload controls and returns to Overview without assuming an inspection link',async({page})=>{
 const state=await setup(page);
 await actions(page).getByRole('button',{name:'Add photos',exact:true}).click();
 const gallery=page.getByRole('dialog',{name:'Marker photo gallery',exact:true});
 await expect(gallery.getByRole('combobox',{name:'Photo record',exact:true})).toHaveValue('all');
 await expect(gallery.getByLabel('Choose photos to upload',{exact:true})).toBeFocused();
 await gallery.getByLabel('Choose photos to upload',{exact:true}).setInputFiles({name:'overview-upload.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await gallery.getByRole('button',{name:'Upload photo',exact:true}).click();
 await expect(gallery.getByText('Photo uploaded and linked.',{exact:true})).toBeVisible();
 expect(state.uploads).toHaveLength(1);expect(state.uploads[0].get('inspectionId')).toBeNull();expect(state.uploads[0].get('maintenanceRecordId')).toBeNull();
 await gallery.getByRole('button',{name:'Close gallery',exact:true}).click();
 await expect(page.getByRole('tab',{name:'Overview',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(actions(page).getByRole('button',{name:'Add photos',exact:true})).toBeFocused();
 expect(state.patches).toHaveLength(0);
});

test('Record maintenance opens the fixed-marker form and saves only after submission',async({page})=>{
 const state=await setup(page);
 await actions(page).getByRole('button',{name:'Record maintenance',exact:true}).click();
 const section=page.locator('[data-marker-section="maintenance"]');
 await expect(section.getByRole('combobox',{name:'Issue',exact:true})).toBeFocused();
 expect(state.work).toHaveLength(0);
 await section.getByRole('textbox',{name:'Notes',exact:true}).fill('Check the base');
 await section.getByRole('button',{name:'Add maintenance',exact:true}).click();
 await expect(section).toContainText('Maintenance recorded.');
 expect(state.work).toHaveLength(1);expect(state.work[0]).toMatchObject({targetType:'headstone',headstoneId:marker.id,graveSpaceId:'',notes:'Check the base'});
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.getByRole('tab',{name:'Details',exact:true}).click();
 await expect(section.getByRole('combobox',{name:'Issue',exact:true})).toHaveCount(0);
});

test('Edit marker information opens the small editor once and returns to its section after saving',async({page})=>{
 const state=await setup(page);
 await actions(page).getByRole('button',{name:'Edit marker information',exact:true}).click();
 const form=page.locator('form.headstone-record').filter({has:page.getByRole('button',{name:'Save marker',exact:true})});
 await expect(form.getByRole('combobox',{name:'Marker type',exact:true})).toBeFocused();
 expect(state.patches).toHaveLength(0);
 await form.getByRole('textbox',{name:'Vase notes',exact:true}).fill('Vase on right');
 await form.getByRole('button',{name:'Save marker',exact:true}).click();
 await expect(page.locator('[data-marker-section="information"]').getByRole('heading',{name:'Marker information',exact:true})).toBeFocused();
 expect(state.patches).toHaveLength(1);expect(state.patches[0].vaseNotes).toBe('Vase on right');
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.getByRole('tab',{name:'Details',exact:true}).click();
 await expect(form).toHaveCount(0);await expect(page.locator('[data-marker-section]')).toHaveCount(5);
});

for(const [role,count] of [['reader',0],['power-user',3],['cemetery-admin',4]] as const)test(`${role} sees only permitted quick actions`,async({page})=>{
 await setup(page,{role});
 await expect(overview(page).getByRole('region',{name:'Latest inspection',exact:true})).toContainText('Poor');
 if(!count)await expect(actions(page)).toHaveCount(0);
 else{
  await expect(actions(page).getByRole('button')).toHaveCount(count);
  await expect(actions(page).getByRole('button',{name:'Record inspection',exact:true})).toHaveCount(role==='power-user'?0:1);
 }
 await expect(overview(page).locator('input,select,textarea')).toHaveCount(0);
});

test('lookup failure disables dependent actions, keeps photos available, and recovers with retry',async({page})=>{
 const state=await setup(page,{optionsFail:true});
 await expect(actions(page).getByRole('button',{name:'Record inspection',exact:true})).toBeDisabled();
 await expect(actions(page).getByRole('button',{name:'Record maintenance',exact:true})).toBeDisabled();
 await expect(actions(page).getByRole('button',{name:'Edit marker information',exact:true})).toBeDisabled();
 await expect(actions(page).getByRole('button',{name:'Add photos',exact:true})).toBeEnabled();
 state.recoverOptions();await actions(page).getByRole('button',{name:'Retry editing options',exact:true}).click();
 await expect(actions(page).getByRole('button',{name:'Record inspection',exact:true})).toBeEnabled();
 await expect(actions(page).getByRole('button',{name:'Record maintenance',exact:true})).toBeEnabled();
 await expect(actions(page).getByRole('button',{name:'Edit marker information',exact:true})).toBeEnabled();
 expect(state.patches).toHaveLength(0);
});
