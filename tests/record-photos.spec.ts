import {test,expect,type Page} from '@playwright/test';
import {overviewFixture,marker} from './fixtures/overview';
import {select} from './fixtures/cemetery';

async function openRecord(page:Page,reload=false){
 if(reload)await page.reload();else await page.goto('/');
 await select(page,'A-TEST');
 await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByRole('button',{name:/HS-OVERVIEW/}).click();
 await page.getByRole('tab',{name:'Details',exact:true}).click();
}

async function setup(page:Page,multipleFaces=false,threeFaces=false){
 await overviewFixture(page);
 const entries=[
  {id:'field',inspectedAt:'2026-06-12',inspectionYear:2026,sourceType:'field_survey',source:'Field',conditionId:marker.condition.id,condition:'Fair',conditionNotes:'',inscription:'Current reading',updatedAt:'2026-10-22T12:00:00Z'},
  {id:'nhg',inspectedAt:'2005-10-11',inspectionYear:2005,sourceType:'nhg',source:'NHG',conditionId:marker.condition.id,condition:'Excellent',conditionNotes:'',inscription:'Historical reading',updatedAt:'2026-10-22T12:00:00Z'},
 ];
 const faceIds=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 if(threeFaces)faceIds.push('33333333-3333-4333-8333-333333333333');
 const readings=entries.map(entry=>({...entry,faces:multipleFaces?faceIds.map((id,i)=>({id,label:i===2?'Left':i?'Back':'Front',inscription:`${entry.id} ${i===2?'left':i?'back':'front'} reading` ,mediaAssetIds:['old-marker']})):[]}));
 if(multipleFaces)readings[0].inscription=readings[0].faces.map(f=>`${f.label}\n${f.inscription}`).join('\n\n');
 const photos=[...marker.mediaAssets];
 let links=photos.map((p,i)=>({id:`link-${i}`,mediaAssetId:p.id,inspectionId:'field' as string|undefined,maintenanceRecordId:undefined as string|undefined,phase:'unspecified',faceId:undefined as string|undefined}));
 const record=()=>({...marker,faces:multipleFaces?readings[0].faces.map(face=>({...face,notes:"",burialIds:[]})):[],inspections:readings,mediaAssets:photos,maintenanceRecords:[{id:'cleaning',headstoneUuid:marker.id,actionType:{id:'clean',code:'clean',label:'Cleaning'},priority:{id:'normal',code:'normal',label:'Normal'},status:'completed',observedAt:'2026-10-22',performedBy:'Inspector',sourceType:'manual',notes:'Cleaned stone'}]});
 await page.route('**/api/headstone-lookups',route=>route.fulfill({json:{markerTypes:[marker.markerType],markerScopes:[marker.markerScope],materials:[marker.material],conditions:[marker.condition]}}));
 await page.route('**/api/headstones/marker-1',async route=>{
  if(route.request().method()==='PATCH'){
   for(const entry of route.request().postDataJSON().newInspections??[])readings.push({...entry,inspectionYear:2027,condition:'Unknown',updatedAt:'2026-10-22T13:00:00Z'});
   for(const entry of route.request().postDataJSON().updatedInspections??[]){const i=readings.findIndex(x=>x.id===entry.id);readings[i]={...readings[i],...entry,faces:entry.faces?.map((face:{id:string})=>({...readings[i].faces.find(old=>old.id===face.id),...face}))??readings[i].faces,updatedAt:'2026-10-22T14:00:00Z'};}
  }
  await route.fulfill({json:record()});
 });
 await page.route('**/api/headstones/marker-1/photo-contexts',route=>route.fulfill({json:links}));
 await page.route('**/api/headstones/marker-1/photo-contexts/*',route=>{
  const body=route.request().postDataJSON();const id=new URL(route.request().url()).pathname.split('/').at(-1)!;
  links=links.filter(link=>!(link.mediaAssetId===id&&link.inspectionId===body.inspectionId&&link.maintenanceRecordId===body.maintenanceRecordId));
  if(route.request().method()!=='DELETE')links.push({id:`new-${id}`,mediaAssetId:id,...body});
  return route.fulfill({json:{saved:true}});
 });
 const uploads:{inspectionId:string|null;maintenanceRecordId:string|null;phase:string|null;faceId:string|null}[]=[];
 await page.route('**/api/headstones/marker-1/media-assets?**',route=>{
  const params=new URL(route.request().url()).searchParams;
  const target={inspectionId:params.get('inspectionId'),maintenanceRecordId:params.get('maintenanceRecordId'),phase:params.get('phase'),faceId:params.get('faceId')};uploads.push(target);
  const photo={...photos[0],id:uploads.length===1?'uploaded':`uploaded-${uploads.length}`,fileUrl:'/media/uploaded.png',originalFilename:'uploaded.png',notes:'uploaded'};photos.push(photo);
  links.push({id:`uploaded-link-${uploads.length}`,mediaAssetId:photo.id,inspectionId:target.inspectionId??undefined,maintenanceRecordId:target.maintenanceRecordId??undefined,phase:target.phase??'unspecified',faceId:target.faceId??undefined});
  return route.fulfill({json:photo});
 });
 await openRecord(page);
 return {uploads,getLinks:()=>links,getInspections:()=>readings,getPhotos:()=>photos};
}

async function showPhotos(region:import('@playwright/test').Locator,count:number){
 await expect(region.locator('.media-gallery-card')).toHaveCount(count);
 for(const card of await region.locator('.media-gallery-card').all()){
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole('link',{name:/Open photo:/})).toHaveCount(1);
 }
 await expect(region.getByRole('link',{name:/Open photo:/})).toHaveCount(count);
}

test('each inspection shows its own photos; new visits start without links and the monument library keeps every photo',async({page})=>{
 const state=await setup(page);
 const inspections=page.getByRole('region',{name:'Inspections',exact:true});
 const recordPhotos=inspections.getByRole('region',{name:'Inspection photos',exact:true});
 await showPhotos(recordPhotos,2);
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await expect(recordPhotos).toContainText('No photos recorded.');
 await expect(recordPhotos.getByRole('link',{name:/Open photo:/})).toHaveCount(0);
 await inspections.getByRole('button',{name:'New inspection',exact:true}).click();
 await expect(inspections.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Historical reading');
 await inspections.getByLabel('Inspection date',{exact:true}).fill('2027-01-01');
 await inspections.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await inspections.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(recordPhotos).toContainText('No photos recorded.');
 expect(state.getLinks().filter(link=>link.inspectionId!=='field')).toHaveLength(0);
 await recordPhotos.getByText('Add photos to this record',{exact:true}).click();
 await recordPhotos.getByRole('combobox',{name:'Existing monument photo',exact:true}).selectOption('latest-marker');
 await recordPhotos.getByRole('button',{name:'Save photo link',exact:true}).click();
 await showPhotos(recordPhotos,1);
 await recordPhotos.getByRole('button',{name:'Unlink from this record',exact:true}).click();
 await expect(recordPhotos.getByRole('link',{name:/Open photo:/})).toHaveCount(0);
 await page.locator('.all-monument-photos > summary').click();
 await showPhotos(page.locator('.all-monument-photos'),2);
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('field');
 await showPhotos(recordPhotos,2);
});

test('uploads from an inspection include its ID and update that record’s gallery',async({page})=>{
 const state=await setup(page);
 const photos=page.getByRole('region',{name:'Inspection photos',exact:true});
 await photos.getByText('Add photos to this record',{exact:true}).click();
 const form=photos.locator('.photo-upload-form');
 await form.locator('input[type=file]').setInputFiles({name:'uploaded.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await form.getByRole('button',{name:'Upload photo',exact:true}).click();
 await showPhotos(photos,3);
 expect(state.uploads[0].inspectionId).toBe('field');expect(state.uploads[0].maintenanceRecordId).toBeNull();
});

test('unlinking a maintenance photo preserves both inspections and the full monument gallery',async({page})=>{
 const state=await setup(page);
 const originalLinks=structuredClone(state.getLinks());
 const photos=page.getByRole('region',{name:'Maintenance photos',exact:true});
 await photos.getByText('Add photos to this record',{exact:true}).click();
 await photos.getByRole('combobox',{name:'Existing monument photo',exact:true}).selectOption('old-marker');
 await photos.getByRole('button',{name:'Save photo link',exact:true}).click();
 await showPhotos(photos,1);
 await photos.getByRole('button',{name:'Unlink from this record',exact:true}).click();
 await expect(photos).toContainText('No photos recorded.');
 await expect(photos.getByRole('link',{name:/Open photo:/})).toHaveCount(0);
 expect(state.getLinks()).toEqual(originalLinks);
 const inspections=page.getByRole('region',{name:'Inspections',exact:true});
 const inspectionPhotos=inspections.getByRole('region',{name:'Inspection photos',exact:true});
 await showPhotos(inspectionPhotos,2);
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await expect(inspectionPhotos).toContainText('No photos recorded.');
 await expect(inspectionPhotos.getByRole('link',{name:/Open photo:/})).toHaveCount(0);
 await page.locator('.all-monument-photos > summary').click();
 await showPhotos(page.locator('.all-monument-photos'),2);
});

test('maintenance before and after photos reuse the monument library and uploads include the maintenance action',async({page})=>{
 const state=await setup(page);
 const photos=page.getByRole('region',{name:'Maintenance photos',exact:true});
 await expect(photos).toContainText('No photos recorded.');
 await photos.getByText('Add photos to this record',{exact:true}).click();
 await photos.getByRole('combobox',{name:'Existing monument photo',exact:true}).selectOption('old-marker');
 await photos.getByRole('combobox',{name:'Maintenance timing',exact:true}).first().selectOption('before');
 await photos.getByRole('button',{name:'Save photo link',exact:true}).click();
 await showPhotos(photos,1);
 await expect(photos.getByRole('link',{name:/Open photo: Before/})).toHaveCount(1);
 const inspections=page.getByRole('region',{name:'Inspections',exact:true});
 const inspectionPhotos=inspections.getByRole('region',{name:'Inspection photos',exact:true});
 await showPhotos(inspectionPhotos,2);
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await expect(inspectionPhotos).toContainText('No photos recorded.');
 await expect(inspectionPhotos.getByRole('link',{name:/Open photo:/})).toHaveCount(0);
 await page.locator('.all-monument-photos > summary').click();
 await showPhotos(page.locator('.all-monument-photos'),2);
 expect(state.getLinks().filter(link=>link.inspectionId==='field')).toHaveLength(2);
 expect(state.getLinks().filter(link=>link.inspectionId==='nhg')).toHaveLength(0);
 const form=photos.locator('.photo-upload-form');
 await form.getByRole('combobox',{name:'Maintenance timing',exact:true}).selectOption('after');
 await form.locator('input[type=file]').setInputFiles({name:'uploaded.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await form.getByRole('button',{name:'Upload photo',exact:true}).click();
 await showPhotos(photos,2);
 await expect(photos.getByRole('link',{name:/Open photo: After/})).toHaveCount(1);
 expect(state.uploads[0].inspectionId).toBeNull();expect(state.uploads[0].maintenanceRecordId).toBe('cleaning');expect(state.uploads[0].phase).toBe('after');
 expect(state.getLinks().filter(link=>link.inspectionId==='field')).toHaveLength(2);
});

test('multiple face readings are independent, copy into new visits without photo links, and photo labels use the selected face',async({page})=>{
 const state=await setup(page,true);
 const originals=structuredClone(state.getInspections());
 const inspections=page.getByRole('region',{name:'Inspections',exact:true});
 const selected=inspections.locator('[aria-label="Selected inspection"]');
 await expect(selected).toContainText('field front reading');
 await expect(selected).toContainText('field back reading');
 const photos=inspections.getByRole('region',{name:'Inspection photos',exact:true});
 await photos.getByText('Add photos to this record',{exact:true}).click();
 await photos.getByRole('combobox',{name:'Existing monument photo',exact:true}).selectOption('old-marker');
 await photos.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await photos.getByRole('button',{name:'Save photo link',exact:true}).click();
 await showPhotos(photos,2);
 await expect(photos.getByRole('link',{name:/Open photo: Back/})).toHaveCount(1);
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await expect(selected).toContainText('nhg front reading');
 await expect(selected).toContainText('nhg back reading');
 await inspections.getByRole('button',{name:'New inspection',exact:true}).click();
 const front=inspections.getByRole('group',{name:'Inspection face 1',exact:true});
 const back=inspections.getByRole('group',{name:'Inspection face 2',exact:true});
 await expect(front.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('nhg front reading');
 await expect(back.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('nhg back reading');
 await back.getByRole('textbox',{name:'Face inscription',exact:true}).fill('New back reading');
 await inspections.getByLabel('Inspection date',{exact:true}).fill('2027-01-01');
 await inspections.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await inspections.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(selected).toContainText('nhg front reading');
 await expect(selected).toContainText('New back reading');
 await expect(photos).toContainText('No photos recorded.');
 const created=state.getInspections().at(-1)!;
 expect(created.faces.every(face=>!('mediaAssetIds' in face))).toBe(true);
 expect(state.getLinks().filter(link=>link.inspectionId===created.id)).toHaveLength(0);
 expect(state.getInspections().slice(0,2)).toEqual(originals);
 await inspections.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await inspections.getByRole('group',{name:'Inspection face 1',exact:true}).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Edited front');
 await inspections.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(selected).toContainText('Edited front');
 await expect(selected).toContainText('New back reading');
 expect(state.getInspections().slice(0,2)).toEqual(originals);
 await inspections.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('field');
 await showPhotos(photos,2);
 await expect(photos.getByRole('link',{name:/Open photo: Back/})).toHaveCount(1);
});

test('editing an existing face updates the combined reading without changing other inspections',async({page})=>{
 const state=await setup(page,true);
 const before=structuredClone(state.getInspections());
 const inspections=page.getByRole('region',{name:'Inspections',exact:true});
 await inspections.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await expect(inspections.getByRole('textbox',{name:'Inspection inscription',exact:true})).toHaveCount(0);
 await inspections.getByRole('group',{name:'Inspection face 2',exact:true}).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Revised back');
 await inspections.getByRole('button',{name:'Save inspection',exact:true}).click();
 expect(state.getInspections()[0].faces[0]).toEqual(before[0].faces[0]);
 expect(state.getInspections()[0].faces[1].inscription).toBe('Revised back');
 expect(state.getInspections()[0].inscription).toBe('Front\nfield front reading\n\nBack\nRevised back');
 expect(state.getInspections()[1]).toEqual(before[1]);
 await inspections.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspections.getByRole('group',{name:'Inspection face 1',exact:true}).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Discard this reading');
 page.once('dialog',dialog=>dialog.accept());
 await inspections.getByRole('button',{name:'Cancel inspection',exact:true}).click();
 await expect(inspections.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(state.getInspections()).toHaveLength(2);
 expect(state.getInspections()[0].faces[0].inscription).toBe('field front reading');
});

const inspectionRegion=(page:Page)=>page.getByRole('region',{name:'Inspections',exact:true});
const faceInput=(page:Page,index:number)=>inspectionRegion(page).getByRole('group',{name:`Inspection face ${index}`,exact:true}).getByRole('textbox',{name:'Face inscription',exact:true});
async function cancelDraft(page:Page,keep=false){
 page.once('dialog',async dialog=>{
  expect(dialog.type()).toBe('confirm');
  expect(dialog.message()).toContain('Discard unsaved changes');
  if(keep)await dialog.dismiss();else await dialog.accept();
 });
 await inspectionRegion(page).getByRole('button',{name:'Cancel inspection',exact:true}).click();
}

test('switch, copy three faces, discard and refresh preserves only the original inspections and photos',async({page})=>{
 const state=await setup(page,true,true);
 const before=structuredClone({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()});
 const region=inspectionRegion(page);
 await region.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await region.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('field');
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 for(const [i,face] of before.inspections[0].faces.entries())await expect(faceInput(page,i+1)).toHaveValue(face.inscription);
 await expect(region.getByRole('region',{name:'Inspection photos',exact:true})).toHaveCount(0);
 await faceInput(page,1).fill('Temporary discarded reading');
 await cancelDraft(page);
 await openRecord(page,true);
 await expect(region.getByRole('combobox',{name:'Inspection',exact:true})).toHaveValue('field');
 await expect(region.getByRole('combobox',{name:'Inspection',exact:true}).locator('option')).toHaveCount(2);
 await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toHaveCount(0);
 await expect(region).not.toContainText('Temporary discarded reading');
 for(const face of before.inspections[0].faces)await expect(region.locator('[aria-label="Selected inspection"]')).toContainText(face.inscription);
 await showPhotos(region.getByRole('region',{name:'Inspection photos',exact:true}),2);
 await region.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 for(const face of before.inspections[1].faces)await expect(region.locator('[aria-label="Selected inspection"]')).toContainText(face.inscription);
 await expect(region.getByRole('region',{name:'Inspection photos',exact:true})).toContainText('No photos recorded.');
 await region.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('field');
 expect({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()}).toEqual(before);
});

test('refresh after saving a changed face preserves three independent inspections without inherited photos',async({page})=>{
 const state=await setup(page,true,true);
 const before=structuredClone({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()});
 const region=inspectionRegion(page);
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await faceInput(page,1).fill('New visit front reading');
 await region.getByLabel('Inspection date',{exact:true}).fill('2027-01-01');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 const added=structuredClone(state.getInspections().at(-1)!);
 await openRecord(page,true);
 await expect(region.getByRole('combobox',{name:'Inspection',exact:true})).toHaveValue(added.id);
 await expect(region.getByRole('combobox',{name:'Inspection',exact:true}).locator('option')).toHaveCount(3);
 await expect(region.locator('[aria-label="Selected inspection"]')).toContainText('New visit front reading');
 for(const face of before.inspections[0].faces.slice(1))await expect(region.locator('[aria-label="Selected inspection"]')).toContainText(face.inscription);
 await expect(region.getByRole('region',{name:'Inspection photos',exact:true})).toContainText('No photos recorded.');
 expect(added.faces.map(face=>face.inscription)).toEqual(['New visit front reading',...before.inspections[0].faces.slice(1).map(face=>face.inscription)]);
 expect(added.faces.every(face=>!('mediaAssetIds' in face))).toBe(true);
 for(const original of before.inspections){
  await region.getByRole('combobox',{name:'Inspection',exact:true}).selectOption(original.id);
  for(const face of original.faces)await expect(region.locator('[aria-label="Selected inspection"]')).toContainText(face.inscription);
  if(original.id==='field')await showPhotos(region.getByRole('region',{name:'Inspection photos',exact:true}),2);
  else await expect(region.getByRole('region',{name:'Inspection photos',exact:true})).toContainText('No photos recorded.');
 }
 expect(state.getInspections().slice(0,2)).toEqual(before.inspections);
 expect(state.getLinks()).toEqual(before.links);
 expect(state.getPhotos()).toEqual(before.photos);
});

for(const editing of [false,true])test(`discard prompt Cancel retains and OK discards ${editing?'existing':'new'} multi-face edits`,async({page})=>{
 const state=await setup(page,true,true);
 const before=structuredClone({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()});
 const region=inspectionRegion(page);
 await region.getByRole('button',{name:editing?'Edit inspection':'New inspection',exact:true}).click();
 await faceInput(page,1).fill('Unsaved front edit');
 await faceInput(page,3).fill('Unsaved left edit');
 await cancelDraft(page,true);
 await expect(faceInput(page,1)).toHaveValue('Unsaved front edit');
 await expect(faceInput(page,2)).toHaveValue(before.inspections[0].faces[1].inscription);
 await expect(faceInput(page,3)).toHaveValue('Unsaved left edit');
 expect({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()}).toEqual(before);
 await cancelDraft(page);
 await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toHaveCount(0);
 await expect(region).not.toContainText('Unsaved front edit');
 await region.getByRole('button',{name:editing?'Edit inspection':'New inspection',exact:true}).click();
 for(const [i,face] of before.inspections[0].faces.entries())await expect(faceInput(page,i+1)).toHaveValue(face.inscription);
 await cancelDraft(page);
 expect({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()}).toEqual(before);
});

test('uploaded photo face labels survive switching and refresh without relabeling another record',async({page})=>{
 const state=await setup(page,true,true);
 const originals=structuredClone(state.getInspections());
 const region=inspectionRegion(page);
 const photos=region.getByRole('region',{name:'Inspection photos',exact:true});
 await photos.getByText('Add photos to this record',{exact:true}).click();
 await photos.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 const form=photos.locator('.photo-upload-form');
 await form.locator('input[type=file]').setInputFiles({name:'face-upload.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await form.getByRole('button',{name:'Upload photo',exact:true}).click();
 await showPhotos(photos,3);
 expect(state.uploads[0]).toMatchObject({inspectionId:'field',faceId:'22222222-2222-4222-8222-222222222222'});
 await expect(photos.getByRole('link',{name:/Open photo: Back/})).toHaveCount(1);
 const fieldLinks=structuredClone(state.getLinks().filter(link=>link.inspectionId==='field'));
 await region.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await expect(photos).toContainText('No photos recorded.');
 await photos.getByText('Add photos to this record',{exact:true}).click();
 await photos.getByRole('combobox',{name:'Existing monument photo',exact:true}).selectOption('uploaded');
 await photos.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('11111111-1111-4111-8111-111111111111');
 await photos.getByRole('button',{name:'Save photo link',exact:true}).click();
 await showPhotos(photos,1);
 await expect(photos.getByRole('link',{name:/Open photo: Front/})).toHaveCount(1);
 await openRecord(page,true);
 await showPhotos(photos,3);
 await expect(photos.getByRole('link',{name:/Open photo: Back/})).toHaveCount(1);
 await region.getByRole('combobox',{name:'Inspection',exact:true}).selectOption('nhg');
 await showPhotos(photos,1);
 await expect(photos.getByRole('link',{name:/Open photo: Front/})).toHaveCount(1);
 expect(state.getLinks().filter(link=>link.inspectionId==='field')).toEqual(fieldLinks);
 expect(state.getInspections()).toEqual(originals);
 await page.locator('.all-monument-photos > summary').click();
 await showPhotos(page.locator('.all-monument-photos'),3);
});

test('photo controls offer thumbnail selection, explicit face labels and readable maintenance timing',async({page})=>{
 const state=await setup(page,true,true);
 const originalInspections=structuredClone(state.getInspections());
 const region=inspectionRegion(page);
 const photos=region.getByRole('region',{name:'Inspection photos',exact:true});
 await photos.getByText('Add photos to this record',{exact:true}).click();
 const linked=photos.getByLabel('Linked photos',{exact:true});
 await expect(linked.locator('.record-photo-link')).toHaveCount(2);
 await expect(linked).toContainText('Face');
 await expect(linked).not.toContainText('unspecified');
 await expect(photos.getByRole('combobox',{name:'Maintenance timing',exact:true})).toHaveCount(0);
 await photos.getByText('Browse photo thumbnails',{exact:true}).click();
 const choices=photos.locator('.record-photo-choices');
 for(const thumbnail of await choices.locator('.record-photo-thumbnail').all())await thumbnail.scrollIntoViewIfNeeded();
 await expect(choices.locator('img')).toHaveCount(2);
 await choices.getByRole('button',{name:'Select photo old-marker.png',exact:true}).click();
 await expect(photos.getByRole('combobox',{name:'Existing monument photo',exact:true})).toHaveValue('old-marker');
 await expect(choices.getByRole('button',{name:'Select photo old-marker.png',exact:true})).toHaveAttribute('aria-pressed','true');
 await photos.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await photos.getByRole('button',{name:'Save photo link',exact:true}).click();
 await expect(linked).toContainText('Back');
 await linked.locator('.record-photo-link').filter({hasText:'old-marker.png'}).getByRole('button',{name:'Edit photo link',exact:true}).click();
 await expect(photos.getByRole('combobox',{name:'Photo face',exact:true})).toHaveValue('22222222-2222-4222-8222-222222222222');
 const maintenance=page.getByRole('region',{name:'Maintenance photos',exact:true});
 await maintenance.getByText('Add photos to this record',{exact:true}).click();
 await maintenance.getByRole('combobox',{name:'Existing monument photo',exact:true}).selectOption('old-marker');
 await maintenance.getByRole('combobox',{name:'Maintenance timing',exact:true}).first().selectOption('before');
 await maintenance.getByRole('button',{name:'Save photo link',exact:true}).click();
 await expect(maintenance.getByLabel('Linked photos',{exact:true})).toContainText('Maintenance timing');
 await expect(maintenance.getByLabel('Linked photos',{exact:true})).toContainText('Before maintenance');
 await expect(maintenance.getByLabel('Linked photos',{exact:true})).not.toContainText('unspecified');
 expect(state.getInspections()).toEqual(originalInspections);
 await page.locator('.all-monument-photos > summary').click();
 await expect(page.locator('.all-monument-photos .media-photo-filename')).toHaveText(['latest-marker.png','old-marker.png']);
 await page.setViewportSize({width:390,height:844});
 await photos.locator('.record-photo-editor').scrollIntoViewIfNeeded();
 const overflow=await photos.evaluate(el=>el.scrollWidth>el.clientWidth);
 expect(overflow).toBe(false);
});

for(const record of ['Inspection photos','Maintenance photos'])test(`Cancel clears an unsaved photo selection and metadata in ${record}`,async({page})=>{
 const state=await setup(page,true,true);
 const before=structuredClone({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()});
 const writes:string[]=[];
 page.on('request',request=>{if(request.url().includes('/photo-contexts/')&&request.method()!=='GET')writes.push(request.method());});
 const photos=page.getByRole('region',{name:record,exact:true});
 await photos.getByText('Add photos to this record',{exact:true}).click();
 await photos.getByText('Browse photo thumbnails',{exact:true}).click();
 const choice=photos.getByRole('button',{name:'Select photo old-marker.png',exact:true});
 await choice.click();
 await photos.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 if(record==='Maintenance photos')await photos.getByRole('combobox',{name:'Maintenance timing',exact:true}).first().selectOption('after');
 await expect(photos.getByLabel('Selected photo preview',{exact:true})).toBeVisible();
 await photos.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(photos.getByRole('combobox',{name:'Existing monument photo',exact:true})).toHaveValue('');
 await expect(photos.getByRole('combobox',{name:'Photo face',exact:true})).toHaveValue('');
 if(record==='Maintenance photos')await expect(photos.getByRole('combobox',{name:'Maintenance timing',exact:true}).first()).toHaveValue('unspecified');
 await expect(photos.getByLabel('Selected photo preview',{exact:true})).toHaveCount(0);
 await expect(choice).toHaveAttribute('aria-pressed','false');
 await expect(photos.getByRole('button',{name:'Save photo link',exact:true})).toBeDisabled();
 expect(writes).toEqual([]);
 expect({inspections:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()}).toEqual(before);
});

test('upload link refresh keeps already-loaded gallery images mounted',async({page})=>{
 const state=await setup(page);
 const photos=inspectionRegion(page).getByRole('region',{name:'Inspection photos',exact:true});
 await showPhotos(photos,2);
 const image=await photos.locator('.media-gallery-card img').first().elementHandle();
 expect(image).not.toBeNull();
 let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/headstones/marker-1/photo-contexts',async route=>{
  if(state.getPhotos().length>2)await gate;
  await route.fulfill({json:state.getLinks()});
 });
 try{
  await photos.getByText('Add photos to this record',{exact:true}).click();
  const form=photos.locator('.photo-upload-form');
  await form.locator('input[type=file]').setInputFiles({name:'uploaded.png',mimeType:'image/png',buffer:Buffer.from('photo')});
  await form.getByRole('button',{name:'Upload photo',exact:true}).click();
  await expect(photos.locator('[aria-busy="true"]')).toBeVisible();
  expect(await image!.evaluate(node=>node.isConnected)).toBe(true);
  await expect(photos.locator('.media-gallery-card img')).toHaveCount(2);
 }finally{release();}
 await showPhotos(photos,3);
});

const draftPhoto=(name:string)=>({name,mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});

test('one inspection save uploads and links photos by face, preserving original visits and library links',async({page})=>{
 const state=await setup(page,true,true);
 const originals=structuredClone(state.getInspections()),links=structuredClone(state.getLinks());
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByLabel('Inspection date',{exact:true}).fill('2027-01-01');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 const front=region.getByRole('group',{name:'Inspection face 1',exact:true});
 const back=region.getByRole('group',{name:'Inspection face 2',exact:true});
 const left=region.getByRole('group',{name:'Inspection face 3',exact:true});
 await front.getByRole('textbox',{name:'Face inscription',exact:true}).fill('New front reading');
 await front.getByLabel('Choose photos to upload',{exact:true}).setInputFiles([draftPhoto('front-1.png'),draftPhoto('front-2.png')]);
 await expect(front.getByRole('img',{name:'Preview of front-1.png'})).toBeVisible();
 await back.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('back.png'));
 await left.getByText('Choose existing monument photos',{exact:true}).click();
 await left.getByRole('button',{name:`Use photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
 expect(state.uploads).toHaveLength(0);expect(state.getInspections()).toEqual(originals);expect(state.getLinks()).toEqual(links);
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('group',{name:'New inspection',exact:true})).toHaveCount(0);
 expect(state.getInspections()).toHaveLength(3);expect(state.getInspections().slice(0,2)).toEqual(originals);
 const created=state.getInspections()[2];expect(created.faces.map(f=>f.inscription)).toEqual(['New front reading','field back reading','field left reading']);
 expect(state.uploads.map(p=>p.faceId)).toEqual([created.faces[0].id,created.faces[0].id,created.faces[1].id]);
 expect(state.uploads.every(p=>p.inspectionId===created.id)).toBe(true);
 expect(state.getLinks().filter(l=>l.inspectionId===created.id)).toHaveLength(4);
 expect(state.getLinks().filter(l=>l.inspectionId==='field')).toEqual(links);
 await openRecord(page,true);
 await expect(region.getByRole('combobox',{name:'Inspection',exact:true})).toHaveValue(created.id);
 await showPhotos(region.getByRole('region',{name:'Inspection photos',exact:true}),4);
});

test('canceling a draft with face photos uploads nothing and leaves records untouched',async({page})=>{
 const state=await setup(page,true);const original=structuredClone({visits:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()});
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByRole('group',{name:'Inspection face 1',exact:true}).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('cancel.png'));
 page.once('dialog',dialog=>dialog.dismiss());
 await region.getByRole('button',{name:'Cancel inspection',exact:true}).click();
 await expect(region.getByRole('img',{name:'Preview of cancel.png'})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await region.getByRole('button',{name:'Cancel inspection',exact:true}).click();
 expect(state.uploads).toHaveLength(0);expect({visits:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()}).toEqual(original);
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await expect(region.getByRole('img',{name:'Preview of cancel.png'})).toHaveCount(0);
});

test('failed photo uploads retry only pending photos and never create a second inspection',async({page})=>{
 const state=await setup(page,true);const originals=structuredClone(state.getInspections());let attempts=0;
 await page.route('**/api/headstones/marker-1/media-assets?**',route=>{
  attempts++;if(attempts===2)return route.fulfill({status:500,json:{error:'Temporary photo failure'}});
  return route.fallback();
 });
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByLabel('Inspection date',{exact:true}).fill('2027-01-01');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await region.getByRole('group',{name:'Inspection face 1',exact:true}).getByLabel('Choose photos to upload',{exact:true}).setInputFiles([draftPhoto('first.png'),draftPhoto('retry.png'),draftPhoto('third.png')]);
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('alert')).toContainText('retry.png: Something went wrong on the server');
 await expect(region.getByRole('status')).toContainText('first.png: Saved and linked');
 await expect(region.getByRole('status')).toContainText('retry.png: Pending');
 expect(state.getInspections()).toHaveLength(3);expect(state.uploads).toHaveLength(2);
 await region.getByRole('button',{name:'Retry remaining photos',exact:true}).click();
 await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(attempts).toBe(4);expect(state.uploads).toHaveLength(3);expect(state.getInspections()).toHaveLength(3);
 expect(state.getInspections().slice(0,2)).toEqual(originals);
});

test('inspection save failure keeps face edits and selected photos without uploading files',async({page})=>{
 const state=await setup(page,true);const original=structuredClone({visits:state.getInspections(),links:state.getLinks()});let writes=0;
 await page.route('**/api/headstones/marker-1',route=>{
  if(route.request().method()==='PATCH'&&++writes===1)return route.fulfill({status:500,json:{error:'Save failed'}});
  return route.fallback();
 });
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 const front=region.getByRole('group',{name:'Inspection face 1',exact:true});
 await front.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Preserved draft reading');
 await front.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('preserved.png'));
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('alert')).toBeVisible();
 expect(state.uploads).toHaveLength(0);expect({visits:state.getInspections(),links:state.getLinks()}).toEqual(original);
 await expect(front.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Preserved draft reading');
 await expect(front.getByRole('img',{name:'Preview of preserved.png'})).toBeVisible();
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(writes).toBe(2);expect(state.getInspections()).toHaveLength(3);expect(state.uploads).toHaveLength(1);
});

test('face flourishes and designs save, copy, edit and clear independently of other inspections',async({page})=>{
 const state=await setup(page,true,true);const original=structuredClone(state.getInspections());
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
 for(const [index,text] of ['  Etched ivy\nCarved rose  ','Back border','Left scroll'].entries())await face(index+1).getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill(text);
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(state.getInspections().slice(0,2)).toEqual(original);
 const created=structuredClone(state.getInspections()[2]);
 await openRecord(page,true);
 await expect(region.getByLabel('Selected inspection',{exact:true})).toContainText('Etched ivy');
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 for(const [index,text] of ['  Etched ivy\nCarved rose  ','Back border','Left scroll'].entries())await expect(face(index+1).getByRole('textbox',{name:'Flourishes or designs',exact:true})).toHaveValue(text);
 page.once('dialog',dialog=>dialog.accept());await region.getByRole('button',{name:'Cancel inspection',exact:true}).click();
 await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await face(1).getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill('');
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('button',{name:'Edit inspection',exact:true})).toBeVisible();
 const saved=state.getInspections()[2];expect(saved.faces[0]).toEqual({...created.faces[0],designNotes:''});
 expect(saved.faces.slice(1)).toEqual(created.faces.slice(1));expect(state.getInspections().slice(0,2)).toEqual(original);
});
