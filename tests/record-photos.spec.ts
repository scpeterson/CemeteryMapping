import {test,expect,type Page} from '@playwright/test';
import {overviewFixture,marker} from './fixtures/overview';
import {select,cemeteryId} from './fixtures/cemetery';

async function openRecord(page:Page,reload=false){
 if(reload)await page.reload();else await page.goto('/');
 if((page.viewportSize()?.width??1280)<=760)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
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
  if(route.request().method()!=='DELETE')links.push({id:`new-${id}-${body.inspectionId||body.maintenanceRecordId}`,mediaAssetId:id,...body});
  return route.fulfill({json:{saved:true}});
 });
 const uploads:{inspectionId:string|null;maintenanceRecordId:string|null;phase:string|null;faceId:string|null}[]=[];
 await page.route('**/api/headstones/marker-1/media-assets?**',route=>{
  const params=new URL(route.request().url()).searchParams;
  const target={inspectionId:params.get('inspectionId'),maintenanceRecordId:params.get('maintenanceRecordId'),phase:params.get('phase'),faceId:params.get('faceId')};uploads.push(target);
  const photo={...photos[0],id:uploads.length===1?'uploaded':`uploaded-${uploads.length}`,fileUrl:'/media/uploaded.png',originalFilename:'uploaded.png',notes:'uploaded'};photos.push(photo);
  if(target.inspectionId||target.maintenanceRecordId)links.push({id:`uploaded-link-${uploads.length}`,mediaAssetId:photo.id,inspectionId:target.inspectionId??undefined,maintenanceRecordId:target.maintenanceRecordId??undefined,phase:target.phase??'unspecified',faceId:target.faceId??undefined});
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

const gallery=(page:Page)=>page.getByRole('dialog',{name:'Marker photo gallery',exact:true});
async function openGallery(page:Page,record='inspection'){
 const photos=page.getByRole('region',{name:record==='inspection'?'Inspection photos':'Maintenance photos',exact:true});
 await photos.getByRole('button',{name:'Open photo gallery',exact:true}).click();
 await expect(gallery(page).getByText('Refreshing photo associations…',{exact:true})).toHaveCount(0);
 return gallery(page);
}
async function closeGallery(page:Page){await gallery(page).getByRole('button',{name:'Close gallery',exact:true}).click();}
const card=(page:Page,id:string)=>gallery(page).locator('.media-gallery-card').filter({has:page.locator('.media-photo-filename').filter({hasText:id})});
async function upload(page:Page,name='upload.png'){
 const modal=gallery(page);
 await modal.getByRole('button',{name:'Upload new photos',exact:true}).click();
 await modal.locator('input[type=file]').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from('photo')});
 await modal.getByRole('button',{name:'Upload photo',exact:true}).click();
 await expect(modal.getByText('Photo uploaded and linked.',{exact:true})).toBeVisible();
}

test('inspection, maintenance and marker entry points share one gallery with record filters and no duplicated photos',async({page})=>{
 const state=await setup(page,true);
 const modal=await openGallery(page);
 await showPhotos(modal,2);
 await expect(page.locator('.detail-panel .media-gallery')).toHaveCount(0);
 await expect(modal.getByRole('combobox',{name:'Photo record',exact:true})).toHaveValue('inspection:field');
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('inspection:nhg');
 await expect(modal).toContainText('No photos match these filters.');
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('all');
 await showPhotos(modal,2);
 await closeGallery(page);
 await openGallery(page,'maintenance');
 await expect(modal.getByRole('combobox',{name:'Photo record',exact:true})).toHaveValue('maintenance:cleaning');
 await expect(modal).toContainText('No photos match these filters.');
 await closeGallery(page);
 await page.getByRole('button',{name:'Photo gallery (2)',exact:true}).click();
 await showPhotos(modal,2);
 expect(state.uploads).toHaveLength(0);
});

test('existing photos carry independent inspection faces and maintenance timing; unlink preserves the image and other records',async({page})=>{
 const state=await setup(page,true);
 const modal=await openGallery(page,'maintenance');
 await modal.getByRole('button',{name:'Choose existing photos',exact:true}).click();
 await showPhotos(modal,2);
 await card(page,'latest-marker.png').getByRole('button',{name:'Link to this record',exact:true}).click();
 await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await modal.getByRole('combobox',{name:'Maintenance timing',exact:true}).selectOption('after');
 await modal.getByRole('button',{name:'Save photo link',exact:true}).click();
 await expect(modal).toContainText('Photo linked to the selected record.');
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('all');
 await showPhotos(modal,2);
 await expect(card(page,'latest-marker.png')).toContainText('Inspection:');
 await expect(card(page,'latest-marker.png')).toContainText('Maintenance: Cleaning');
 await expect(card(page,'latest-marker.png')).toContainText('Back · After maintenance');
 await modal.getByRole('combobox',{name:'Filter by face',exact:true}).selectOption('Back');
 await showPhotos(modal,2);
 await modal.getByRole('combobox',{name:'Filter by maintenance timing',exact:true}).selectOption('after');
 await showPhotos(modal,1);
 await modal.getByRole('combobox',{name:'Filter by maintenance timing',exact:true}).selectOption('before');
 await expect(modal).toContainText('No photos match these filters.');
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('maintenance:cleaning');
 await card(page,'latest-marker.png').getByRole('button',{name:'Edit photo link',exact:true}).click();
 await expect(modal.getByRole('combobox',{name:'Photo face',exact:true})).toHaveValue('22222222-2222-4222-8222-222222222222');
 await expect(modal.getByRole('combobox',{name:'Maintenance timing',exact:true})).toHaveValue('after');
 await card(page,'latest-marker.png').getByRole('button',{name:'Unlink from this record',exact:true}).click();
 await expect(modal).toContainText('Photo unlinked. It remains in the marker gallery.');
 expect(state.getLinks().filter(link=>link.inspectionId==='field')).toHaveLength(2);
 expect(state.getLinks().filter(link=>link.maintenanceRecordId==='cleaning')).toHaveLength(0);
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('all');
 await showPhotos(modal,2);
});

test('uploads use the same face and timing controls for inspections and maintenance and survive reload',async({page})=>{
 const state=await setup(page,true);
 const modal=await openGallery(page);
 await modal.getByRole('button',{name:'Upload new photos',exact:true}).click();
 await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await expect(modal.getByRole('combobox',{name:'Maintenance timing',exact:true})).toHaveCount(0);
 await modal.locator('input[type=file]').setInputFiles({name:'inspection.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await modal.getByRole('button',{name:'Upload photo',exact:true}).click();
 await expect(modal.getByText('Photo uploaded and linked.',{exact:true})).toBeVisible();
 expect(state.uploads[0]).toMatchObject({inspectionId:'field',maintenanceRecordId:null,faceId:'22222222-2222-4222-8222-222222222222',phase:'unspecified'});
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('maintenance:cleaning');
 await modal.getByRole('button',{name:'Upload new photos',exact:true}).click();
 await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('11111111-1111-4111-8111-111111111111');
 await modal.getByRole('combobox',{name:'Maintenance timing',exact:true}).selectOption('before');
 await modal.locator('input[type=file]').setInputFiles({name:'before.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await modal.getByRole('button',{name:'Upload photo',exact:true}).click();
 await expect(modal.getByText('Photo uploaded and linked.',{exact:true})).toBeVisible();
 expect(state.uploads[1]).toMatchObject({inspectionId:null,maintenanceRecordId:'cleaning',faceId:'11111111-1111-4111-8111-111111111111',phase:'before'});
 await closeGallery(page); await openRecord(page,true); await openGallery(page,'maintenance');
 await showPhotos(modal,1);
 await expect(modal).toContainText('Front · Before maintenance');
});

test('library uploads remain unassigned until explicitly linked to an inspection',async({page})=>{
 const state=await setup(page);
 await page.getByRole('button',{name:'Photo gallery (2)',exact:true}).click();
 await upload(page);
 expect(state.uploads[0]).toMatchObject({inspectionId:null,maintenanceRecordId:null});
 const modal=gallery(page);
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('unlinked');
 // Fixtures must reflect that uploads without a target create no record association.
 await showPhotos(modal,1);
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('inspection:nhg');
 await modal.getByRole('button',{name:'Choose existing photos',exact:true}).click();
 await card(page,'uploaded.png').getByRole('button',{name:'Link to this record',exact:true}).click();
 await modal.getByRole('button',{name:'Save photo link',exact:true}).click();
 await expect(modal).toContainText('Photo linked to the selected record.');
 expect(state.getLinks().filter(link=>link.inspectionId==='nhg')).toHaveLength(1);
});

test('photo association load failure has retry and does not discard the gallery',async({page})=>{
 await setup(page);let failed=true;
 await page.route('**/api/headstones/marker-1/photo-contexts',route=>failed?route.fulfill({status:500,json:{error:'Temporary failure'}}):route.fallback());
 const modal=await openGallery(page);
 await expect(modal.getByRole('alert')).toBeVisible();
 await expect(modal.getByRole('button',{name:'Choose existing photos',exact:true})).toBeDisabled();
 failed=false;await modal.getByRole('button',{name:'Retry photo associations',exact:true}).click();
 await showPhotos(modal,2);
 await expect(modal.getByRole('alert')).toHaveCount(0);
});

test('gallery refresh failure after a successful upload never retries the uploaded file',async({page})=>{
 const state=await setup(page);
 const modal=await openGallery(page);
 let fail=false;
 await page.route('**/api/headstones/marker-1/photo-contexts',route=>fail?route.fulfill({status:500,json:{error:'Temporary refresh failure'}}):route.fallback());
 await page.route('**/api/headstones/marker-1/media-assets?**',route=>{fail=true;return route.fallback();});
 await upload(page);
 expect(state.uploads).toHaveLength(1);
 await expect(modal.getByRole('button',{name:'Retry failed photos',exact:true})).toHaveCount(0);
 fail=false;await modal.getByRole('button',{name:'Retry photo associations',exact:true}).click();
 await showPhotos(modal,3);expect(state.uploads).toHaveLength(1);
});

test('gallery protects pending uploads on close and context changes; canceled link edits perform no writes',async({page})=>{
 const state=await setup(page,true);const original=structuredClone(state.getLinks());
 const modal=await openGallery(page);
 await card(page,'latest-marker.png').getByRole('button',{name:'Edit photo link',exact:true}).click();
 await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await modal.getByRole('button',{name:'Cancel photo changes',exact:true}).click();
 expect(state.getLinks()).toEqual(original);
 await modal.getByRole('button',{name:'Upload new photos',exact:true}).click();
 await modal.locator('input[type=file]').setInputFiles({name:'pending.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 page.once('dialog',dialog=>dialog.dismiss());await closeGallery(page);
 await expect(modal).toBeVisible();
 page.once('dialog',dialog=>dialog.dismiss());
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('maintenance:cleaning');
 await expect(modal.getByRole('combobox',{name:'Photo record',exact:true})).toHaveValue('inspection:field');
 page.once('dialog',dialog=>dialog.accept());await closeGallery(page);
 expect(state.uploads).toHaveLength(0);expect(state.getLinks()).toEqual(original);
});

test('read-only gallery has labels and filters without upload or link actions',async({page})=>{
 await setup(page,true);
 await page.route('**/api/me',route=>route.fulfill({json:{role:'reader',assignedCemeteryIds:[cemeteryId],permissions:{}}}));
 await openRecord(page,true);
 const modal=await openGallery(page);
 await showPhotos(modal,2);
 await expect(modal.getByRole('region',{name:'Photo controls'})).toHaveCount(0);
 await expect(modal.getByRole('button',{name:'Edit photo link',exact:true})).toHaveCount(0);
});

test('one gallery works at phone width with record, face and timing controls',async({page},testInfo)=>{
 await setup(page,true);await page.setViewportSize({width:390,height:844});
 const modal=await openGallery(page,'maintenance');
 await modal.getByRole('button',{name:'Choose existing photos',exact:true}).click();
 await card(page,'latest-marker.png').getByRole('button',{name:'Link to this record',exact:true}).click();
 await modal.getByRole('combobox',{name:'Maintenance timing',exact:true}).selectOption('during');
 await modal.screenshot({path:testInfo.outputPath('unified-gallery-phone.png')});
 expect(await modal.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
 await modal.getByRole('button',{name:'Cancel photo changes',exact:true}).click();
 await closeGallery(page);
});

const draftPhoto=(name:string)=>({name,mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});

test('one inspection save uploads and links photos by face, preserving original visits and library links',async({page})=>{
 const state=await setup(page,true,true);
 const originals=structuredClone(state.getInspections()),links=structuredClone(state.getLinks());
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspectionStep(page, 'Visit & condition');
 await region.getByLabel('Inspection date',{exact:true}).fill('2027-01-01');
 await inspectionStep(page, 'Visit & condition');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await inspectionStep(page, 'Faces & photos');
 const front=region.getByRole('group',{name:'Inspection face 1',exact:true});
 await inspectionStep(page, 'Faces & photos');
 const back=region.getByRole('group',{name:'Inspection face 2',exact:true});
 await inspectionStep(page, 'Faces & photos');
 const left=region.getByRole('group',{name:'Inspection face 3',exact:true});
 await inspectionStep(page, 'Faces & photos');
 await front.getByRole('textbox',{name:'Face inscription',exact:true}).fill('New front reading');
 await inspectionStep(page, 'Faces & photos');
 await front.getByLabel('Choose photos to upload',{exact:true}).setInputFiles([draftPhoto('front-1.png'),draftPhoto('front-2.png')]);
 await expect(front.getByRole('img',{name:'Preview of front-1.png'})).toBeVisible();
 await inspectionStep(page, 'Faces & photos');
 await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
 await back.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('back.png'));
 await region.getByRole('button',{name:'Select face 3: Left',exact:true}).click();
 await left.getByText('Choose existing photos',{exact:true}).click();
 await left.getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
 expect(state.uploads).toHaveLength(0);expect(state.getInspections()).toEqual(originals);expect(state.getLinks()).toEqual(links);
 await inspectionStep(page, 'Review & save');
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
 await region.getByRole('region',{name:'Inspection photos',exact:true}).getByRole('button',{name:'Open photo gallery',exact:true}).click();
 await showPhotos(gallery(page),4);
});

test('canceling a draft with face photos uploads nothing and leaves records untouched',async({page})=>{
 const state=await setup(page,true);const original=structuredClone({visits:state.getInspections(),links:state.getLinks(),photos:state.getPhotos()});
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspectionStep(page, 'Faces & photos');
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
 await inspectionStep(page, 'Visit & condition');
 await region.getByLabel('Inspection date',{exact:true}).fill('2027-01-01');
 await inspectionStep(page, 'Visit & condition');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await inspectionStep(page, 'Faces & photos');
 await region.getByRole('group',{name:'Inspection face 1',exact:true}).getByLabel('Choose photos to upload',{exact:true}).setInputFiles([draftPhoto('first.png'),draftPhoto('retry.png'),draftPhoto('third.png')]);
 await inspectionStep(page, 'Review & save');
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
 await inspectionStep(page, 'Visit & condition');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await inspectionStep(page, 'Faces & photos');
 const front=region.getByRole('group',{name:'Inspection face 1',exact:true});
 await inspectionStep(page, 'Faces & photos');
 await front.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Preserved draft reading');
 await inspectionStep(page, 'Faces & photos');
 await front.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('preserved.png'));
 await inspectionStep(page, 'Review & save');
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('alert')).toBeVisible();
 expect(state.uploads).toHaveLength(0);expect({visits:state.getInspections(),links:state.getLinks()}).toEqual(original);
 await inspectionStep(page, 'Faces & photos');
 await expect(front.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Preserved draft reading');
 await inspectionStep(page, 'Faces & photos');
 await expect(front.getByRole('img',{name:'Preview of preserved.png'})).toBeVisible();
 await inspectionStep(page, 'Review & save');
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(writes).toBe(2);expect(state.getInspections()).toHaveLength(3);expect(state.uploads).toHaveLength(1);
});

test('face flourishes and designs save, copy, edit and clear independently of other inspections',async({page})=>{
 const state=await setup(page,true,true);const original=structuredClone(state.getInspections());
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspectionStep(page, 'Visit & condition');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await inspectionStep(page, 'Faces & photos');
 const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
 await inspectionStep(page, 'Faces & photos');
 for(const [index,text] of ['  Etched ivy\nCarved rose  ','Back border','Left scroll'].entries()){
  await region.getByRole('button',{name:new RegExp(`^Select face ${index+1}:`)}).click();
  await face(index+1).getByText('Flourishes or designs',{exact:true}).first().click();
  await face(index+1).getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill(text);
 }
 await inspectionStep(page, 'Review & save');
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 expect(state.getInspections().slice(0,2)).toEqual(original);
 const created=structuredClone(state.getInspections()[2]);
 await openRecord(page,true);
 await expect(region.getByLabel('Selected inspection',{exact:true})).toContainText('Etched ivy');
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspectionStep(page, 'Faces & photos');
 for(const [index,text] of ['  Etched ivy\nCarved rose  ','Back border','Left scroll'].entries()){
  await region.getByRole('button',{name:new RegExp(`^Select face ${index+1}:`)}).click();
  await face(index+1).getByText('Flourishes or designs',{exact:true}).first().click();
  await expect(face(index+1).getByRole('textbox',{name:'Flourishes or designs',exact:true})).toHaveValue(text);
 }
 page.once('dialog',dialog=>dialog.accept());await region.getByRole('button',{name:'Cancel inspection',exact:true}).click();
 await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await inspectionStep(page, 'Faces & photos');
 await face(1).getByText('Flourishes or designs',{exact:true}).first().click();
 await face(1).getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill('');
 await inspectionStep(page, 'Review & save');
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('button',{name:'Edit inspection',exact:true})).toBeVisible();
 const saved=state.getInspections()[2];expect(saved.faces[0]).toEqual({...created.faces[0],designNotes:''});
 expect(saved.faces.slice(1)).toEqual(created.faces.slice(1));expect(state.getInspections().slice(0,2)).toEqual(original);
});

async function showCorrectionControls(page:Page){
 const expand=page.getByRole('button',{name:'Show remaining items',exact:true});
 if(await expand.isVisible()){
  await expand.click();
  const list=page.getByRole('list',{name:'Remaining required items',exact:true});
  const current=list.locator('button[aria-current="true"]');
  const target=await current.count()?current:list.getByRole('button').first();
  await expect(target).toBeFocused();
  const itemBox=await target.boundingBox(),listBox=await list.boundingBox();
  expect(itemBox!.y).toBeGreaterThanOrEqual(listBox!.y-1);
  expect(itemBox!.y+itemBox!.height).toBeLessThanOrEqual(listBox!.y+listBox!.height+1);
 }
}

async function inspectionStep(page: Page, name: string) {
 await showCorrectionControls(page);
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

test('each inspection label uses its own face snapshot even when face IDs are shared',async({page})=>{
 const state=await setup(page,true);
 state.getInspections()[1].faces[1].label='Reverse (NHG)';
 await openRecord(page,true);
 const modal=await openGallery(page);
 await card(page,'latest-marker.png').getByRole('button',{name:'Edit photo link',exact:true}).click();
 await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await modal.getByRole('button',{name:'Save photo link',exact:true}).click();
 await expect(modal).toContainText('Photo linked to the selected record.');
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('inspection:nhg');
 await modal.getByRole('button',{name:'Choose existing photos',exact:true}).click();
 await card(page,'latest-marker.png').getByRole('button',{name:'Link to this record',exact:true}).click();
 await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await modal.getByRole('button',{name:'Save photo link',exact:true}).click();
 await expect(modal).toContainText('Photo linked to the selected record.');
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('all');
 await showPhotos(modal,2);
 await expect(card(page,'latest-marker.png')).toContainText('Field · Back');
 await expect(card(page,'latest-marker.png')).toContainText('NHG · Reverse (NHG)');
 await modal.getByRole('combobox',{name:'Filter by face',exact:true}).selectOption('Reverse (NHG)');
 await showPhotos(modal,1);
});

test('association refresh keeps loaded gallery previews mounted during upload',async({page})=>{
 const state=await setup(page);
 const modal=await openGallery(page);
 await showPhotos(modal,2);
 const original=await card(page,'latest-marker.png').getByRole('img').elementHandle();
 let release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 let delay=false;
 await page.route('**/api/headstones/marker-1/photo-contexts',async route=>{if(delay)await held;return route.fallback();});
 await page.route('**/api/headstones/marker-1/media-assets?**',route=>{delay=true;return route.fallback();});
 await modal.getByRole('button',{name:'Upload new photos',exact:true}).click();
 await modal.locator('input[type=file]').setInputFiles({name:'delayed.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await modal.getByRole('button',{name:'Upload photo',exact:true}).click();
 try {
  await expect.poll(()=>state.uploads.length).toBe(1);
  await expect(modal.getByText('Refreshing photo associations…',{exact:true})).toBeVisible();
  expect(await original!.evaluate(image=>image.isConnected)).toBe(true);
  await expect(modal.getByRole('button',{name:'Close gallery',exact:true})).toBeDisabled();
  await expect(modal.getByRole('combobox',{name:'Photo record',exact:true})).toBeDisabled();
 } finally {release();}
 await expect(modal.getByText('Photo uploaded and linked.',{exact:true})).toBeVisible();
 await showPhotos(modal,3);
 expect(await original!.evaluate(image=>image.isConnected)).toBe(true);
});

for (const phone of [false, true]) {
 test(`inspection face cards preserve readings and photos when switching (${phone ? 'phone' : 'desktop'})`, async ({page}, testInfo) => {
  const state = await setup(page,true,true);
  if (phone) await page.setViewportSize({width:390,height:844});
  const region = page.getByRole('region',{name:'Inspections',exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await inspectionStep(page,'Faces & photos');
  const cards = region.getByRole('group',{name:'Choose inspection face',exact:true});
  const frontCard = cards.getByRole('button',{name:'Select face 1: Front',exact:true});
  const backCard = cards.getByRole('button',{name:'Select face 2: Back',exact:true});
  const face = (n:number) => region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
  await expect(frontCard).toHaveAttribute('aria-pressed','true');
  await expect(frontCard).toContainText('Reading recorded');
  await expect(frontCard).toContainText('0 photos selected');
  await expect(frontCard).toHaveAccessibleDescription('Reading recorded 0 photos selected');
  await expect(region.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveCount(1);
  await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('  Updated front\nreading  ');
  await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('front.png'));
  await expect(frontCard).toContainText('1 photo selected');
  await backCard.focus(); await page.keyboard.press('Enter');
  await expect(backCard).toHaveAttribute('aria-pressed','true');
  await expect(face(1)).toHaveCount(0);
  await face(2).getByRole('textbox',{name:'Face inscription',exact:true}).fill('   ');
  await expect(backCard).toContainText('No reading recorded');
  await face(2).getByText('Choose existing photos',{exact:true}).click();
  await face(2).getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
  await expect(backCard).toContainText('1 photo selected');
  await frontCard.click();
  await expect(face(1).getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('  Updated front\nreading  ');
  await expect(face(1).getByRole('img',{name:'Preview of front.png'})).toBeVisible();
  await face(1).getByRole('button',{name:'Remove selected photo',exact:true}).click();
  await expect(frontCard).toContainText('0 photos selected');
  await region.getByRole('button',{name:'Add inspection face',exact:true}).click();
  const added = cards.getByRole('button',{name:'Select face 4: Face 4',exact:true});
  await expect(added).toHaveAttribute('aria-pressed','true');
  await expect(added).toContainText('No reading recorded');
  await face(4).getByRole('textbox',{name:'Face label',exact:true}).fill('Right');
  await expect(cards.getByRole('button',{name:'Select face 4: Right',exact:true})).toHaveAttribute('aria-pressed','true');
  await inspectionStep(page,'Review & save');
  await expect(region.getByRole('status').filter({hasText:'photos ready to save'})).toContainText('1 photos ready to save');
  await inspectionStep(page,'Faces & photos');
  await expect(cards.getByRole('button',{name:'Select face 4: Right',exact:true})).toHaveAttribute('aria-pressed','true');
  await backCard.click();
  await expect(face(2).getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('   ');
  await expect(backCard).toContainText('1 photo selected');
  expect(state.uploads).toHaveLength(0);
  expect(state.getInspections()).toHaveLength(2);
  if(phone){
   expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
   await cards.scrollIntoViewIfNeeded();
   await page.screenshot({path:testInfo.outputPath('inspection-face-cards-phone.png')});
  }
 });
}

test('edited inspection cards combine saved links and draft selections without duplicate or cross-visit counts', async ({page},testInfo) => {
 const state=await setup(page,true,true);
 const frontId=state.getInspections()[0].faces[0].id;
 const backId=state.getInspections()[0].faces[1].id;
 const links=state.getLinks();
 links[0].faceId=frontId;
 links.push({...links[0],id:'duplicate-context'});
 links.push({...links[0],id:'other-visit',inspectionId:'nhg',faceId:backId});
 links.push({...links[0],id:'missing-asset',mediaAssetId:'deleted-photo',faceId:backId});
 const originals=structuredClone(links);
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 const cards=region.getByRole('group',{name:'Choose inspection face',exact:true});
 const front=cards.getByRole('button',{name:'Select face 1: Front',exact:true});
 const back=cards.getByRole('button',{name:'Select face 2: Back',exact:true});
 await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await inspectionStep(page,'Faces & photos');
 await expect(front).toContainText('1 photo total · 1 linked · 0 selected');
 await expect(back).toContainText('0 photos total · 0 linked · 0 selected');
 const face=region.getByRole('group',{name:'Inspection face 1',exact:true});
 await face.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('another-front.png'));
 await expect(front).toContainText('2 photos total · 1 linked · 1 selected');
 await face.getByText('Choose existing photos',{exact:true}).click();
 await face.getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
 await expect(front).toContainText('2 photos total · 1 linked · 1 selected');
 await face.getByRole('group',{name:`Photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).getByRole('button',{name:'Remove selected photo',exact:true}).click();
 await expect(front).toContainText('2 photos total · 1 linked · 1 selected');
 await back.click();
 const backFace=region.getByRole('group',{name:'Inspection face 2',exact:true});
 await backFace.getByText('Choose existing photos',{exact:true}).click();
 await backFace.getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
 await expect(front).toContainText('1 photo total · 0 linked · 1 selected');
 await expect(back).toContainText('1 photo total · 0 linked · 1 selected');
 await page.setViewportSize({width:390,height:844});
 await cards.scrollIntoViewIfNeeded();
 await page.screenshot({path:testInfo.outputPath('linked-face-photo-counts-phone.png')});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 page.once('dialog',dialog=>dialog.accept());
 await region.getByRole('button',{name:'Cancel inspection',exact:true}).click();
 expect(state.getLinks()).toEqual(originals); expect(state.uploads).toHaveLength(0);
 await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await inspectionStep(page,'Faces & photos');
 await expect(front).toContainText('1 photo total · 1 linked · 0 selected');
 page.once('dialog',dialog=>dialog.accept());
 await region.getByRole('button',{name:'Cancel inspection',exact:true}).click();
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspectionStep(page,'Faces & photos');
 await expect(front).toContainText('0 photos selected');
 await expect(front).not.toContainText('linked');
});

test('linked count loading and retry preserve draft selections and never show an unknown count as zero', async ({page}) => {
 const state=await setup(page,true);
 state.getLinks()[0].faceId=state.getInspections()[0].faces[0].id;
 let fail=true;
 let release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/headstones/marker-1/photo-contexts',async route=>{
  if(fail)return route.fulfill({status:500,json:{error:'Temporary count failure'}});
  await held;return route.fallback();
 });
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await inspectionStep(page,'Faces & photos');
 const front=region.getByRole('button',{name:'Select face 1: Front',exact:true});
 await expect(front).toContainText('Linked photos unavailable · 0 photos selected');
 await region.getByRole('group',{name:'Inspection face 1',exact:true}).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('keep.png'));
 fail=false;
 await region.getByRole('button',{name:'Retry linked photo counts',exact:true}).click();
 try {await expect(front).toContainText('Loading linked photos · 1 photo selected');} finally {release();}
 await expect(front).toContainText('2 photos total · 1 linked · 1 selected');
 await expect(region.getByRole('img',{name:'Preview of keep.png',exact:true})).toBeVisible();
 expect(state.uploads).toHaveLength(0);
});

for(const phone of [false,true]){
 test(`selected face shows linked and draft photos with safe viewers and gallery management (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const frontId=state.getInspections()[0].faces[0].id;
  const backId=state.getInspections()[0].faces[1].id;
  state.getLinks()[0].faceId=frontId;
  state.getLinks()[1].faceId=backId;
  state.getLinks().push({...state.getLinks()[0],id:'historical-link',inspectionId:'nhg'});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
  await inspectionStep(page,'Faces & photos');
  const face=region.getByRole('group',{name:'Inspection face 1',exact:true});
  const saved=face.getByRole('group',{name:`Photo ${marker.mediaAssets[0].originalFilename}`,exact:true});
  await expect(saved).toContainText('Already linked to this inspection and face');
  await expect(face.getByRole('group',{name:`Photo ${marker.mediaAssets[1].originalFilename}`,exact:true})).toHaveCount(0);
  await face.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Keep this reading');
  await face.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('keep-inline.png'));
  const draft=face.getByRole('group',{name:'Photo keep-inline.png',exact:true});
  await draft.getByRole('textbox',{name:'Notes',exact:true}).fill('Keep this note');
  let discardDialogs=0;page.on('dialog',async dialog=>{discardDialogs++;await dialog.dismiss();});
  await saved.scrollIntoViewIfNeeded();
  await saved.getByRole('link',{name:/Open photo:/}).click();
  const viewer=page.getByRole('dialog',{name:'Record photo',exact:true});
  await expect(viewer.getByRole('img')).toBeVisible();
  await viewer.getByRole('button',{name:'Close photo',exact:true}).click();
  await expect(face.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Keep this reading');
  await draft.getByRole('link',{name:'Open photo: keep-inline.png',exact:true}).click();
  await expect(viewer.getByRole('img',{name:'Preview of keep-inline.png',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(draft.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Keep this note');
  expect(discardDialogs).toBe(0);
  if(phone){await saved.scrollIntoViewIfNeeded();await face.screenshot({path:testInfo.outputPath('inspection-linked-and-draft-photos-phone.png')});}
  await saved.getByRole('button',{name:'Manage photo link',exact:true}).click();
  const modal=gallery(page);
  await expect(modal.getByRole('combobox',{name:'Photo record',exact:true})).toHaveValue('inspection:field');
  await expect(modal.getByRole('combobox',{name:'Filter by face',exact:true})).toHaveValue(`face-id:${frontId}`);
  await showPhotos(modal,1);
  await card(page,marker.mediaAssets[0].originalFilename).getByRole('button',{name:'Edit photo link',exact:true}).click();
  await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption(backId);
  await modal.getByRole('button',{name:'Save photo link',exact:true}).click();
  await expect(modal).toContainText('Photo linked to the selected record.');
  await closeGallery(page);
  await expect(saved).toHaveCount(0);
  await expect(region.getByRole('button',{name:'Select face 1: Front',exact:true})).toContainText('1 photo total · 0 linked · 1 selected');
  await expect(draft.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Keep this note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  const backFace=region.getByRole('group',{name:'Inspection face 2',exact:true});
  const moved=backFace.getByRole('group',{name:`Photo ${marker.mediaAssets[0].originalFilename}`,exact:true});
  await expect(moved).toBeVisible();
  await moved.getByRole('button',{name:'Manage photo link',exact:true}).click();
  await showPhotos(modal,2);
  await card(page,marker.mediaAssets[0].originalFilename).getByRole('button',{name:'Unlink from this record',exact:true}).click();
  await expect(modal).toContainText('Photo unlinked. It remains in the marker gallery.');
  await closeGallery(page);
  await expect(moved).toHaveCount(0);
  expect(state.getLinks().some(link=>link.inspectionId==='nhg')).toBe(true);
  expect(state.getPhotos()).toHaveLength(2);expect(state.uploads).toHaveLength(0);
  await region.getByRole('button',{name:'Select face 1: Front',exact:true}).click();
  await expect(draft.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Keep this note');
  await draft.getByRole('button',{name:'Remove selected photo',exact:true}).click();
  await expect(draft).toHaveCount(0);
  expect(discardDialogs).toBe(0);
 });
}

for(const phone of [false,true]){
 test(`review shows every face's linked and draft photos once with safe full-size viewing (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const frontId=state.getInspections()[0].faces[0].id;
  const backId=state.getInspections()[0].faces[1].id;
  state.getLinks()[0].faceId=frontId;state.getLinks()[1].faceId=backId;
  state.getLinks().push({...state.getLinks()[0],id:'duplicate-review-link'});
  state.getLinks().push({...state.getLinks()[1],id:'other-visit-review-link',inspectionId:'nhg',faceId:frontId});
  const originals=structuredClone(state.getLinks());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
  await inspectionStep(page,'Faces & photos');
  const face=region.getByRole('group',{name:'Inspection face 1',exact:true});
  await expect(face.getByText('Already linked to this inspection and face',{exact:true})).toBeVisible();
  await face.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('review-front.png'));
  const pending=face.getByRole('group',{name:'Photo review-front.png',exact:true});
  await pending.getByRole('textbox',{name:'Notes',exact:true}).fill('New evidence note');
  await pending.getByLabel('Date taken',{exact:true}).fill('2026-10-23');
  await face.getByText('Choose existing photos',{exact:true}).click();
  for(const asset of marker.mediaAssets)await face.getByRole('button',{name:`Select photo ${asset.originalFilename}`,exact:true}).click();
  await inspectionStep(page,'Review & save');
  const review=region.getByRole('region',{name:'Photos for Front',exact:true});
  await expect(review).toContainText('3 photos total · 1 linked · 2 selected');
  await expect(review.locator('li')).toHaveCount(3);
  await expect(review).toContainText('New evidence note');
  await expect(review).toContainText('Date taken:');
  await expect(review).toContainText('Already linked · selected in this draft');
  const backReview=region.getByRole('region',{name:'Photos for Back',exact:true});
  await expect(backReview).toContainText('No photos for this face.');
  await expect(region.getByRole('region',{name:'Photos for Left',exact:true})).toContainText('No photos for this face.');
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  const saved=review.locator('li').filter({has:page.getByText(marker.mediaAssets[0].originalFilename,{exact:true})});
  await saved.scrollIntoViewIfNeeded();
  await saved.getByRole('link',{name:/Open photo:/}).click();
  const viewer=page.getByRole('dialog',{name:'Record photo',exact:true});
  await expect(viewer.getByRole('img')).toBeVisible();
  await viewer.getByRole('button',{name:'Close photo',exact:true}).click();
  const local=review.locator('li').filter({has:page.getByText('review-front.png',{exact:true})});
  await local.getByRole('link',{name:'Open photo: review-front.png',exact:true}).click();
  await expect(viewer.getByRole('img',{name:'Preview of review-front.png',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  if(phone){
   await review.scrollIntoViewIfNeeded();
   await page.screenshot({path:testInfo.outputPath('inspection-review-all-photos-phone.png')});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  await inspectionStep(page,'Faces & photos');
  await expect(pending.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('New evidence note');
  await expect(pending.getByLabel('Date taken',{exact:true})).toHaveValue('2026-10-23');
  await face.getByRole('group',{name:`Photo ${marker.mediaAssets[1].originalFilename}`,exact:true}).getByRole('button',{name:'Remove selected photo',exact:true}).click();
  await inspectionStep(page,'Review & save');
  await expect(review).toContainText('2 photos total · 1 linked · 1 selected');
  await expect(backReview).toContainText('1 photo total · 1 linked · 0 selected');
  await expect(backReview).toContainText(marker.mediaAssets[1].originalFilename);
  expect(state.getLinks()).toEqual(originals);expect(state.uploads).toHaveLength(0);expect(dialogs).toBe(0);
 });
}

test('review can retry unavailable linked photos without losing selected photos',async({page})=>{
 const state=await setup(page,true);
 state.getLinks()[0].faceId=state.getInspections()[0].faces[0].id;
 let fail=true;let release!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/headstones/marker-1/photo-contexts',async route=>{
  if(fail)return route.fulfill({status:500,json:{error:'Temporary review failure'}});
  await held;return route.fallback();
 });
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await inspectionStep(page,'Faces & photos');
 await region.getByRole('group',{name:'Inspection face 1',exact:true}).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('review-retry.png'));
 await inspectionStep(page,'Review & save');
 const review=region.getByRole('region',{name:'Photos for Front',exact:true});
 await expect(review).toContainText('Linked photos are unavailable. 1 photos selected in this draft.');
 await expect(review).not.toContainText('0 linked');
 const preview=review.getByRole('img',{name:'Preview of review-retry.png',exact:true});
 await expect(preview).toBeVisible();const image=await preview.elementHandle();
 fail=false;
 await review.getByRole('button',{name:'Retry linked photo counts',exact:true}).click();
 try {await expect(review).toContainText('Loading linked photos… 1 photos selected in this draft.');}finally{release();}
 await expect(review).toContainText('2 photos total · 1 linked · 1 selected');
 await expect(review.locator('li')).toHaveCount(2);
 expect(await image!.evaluate(element=>element.isConnected)).toBe(true);
 expect(state.uploads).toHaveLength(0);
});

for(const phone of [false,true]){
 test(`review Edit face and Return to review retain and focus the complete draft (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections());
  const links=structuredClone(state.getLinks());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const returnToReview=async(name:string)=>{
   const action=region.getByRole('button',{name:'Return to review',exact:true});
   await expect(action).toBeVisible();
   await expect(region.getByRole('button',{name:'Next: Review & save',exact:true})).toHaveCount(0);
   await action.focus();await page.keyboard.press('Enter');
   await expect(region.getByRole('button',{name,exact:true})).toBeFocused();
   await expect(action).toHaveCount(0);
  };
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained visit source');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Faces & photos');
  await expect(region.getByRole('button',{name:'Return to review',exact:true})).toHaveCount(0);
  await expect(region.getByRole('button',{name:'Next: Review & save',exact:true})).toBeVisible();
  const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
  await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Retained front reading');
  await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('front-retained.png'));
  await face(1).getByRole('textbox',{name:'Notes',exact:true}).fill('Retained photo note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  await face(2).getByText('Flourishes or designs',{exact:true}).first().click();
  await face(2).getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill('Retained back border');
  await face(2).getByText('Choose existing photos',{exact:true}).click();
  await face(2).getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
  await inspectionStep(page,'Review & save');
  await expect(region.getByRole('button',{name:/^Edit face \d:/})).toHaveCount(3);
  if(phone){await region.getByRole('button',{name:'Edit face 2: Back',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('inspection-review-edit-face-phone.png')});}
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  const jump=region.getByRole('button',{name:'Edit face 2: Back',exact:true});
  await jump.focus();await page.keyboard.press('Enter');
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(region.getByRole('button',{name:'Select face 2: Back',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(region.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveCount(1);
  await expect(face(2).getByRole('textbox',{name:'Flourishes or designs',exact:true})).toHaveValue('Retained back border');
  await face(2).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Corrected back reading');
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('Reverse');
  if(phone){await region.getByRole('button',{name:'Return to review',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('inspection-return-to-review-phone.png')});}
  await returnToReview('Edit face 2: Reverse');
  await expect(region.getByRole('region',{name:'Photos for Reverse',exact:true})).toContainText(marker.mediaAssets[0].originalFilename);
  await region.getByRole('button',{name:'Edit face 2: Reverse',exact:true}).click();
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(face(2).getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Corrected back reading');
  await region.getByRole('button',{name:'Select face 3: Left',exact:true}).click();
  await returnToReview('Edit face 3: Left');
  await region.getByRole('button',{name:'Edit face 1: Front',exact:true}).click();
  await expect(face(1).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(face(1).getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Retained front reading');
  await expect(face(1).getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Retained photo note');
  await expect(face(1).getByRole('img',{name:'Preview of front-retained.png',exact:true})).toBeVisible();
  await returnToReview('Edit face 1: Front');
  await region.getByRole('button',{name:'Edit face 3: Left',exact:true}).click();
  await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('');
  await returnToReview('Edit face 3: Unlabeled face');
  await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeDisabled();
  await region.getByRole('button',{name:'Edit face 3: Unlabeled face',exact:true}).click();
  await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('Left');
  expect(state.getInspections()).toEqual(originals);expect(state.getLinks()).toEqual(links);expect(state.uploads).toHaveLength(0);expect(dialogs).toBe(0);
  await returnToReview('Edit face 3: Left');
  await inspectionStep(page,'Faces & photos');
  await expect(region.getByRole('button',{name:'Return to review',exact:true})).toHaveCount(0);
  await expect(region.getByRole('button',{name:'Next: Review & save',exact:true})).toBeVisible();
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Save inspection',exact:true}).click();
  await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  const saved=state.getInspections()[2];
  expect(saved.source).toBe('Retained visit source');
  expect(saved.faces.map(f=>f.inscription)).toEqual(['Retained front reading','Corrected back reading','field left reading']);
  expect(saved.faces[1].label).toBe('Reverse');expect(saved.faces[1].designNotes).toBe('Retained back border');
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0].faceId).toBe(saved.faces[0].id);
  expect(state.getLinks().filter(link=>link.inspectionId===saved.id)).toHaveLength(2);
 });
}

for(const phone of [false,true]){
 test(`review visit corrections return directly and preserve face/photo drafts (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections()),links=structuredClone(state.getLinks());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const editVisit=region.getByRole('button',{name:'Edit visit & condition',exact:true});
  const returnAction=region.getByRole('button',{name:'Return to review',exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await expect(returnAction).toHaveCount(0);
  await region.getByLabel('Inspection date',{exact:true}).fill('2026-11-01');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Faces & photos');
  const front=region.getByRole('group',{name:'Inspection face 1',exact:true});
  const back=region.getByRole('group',{name:'Inspection face 2',exact:true});
  await front.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Keep the front reading');
  await front.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('visit-correction.png'));
  await front.getByRole('textbox',{name:'Notes',exact:true}).fill('Keep the photo note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  await back.getByText('Flourishes or designs',{exact:true}).first().click();
  await back.getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill('Keep the back design');
  await back.getByText('Choose existing photos',{exact:true}).click();
  await back.getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
  await inspectionStep(page,'Review & save');
  if(phone){await editVisit.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('review-edit-visit-phone.png')});}
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await editVisit.focus();await page.keyboard.press('Enter');
  await expect(region.getByRole('combobox',{name:'Inspection type',exact:true})).toBeFocused();
  await expect(returnAction).toBeVisible();
  await expect(region.getByRole('button',{name:'Next: Faces & photos',exact:true})).toHaveCount(0);
  await region.getByRole('combobox',{name:'Inspection type',exact:true}).selectOption('historical');
  await region.getByLabel('Inspection date',{exact:true}).fill('2027-02-03');
  await region.getByLabel('Inspection source',{exact:true}).fill('Corrected visit source');
  await region.getByLabel('Monument condition notes',{exact:true}).fill('Corrected visit condition notes');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
  if(phone){await returnAction.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('visit-return-to-review-phone.png')});}
  await returnAction.focus();await page.keyboard.press('Enter');
  await expect(editVisit).toBeFocused();
  await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeDisabled();
  await expect(region.locator('.inspection-review')).toContainText('Corrected visit source');
  await expect(region.locator('.inspection-review')).toContainText('Feb 3, 2027');
  await expect(region).toContainText('Corrected visit condition notes');
  await expect(region.getByRole('region',{name:'Photos for Front',exact:true})).toContainText('Keep the photo note');
  await editVisit.click();
  await expect(region.getByRole('combobox',{name:'Inspection type',exact:true})).toBeFocused();
  await region.getByRole('combobox',{name:'Inspection type',exact:true}).selectOption('nhg');
  await expect(region.getByLabel('Inspection date',{exact:true})).toHaveValue('2005-10-11');
  await expect(region.getByLabel('Inspection date',{exact:true})).toBeDisabled();
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await returnAction.click();
  await expect(editVisit).toBeFocused();
  await expect(region.locator('.inspection-review')).toContainText('Oct 11, 2005');
  await editVisit.click();
  await region.getByRole('combobox',{name:'Inspection type',exact:true}).selectOption('field_survey');
  await region.getByLabel('Inspection date',{exact:true}).fill('2027-02-03');
  await returnAction.click();
  await expect(editVisit).toBeFocused();
  await region.getByRole('button',{name:'Edit face 2: Back',exact:true}).click();
  await expect(back.getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(back.getByRole('textbox',{name:'Flourishes or designs',exact:true})).toHaveValue('Keep the back design');
  await returnAction.click();
  await expect(region.getByRole('button',{name:'Edit face 2: Back',exact:true})).toBeFocused();
  await inspectionStep(page,'Visit & condition');
  await expect(returnAction).toHaveCount(0);
  await expect(region.getByRole('button',{name:'Next: Faces & photos',exact:true})).toBeVisible();
  await inspectionStep(page,'Faces & photos');
  await region.getByRole('button',{name:'Select face 1: Front',exact:true}).click();
  await expect(front.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Keep the front reading');
  await expect(front.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Keep the photo note');
  await expect(front.getByRole('img',{name:'Preview of visit-correction.png',exact:true})).toBeVisible();
  expect(state.getInspections()).toEqual(originals);expect(state.getLinks()).toEqual(links);expect(state.uploads).toHaveLength(0);expect(dialogs).toBe(0);
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Save inspection',exact:true}).click();
  await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  const saved=state.getInspections()[2];
  expect(saved.sourceType).toBe('field_survey');expect(saved.inspectedAt).toBe('2027-02-03');
  expect(saved.source).toBe('Corrected visit source');expect(saved.conditionId).toBe(marker.condition.id);expect(saved.conditionNotes).toBe('Corrected visit condition notes');
  expect(saved.faces[0].inscription).toBe('Keep the front reading');expect(saved.faces[1].designNotes).toBe('Keep the back design');
  expect(state.uploads).toHaveLength(1);expect(state.getLinks().filter(link=>link.inspectionId===saved.id)).toHaveLength(2);
 });
}

for(const phone of [false,true]){
 test(`required review items focus exact corrections and preserve the full draft (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections()),links=structuredClone(state.getLinks());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const steps=region.getByRole('navigation',{name:'Inspection steps',exact:true});
  const visitStep=steps.getByRole('button',{name:'1. Visit & condition',exact:true});
  const faceStep=steps.getByRole('button',{name:'2. Faces & photos',exact:true});
  const reviewStep=steps.getByRole('button',{name:'3. Review & save',exact:true});
  const required=region.getByRole('region',{name:'Required information',exact:true});
  const returnAction=region.getByRole('button',{name:'Return to review',exact:true});
  const expectSummaryFocus=async()=>{
   const heading=required.getByRole('heading');
   await expect(heading).toBeFocused();await expect(heading).toBeVisible();
   const box=await heading.boundingBox();expect(box).not.toBeNull();
   const tabs=await page.locator(".detail-panel .detail-tabs").boundingBox();expect(tabs).not.toBeNull();
   expect(box!.y).toBeGreaterThanOrEqual(tabs!.y+tabs!.height);expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  };
  const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await expect(visitStep).toContainText('1 required item missing');
  await expect(visitStep).toHaveAttribute('aria-current','step');
  await expect(faceStep).toHaveAccessibleDescription('Required info complete');
  await region.getByLabel('Inspection date',{exact:true}).fill('');
  await region.getByLabel('Inspection source',{exact:true}).fill('   ');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
  await expect(visitStep).toHaveAccessibleDescription('3 required items missing');
  await expect(reviewStep).toHaveAccessibleDescription('3 required items missing');
  await inspectionStep(page,'Faces & photos');
  await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('');
  await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('required-retained.png'));
  await face(1).getByRole('textbox',{name:'Notes',exact:true}).fill('Retained evidence note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('   ');
  await face(2).getByText('Flourishes or designs',{exact:true}).first().click();
  await face(2).getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill('Retained design');
  await region.getByRole('button',{name:'Select face 3: Left',exact:true}).click();
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('');
  await face(3).getByText('Choose existing photos',{exact:true}).click();
  await face(3).getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
  await expect(faceStep).toHaveAttribute('aria-current','step');
  await expect(faceStep).toHaveAccessibleDescription('2 required items missing');
  await expect(reviewStep).toHaveAccessibleDescription('5 required items missing');
  if(phone){await steps.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('inspection-step-status-phone.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  await inspectionStep(page,'Review & save');
  await expect(required).toContainText('5 required items are missing');
  await expect(faceStep).toHaveAccessibleDescription('2 required items missing');
  await expect(reviewStep).toHaveAccessibleDescription('5 required items missing');
  await expect(required.locator('li')).toHaveCount(5);
  await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeDisabled();
  await expect(required).not.toContainText('inscription');
  await expect(required).not.toContainText('photo');
  if(phone){await required.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('inspection-required-information-phone.png')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await required.getByRole('button',{name:'Choose condition',exact:true}).focus();await page.keyboard.press('Enter');
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  await expect(condition).toBeFocused();await expect(condition).toHaveAttribute('aria-invalid','true');
  await expect(condition).toHaveAccessibleDescription('Monument condition is required.');
  await showCorrectionControls(page);await returnAction.focus();await page.keyboard.press('Enter');await expectSummaryFocus();
  await expect(required.locator('li')).toHaveCount(5);
  await required.getByRole('button',{name:'Choose condition',exact:true}).click();
  await expect(condition).toBeFocused();
  await condition.selectOption(marker.condition.id);
  await showCorrectionControls(page);await returnAction.click();await expectSummaryFocus();
  await expect(required.locator('li')).toHaveCount(4);
  await expect(visitStep).toHaveAccessibleDescription('2 required items missing');
  await expect(reviewStep).toHaveAccessibleDescription('4 required items missing');
  if(phone){await page.screenshot({path:testInfo.outputPath('return-to-missing-information-phone.png')});}
  await expect(required.getByRole('button',{name:'Choose condition',exact:true})).toHaveCount(0);
  await required.getByRole('button',{name:'Add inspection date',exact:true}).click();
  const date=region.getByLabel('Inspection date',{exact:true});
  await expect(date).toBeFocused();await expect(date).toHaveAccessibleDescription('Inspection date is required.');
  await date.fill('2027-03-04');await showCorrectionControls(page);await returnAction.click();await expectSummaryFocus();
  await expect(required.locator('li')).toHaveCount(3);
  await expect(visitStep).toHaveAccessibleDescription('1 required item missing');
  await required.getByRole('button',{name:'Add inspection source',exact:true}).click();
  const source=region.getByLabel('Inspection source',{exact:true});
  await expect(source).toBeFocused();await expect(source).toHaveAccessibleDescription('Inspection source is required.');
  await source.fill('Completed inspection source');await showCorrectionControls(page);await returnAction.click();await expectSummaryFocus();
  await expect(required.locator('li')).toHaveCount(2);
  await expect(visitStep).toHaveAccessibleDescription('Required info complete');
  await expect(faceStep).toHaveAccessibleDescription('2 required items missing');
  await required.getByRole('button',{name:'Label face 3',exact:true}).click();
  await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toHaveAccessibleDescription('Face 3 needs a label.');
  await expect(region.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveCount(1);
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('Left');await showCorrectionControls(page);await returnAction.click();await expectSummaryFocus();
  await expect(required.locator('li')).toHaveCount(1);
  await expect(faceStep).toHaveAccessibleDescription('1 required item missing');
  await required.getByRole('button',{name:'Label face 2',exact:true}).click();
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(face(2).getByRole('textbox',{name:'Flourishes or designs',exact:true})).toHaveValue('Retained design');
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('Reverse');await showCorrectionControls(page);await returnAction.click();await expectSummaryFocus();
  await expect(faceStep).toHaveAccessibleDescription('Required info complete');
  await expect(reviewStep).toHaveAccessibleDescription('Ready to save');
  await expect(required).toContainText('All required information is complete.');await expect(required.locator('li')).toHaveCount(0);
  await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeEnabled();
  await expect(region.getByRole('region',{name:'Photos for Front',exact:true})).toContainText('Retained evidence note');
  await expect(region.getByRole('region',{name:'Photos for Left',exact:true})).toContainText(marker.mediaAssets[0].originalFilename);
  expect(state.getInspections()).toEqual(originals);expect(state.getLinks()).toEqual(links);expect(state.uploads).toHaveLength(0);expect(dialogs).toBe(0);
  await region.getByRole('button',{name:'Edit visit & condition',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('   ');
  await expect(visitStep).toHaveAccessibleDescription('1 required item missing');
  await expect(faceStep).toHaveAccessibleDescription('Required info complete');
  await expect(reviewStep).toHaveAccessibleDescription('1 required item missing');
  await region.getByLabel('Inspection source',{exact:true}).fill('Completed inspection source');
  await expect(visitStep).toHaveAccessibleDescription('Required info complete');
  await expect(reviewStep).toHaveAccessibleDescription('Ready to review');
  await showCorrectionControls(page);await returnAction.click();
  await expect(region.getByRole('button',{name:'Edit visit & condition',exact:true})).toBeFocused();
  await region.getByRole('button',{name:'Edit face 1: Front',exact:true}).click();
  await showCorrectionControls(page);await returnAction.click();
  await expect(region.getByRole('button',{name:'Edit face 1: Front',exact:true})).toBeFocused();
  await region.getByRole('button',{name:'Save inspection',exact:true}).click();
  await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  const saved=state.getInspections()[2];expect(saved.inspectedAt).toBe('2027-03-04');expect(saved.source).toBe('Completed inspection source');
  expect(saved.faces.map(f=>f.label)).toEqual(['Front','Reverse','Left']);expect(saved.faces[0].inscription).toBe('');
  expect(state.uploads).toHaveLength(1);expect(state.getLinks().filter(link=>link.inspectionId===saved.id)).toHaveLength(2);
 });
}

test('required review information permits year-only dates on existing inspections',async({page})=>{
 const state=await setup(page,true);
 Reflect.deleteProperty(state.getInspections()[0],'inspectedAt');
 await openRecord(page,true);
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'Edit inspection',exact:true}).click();
 await expect(region.getByLabel('Inspection date',{exact:true})).toHaveValue('');
 await inspectionStep(page,'Review & save');
 const required=region.getByRole('region',{name:'Required information',exact:true});
 await expect(required).toContainText('All required information is complete.');
 await expect(required.getByRole('button',{name:'Add inspection date',exact:true})).toHaveCount(0);
 await expect(region.locator('.inspection-review')).toContainText('2026 (exact date unknown)');
 await expect(region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true})).toHaveAccessibleDescription('Required info complete');
 await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeEnabled();
 expect(state.uploads).toHaveLength(0);
});

for(const phone of [false,true]){
 test(`incomplete step shortcuts focus the first missing visit field or face without losing drafts (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections()),links=structuredClone(state.getLinks());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const steps=region.getByRole('navigation',{name:'Inspection steps',exact:true});
  const visitStep=steps.getByRole('button',{name:'1. Visit & condition',exact:true});
  const faceStep=steps.getByRole('button',{name:'2. Faces & photos',exact:true});
  const reviewStep=steps.getByRole('button',{name:'3. Review & save',exact:true});
  const returnAction=region.getByRole('button',{name:'Return to review',exact:true});
  const date=region.getByLabel('Inspection date',{exact:true});
  const source=region.getByLabel('Inspection source',{exact:true});
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await visitStep.click();await expect(condition).toBeFocused();
  await date.fill('');await source.fill('   ');
  await visitStep.focus();await page.keyboard.press('Enter');await expect(date).toBeFocused();
  await date.fill('2027-04-05');
  await visitStep.click();await expect(source).toBeFocused();
  await source.fill('Shortcut inspection source');
  await visitStep.click();await expect(condition).toBeFocused();
  await condition.selectOption(marker.condition.id);
  await visitStep.click();await expect(region.getByRole('heading',{name:'Visit & condition',exact:true})).toBeFocused();
  await expect(returnAction).toHaveCount(0);
  await faceStep.click();
  await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Retained shortcut reading');
  await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('shortcut-retained.png'));
  await face(1).getByRole('textbox',{name:'Notes',exact:true}).fill('Retained shortcut note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill(' ');
  await region.getByRole('button',{name:'Select face 3: Left',exact:true}).click();
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('');
  await face(3).getByText('Choose existing photos',{exact:true}).click();
  await face(3).getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
  await faceStep.click();await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(region.getByRole('button',{name:'Select face 2: Unlabeled face',exact:true})).toHaveAttribute('aria-pressed','true');
  await visitStep.click();await source.fill('');
  await reviewStep.click();await expect(source).toBeFocused();
  await expect(visitStep).toHaveAttribute('aria-current','step');
  await showCorrectionControls(page);await expect(returnAction).toBeVisible();
  await source.fill('Shortcut inspection source');await showCorrectionControls(page);await returnAction.click();
  await expect(region.getByRole('region',{name:'Required information',exact:true}).getByRole('heading')).toBeFocused();
  await faceStep.focus();await page.keyboard.press('Enter');
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('Reverse');
  await faceStep.click();await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expect(region.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveCount(1);
  await reviewStep.click();await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  if(phone){await page.screenshot({path:testInfo.outputPath('inspection-step-missing-field-phone.png')});}
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('Left');await showCorrectionControls(page);await returnAction.click();
  await expect(region.getByRole('region',{name:'Required information',exact:true})).toContainText('All required information is complete.');
  await faceStep.click();await expect(region.getByRole('heading',{name:'Faces & photos',exact:true})).toBeFocused();
  await region.getByRole('button',{name:'Select face 1: Front',exact:true}).click();
  await expect(face(1).getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Retained shortcut reading');
  await expect(face(1).getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Retained shortcut note');
  await expect(face(1).getByRole('img',{name:'Preview of shortcut-retained.png',exact:true})).toBeVisible();
  await reviewStep.click();await expect(region.getByRole('heading',{name:'Review & save',exact:true})).toBeFocused();
  expect(state.getInspections()).toEqual(originals);expect(state.getLinks()).toEqual(links);expect(state.uploads).toHaveLength(0);expect(dialogs).toBe(0);
  await region.getByRole('button',{name:'Save inspection',exact:true}).click();
  await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  const saved=state.getInspections()[2];expect(saved.inspectedAt).toBe('2027-04-05');expect(saved.source).toBe('Shortcut inspection source');
  expect(saved.faces.map(f=>f.label)).toEqual(['Front','Reverse','Left']);expect(saved.faces[0].inscription).toBe('Retained shortcut reading');
  expect(state.uploads).toHaveLength(1);expect(state.getLinks().filter(link=>link.inspectionId===saved.id)).toHaveLength(2);
 });
}

for(const phone of [false,true]){
 test(`Previous and Next missing item guide corrections without review round trips (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections()),links=structuredClone(state.getLinks());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const next=region.getByRole('button',{name:'Next missing item',exact:true});
  const previous=region.getByRole('button',{name:'Previous missing item',exact:true});
  const returnAction=region.getByRole('button',{name:'Return to review',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const expectCurrent=async(label:string,position:number,total:number)=>{
   await expect(current).toContainText(`Correcting: ${label}.`);
   await expect(current).toContainText(`Item ${position} of ${total} remaining.`);
  };
  const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
  const date=region.getByLabel('Inspection date',{exact:true});
  const source=region.getByLabel('Inspection source',{exact:true});
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await expect(next).toHaveCount(0);await expect(previous).toHaveCount(0);
  await date.fill('');await source.fill(' ');await condition.selectOption('');
  await inspectionStep(page,'Faces & photos');
  await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Retained guided reading');
  await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('guided-retained.png'));
  await face(1).getByRole('textbox',{name:'Notes',exact:true}).fill('Retained guided note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill(' ');
  await face(2).getByText('Flourishes or designs',{exact:true}).first().click();
  await face(2).getByRole('textbox',{name:'Flourishes or designs',exact:true}).fill('Retained guided design');
  await face(2).getByText('Choose existing photos',{exact:true}).click();
  await face(2).getByRole('button',{name:`Select photo ${marker.mediaAssets[0].originalFilename}`,exact:true}).click();
  await region.getByRole('button',{name:'Select face 3: Left',exact:true}).click();
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('');
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'3. Review & save',exact:true}).click();
  await expect(date).toBeFocused();await showCorrectionControls(page);
  await expect(next).toHaveAccessibleDescription('Correcting: Inspection date. Item 1 of 5 remaining.');
  await expect(previous).toHaveAccessibleDescription('Correcting: Inspection date. Item 1 of 5 remaining.');
  const choices=current.getByRole('list',{name:'Remaining required items'});
  const openChoices=async()=>{await showCorrectionControls(page);await expect(choices).toBeVisible();};
  await openChoices();
  await expect(choices.getByRole('button')).toHaveCount(5);
  const keyboardHint=current.locator('.inspection-keyboard-hint');
  await expect(keyboardHint).not.toBeVisible();
  const shortcutToggle=current.getByText('Keyboard shortcuts',{exact:true});
  await shortcutToggle.focus();await page.keyboard.press('Enter');
  await expect(shortcutToggle).toBeFocused();
  await expect(keyboardHint).toBeVisible();
  await expect(keyboardHint.getByRole('listitem')).toHaveCount(5);
  await page.keyboard.press('Space');
  await expect(keyboardHint).not.toBeVisible();
  await expect(shortcutToggle).toBeFocused();
  await expect(choices).toBeVisible();
  await shortcutToggle.click();await expect(keyboardHint).toBeVisible();
  await returnAction.click();
  const hintReview=region.getByRole('region',{name:'Required information',exact:true});
  await expect(hintReview.getByRole('heading')).toBeFocused();
  await hintReview.getByRole('button',{name:'Add inspection date',exact:true}).click();
  await expect(date).toBeFocused();await openChoices();await expect(keyboardHint).toBeVisible();
  await next.click();await expect(source).toBeFocused();await openChoices();
  await expect(keyboardHint).toBeVisible();
  await previous.click();await expect(date).toBeFocused();await openChoices();
  await expect(keyboardHint).toBeVisible();
  await shortcutToggle.click();await expect(keyboardHint).not.toBeVisible();
  await returnAction.click();await expect(hintReview.getByRole('heading')).toBeFocused();
  await hintReview.getByRole('button',{name:'Add inspection date',exact:true}).click();
  await expect(date).toBeFocused();await openChoices();await expect(keyboardHint).not.toBeVisible();

  await expect(choices).toHaveAccessibleDescription('Up/Down Move between items Home/End First/last item Enter/Space Edit Tab/Shift+Tab Next/previous control Escape Return to field');
  await expect(choices.getByRole('button',{name:'Inspection date — Current item',exact:true})).toHaveAttribute('aria-current','true');
  await choices.getByRole('button',{name:'Inspection date — Current item',exact:true}).focus();
  await page.keyboard.press('ArrowUp');
  const lastChoice=choices.getByRole('button',{name:'Face 3 label',exact:true});
  await expect(lastChoice).toBeFocused();
  const lastBox=await lastChoice.boundingBox(),choicesBox=await choices.boundingBox();
  expect(lastBox!.y+lastBox!.height).toBeLessThanOrEqual(choicesBox!.y+choicesBox!.height+1);
  await page.keyboard.press('ArrowDown');await expect(choices.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');await expect(choices.getByRole('button',{name:'Inspection source',exact:true})).toBeFocused();
  await page.keyboard.press('Home');await expect(choices.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('End');await expect(lastChoice).toBeFocused();
  await page.keyboard.press('ArrowUp');await expect(choices.getByRole('button',{name:'Face 2 label',exact:true})).toBeFocused();
  await expectCurrent('Inspection date',1,5);
  await expect(choices.getByRole('button').first()).toHaveAttribute('aria-current','true');
  await page.keyboard.press('Escape');
  await expect(date).toBeFocused();await expect(choices).not.toBeVisible();
  await expect(keyboardHint).not.toBeVisible();
  await expectCurrent('Inspection date',1,5);
  await expect(current.getByRole('button',{name:'Show remaining items',exact:true})).toHaveAttribute('aria-expanded','false');
  await openChoices();await page.keyboard.press('End');await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expectCurrent('Face 2 label',4,5);
  await expect(choices).not.toBeVisible();
  await showCorrectionControls(page);
  await page.keyboard.press('Home');await page.keyboard.press('Escape');
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await expectCurrent('Face 2 label',4,5);await expect(choices).not.toBeVisible();
  await showCorrectionControls(page);
  const scrollPanel=page.locator('.detail-panel');
  const stickyBox=await current.boundingBox();expect(stickyBox).not.toBeNull();
  const initialScroll=await scrollPanel.evaluate(el=>el.scrollTop);
  await scrollPanel.evaluate(el=>{el.scrollTop+=180;});
  await expect.poll(()=>scrollPanel.evaluate(el=>el.scrollTop)).toBeGreaterThan(initialScroll+100);
  const scrolledBox=await current.boundingBox();expect(scrolledBox).not.toBeNull();
  expect(Math.abs(scrolledBox!.y-stickyBox!.y)).toBeLessThan(3);
  await expect(current.getByRole('button',{name:'Hide remaining items',exact:true})).toBeInViewport();
  for(const name of ['Previous missing item','Next missing item','Return to review']){
   const action=current.getByRole('button',{name,exact:true});
   await expect(action).toHaveCount(1);await expect(action).toBeInViewport({ratio:1});
  }
  const expandedHeight=(await current.boundingBox())!.height;
  const collapse=current.getByRole('button',{name:'Hide remaining items',exact:true});
  await collapse.focus();await page.keyboard.press('Enter');
  const expand=current.getByRole('button',{name:'Show remaining items',exact:true});
  await expect(expand).toBeFocused();await expect(expand).toHaveAttribute('aria-expanded','false');
  expect((await current.boundingBox())!.height).toBeLessThan(expandedHeight-40);
  await expect(next).toHaveCount(1);await expect(next).toBeInViewport({ratio:1});await expect(returnAction).toBeInViewport({ratio:1});
  await expectCurrent('Face 2 label',4,5);
  await scrollPanel.evaluate(el=>{el.scrollTop+=120;});
  await expect(expand).toBeInViewport({ratio:1});
  if(phone)await page.screenshot({path:testInfo.outputPath('inspection-collapsed-correction-phone.png')});
  await expand.focus();await page.keyboard.press('Space');
  await expect(collapse).toHaveAttribute('aria-expanded','true');
  await expect(choices.getByRole('button',{name:'Face 2 label — Current item',exact:true})).toBeFocused();
  await current.getByRole('button',{name:'Next missing item',exact:true}).click();
  await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await current.getByRole('button',{name:'Previous missing item',exact:true}).click();
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await current.getByRole('button',{name:'Return to review',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(region.getByRole('region',{name:'Required information',exact:true}).getByRole('heading')).toBeFocused();
  await region.getByRole('button',{name:'Label face 2',exact:true}).click();
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  if(phone)await page.screenshot({path:testInfo.outputPath('inspection-sticky-correction-phone.png')});
  await openChoices();
  await choices.getByRole('button',{name:'Face 2 label — Current item',exact:true}).click();
  await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await openChoices();
  await choices.getByRole('button',{name:'Inspection source',exact:true}).focus();
  await page.keyboard.press('Enter');await expect(source).toBeFocused();
  await expectCurrent('Inspection source',2,5);
  const sourceBox=await source.boundingBox(),panelBox=await current.boundingBox();
  expect(sourceBox!.y+sourceBox!.height).toBeLessThanOrEqual(panelBox!.y);
  await openChoices();
  if(phone){await choices.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('inspection-required-choices-phone.png')});}
  await choices.getByRole('button',{name:'Inspection date',exact:true}).click();
  await expect(date).toBeFocused();await showCorrectionControls(page);
  await previous.focus();await page.keyboard.press('Enter');
  await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await expectCurrent('Face 3 label',5,5);
  await previous.click();await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await expectCurrent('Face 2 label',4,5);
  await previous.click();await expect(condition).toBeFocused();await showCorrectionControls(page);
  await expectCurrent('Monument condition',3,5);
  await previous.click();await expect(source).toBeFocused();await showCorrectionControls(page);
  await expectCurrent('Inspection source',2,5);
  await previous.click();await expect(date).toBeFocused();await showCorrectionControls(page);
  await next.focus();await page.keyboard.press('Enter');
  await expect(source).toBeFocused();await showCorrectionControls(page);
  await expect(next).toHaveAccessibleDescription('Correcting: Inspection source. Item 2 of 5 remaining.');
  await source.fill('Guided inspection source');
  await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
  await openChoices();
  await expect(choices.getByRole('button').first()).toBeFocused();
  await expect(current).toContainText('Inspection source complete.');
  await page.keyboard.press('Escape');
  await expect(source).toBeFocused();await expect(source).toHaveValue('Guided inspection source');
  await expect(choices).not.toBeVisible();await openChoices();
  await expect(choices.getByRole('button')).toHaveCount(4);
  await page.keyboard.press('ArrowDown');await expect(choices.getByRole('button',{name:'Monument condition',exact:true})).toBeFocused();
  await page.keyboard.press('Home');await expect(choices.getByRole('button').first()).toBeFocused();
  await expect(choices.getByRole('button',{name:'Inspection source',exact:true})).toHaveCount(0);
  await expect(choices.locator('[aria-current]')).toHaveCount(0);
  await expect(next).toHaveAccessibleDescription('Inspection source complete. 4 required items remaining.');
  await expect(current).not.toContainText('Item ');
  await next.click();await expect(condition).toBeFocused();await showCorrectionControls(page);
  await previous.click();await expect(date).toBeFocused();await showCorrectionControls(page);
  await next.click();await expect(condition).toBeFocused();await showCorrectionControls(page);
  await condition.selectOption(marker.condition.id);
  await next.click();await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await expect(face(2).getByRole('textbox',{name:'Flourishes or designs',exact:true})).toHaveValue('Retained guided design');
  await expectCurrent('Face 2 label',2,3);
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('Reverse');
  await expect(next).toHaveAccessibleDescription('Face 2 label complete. 2 required items remaining.');
  await expect(current).not.toContainText('Item ');
  await next.click();await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await expectCurrent('Face 3 label',2,2);
  if(phone){await next.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('inspection-current-required-item-phone.png')});}
  await previous.click();await expect(date).toBeFocused();await showCorrectionControls(page);
  await next.click();await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await next.click();await expect(date).toBeFocused();await showCorrectionControls(page);
  await date.fill('2027-05-06');
  await next.click();await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await expect(next).toHaveAccessibleDescription('Correcting: Face 3 label. Item 1 of 1 remaining.');
  await expect(previous).toHaveAccessibleDescription('Correcting: Face 3 label. Item 1 of 1 remaining.');
  await choices.getByRole('button').first().focus();
  await page.keyboard.press('ArrowDown');await expect(choices.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('ArrowUp');await expect(choices.getByRole('button').first()).toBeFocused();
  await previous.click();await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await next.click();await expect(face(3).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();await showCorrectionControls(page);
  await collapse.click();
  await face(3).getByRole('textbox',{name:'Face label',exact:true}).fill('Left');
  await expect(current).toContainText('Face 3 label complete.');
  await expect(expand).toHaveCount(0);
  await expect(collapse).toHaveCount(0);
  await expect(current).toContainText('All required information is complete.');
  await expect(choices).toHaveCount(0);
  await expect(current).not.toContainText('Item ');
  await expect(next).toHaveCount(0);await expect(previous).toHaveCount(0);
  await expect(region.getByText('All required information is complete. Return to review when ready.',{exact:true})).toBeVisible();
  await expect(current.getByRole('button',{name:'Return to review',exact:true})).toBeVisible();
  await returnAction.click();
  const summary=region.getByRole('region',{name:'Required information',exact:true});
  await expect(summary.getByRole('heading')).toBeFocused();
  await expect(summary).toContainText('All required information is complete.');
  await expect(region.getByRole('region',{name:'Photos for Front',exact:true})).toContainText('Retained guided note');
  await expect(region.getByRole('region',{name:'Photos for Reverse',exact:true})).toContainText(marker.mediaAssets[0].originalFilename);
  expect(state.getInspections()).toEqual(originals);expect(state.getLinks()).toEqual(links);expect(state.uploads).toHaveLength(0);expect(dialogs).toBe(0);
  await region.getByRole('button',{name:'Save inspection',exact:true}).click();
  await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  const saved=state.getInspections()[2];expect(saved.inspectedAt).toBe('2027-05-06');expect(saved.source).toBe('Guided inspection source');
  expect(saved.faces.map(f=>f.label)).toEqual(['Front','Reverse','Left']);expect(saved.faces[0].inscription).toBe('Retained guided reading');expect(saved.faces[1].designNotes).toBe('Retained guided design');
  expect(state.uploads).toHaveLength(1);expect(state.getLinks().filter(link=>link.inspectionId===saved.id)).toHaveLength(2);
 });
}

for(const phone of [false,true]){
 test(`required item jumps automatically compact only on phone (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const source=region.getByLabel('Inspection source',{exact:true});
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  const expectJump=async(field:ReturnType<Page['getByRole']>)=>{
   await expect(field).toBeFocused();
   const toggle=current.getByRole('button',{name:phone?'Show remaining items':'Hide remaining items',exact:true});
   await expect(toggle).toHaveAttribute('aria-expanded',phone?'false':'true');
   await expect(toggle).toBeInViewport({ratio:1});
   if(phone){
    await expect(current.getByRole('button',{name:'Next missing item',exact:true})).toBeInViewport({ratio:1});
    await expect(current.getByRole('button',{name:'Previous missing item',exact:true})).toBeInViewport({ratio:1});
    const inputBox=await field.boundingBox(),panelBox=await current.boundingBox();
    expect(inputBox!.y+inputBox!.height).toBeLessThanOrEqual(panelBox!.y);
   }
  };
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await source.fill('');await condition.selectOption('');
  await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true}).click();
  await expectJump(source);
  const compactNext=current.getByRole('button',{name:'Next missing item',exact:true});
  const compactPrevious=current.getByRole('button',{name:'Previous missing item',exact:true});
  await compactPrevious.focus();await page.keyboard.press('Enter');await expectJump(condition);
  await compactPrevious.click();await expectJump(source);
  await expect(compactPrevious).toHaveAccessibleDescription('Correcting: Inspection source. Item 1 of 2 remaining.');
  await compactNext.focus();await page.keyboard.press('Enter');
  await expectJump(condition);
  await compactNext.click();await expectJump(source);
  await compactNext.click();await expectJump(condition);
  await compactNext.click();await expectJump(source);
  await showCorrectionControls(page);
  await current.getByRole('button',{name:'Next missing item',exact:true}).click();
  await expectJump(condition);
  await showCorrectionControls(page);
  await expect(current.getByRole('list',{name:'Remaining required items'})).toBeVisible();
  await current.getByRole('button',{name:'Inspection source',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(source).toBeFocused();
  await expect(current.getByRole('button',{name:'Show remaining items',exact:true})).toBeVisible();
  await expect(current.getByRole('list',{name:'Remaining required items'})).toHaveCount(0);
  if(phone)await page.screenshot({path:testInfo.outputPath('inspection-auto-collapse-phone.png')});
  await showCorrectionControls(page);
  await current.getByRole('button',{name:'Previous missing item',exact:true}).click();
  await expectJump(condition);
  const compactReturn=current.getByRole('button',{name:'Return to review',exact:true});
  await compactReturn.focus();await page.keyboard.press('Enter');
  const summary=region.getByRole('region',{name:'Required information',exact:true});
  await expect(summary.getByRole('heading')).toBeFocused();
  await summary.getByRole('button',{name:'Add inspection source',exact:true}).click();
  await expectJump(source);
  // Reopening stays open during typing; collapse occurs only on another required-item jump.
  await showCorrectionControls(page);await source.fill('Retained mobile correction');
  await expect(current.getByRole('button',{name:'Hide remaining items',exact:true})).toBeVisible();
  if(phone)await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
  await compactNext.click();await expectJump(condition);
  // Both compact actions skip the resolved source and revisit the sole condition.
  await compactPrevious.click();await expectJump(condition);
  await compactNext.click();await expectJump(condition);
  await condition.selectOption(marker.condition.id);
  await expect(compactNext).toHaveCount(0);
  await expect(compactPrevious).toHaveCount(0);
  await expect(current).toContainText('All required information is complete.');
  await expect(current.getByRole('button',{name:/^(Show|Hide) remaining items$/})).toHaveCount(0);
  await expect(condition).toBeFocused();
  // If an issue is reintroduced, the same panel choice and controls become available again.
  await condition.selectOption('');
  await expect(current.getByRole('button',{name:phone?'Show remaining items':'Hide remaining items',exact:true})).toBeVisible();
  await expect(compactNext).toBeVisible();await expect(compactPrevious).toBeVisible();
  await condition.selectOption(marker.condition.id);
  await expect(current.getByRole('button',{name:/^(Show|Hide) remaining items$/})).toHaveCount(0);
  await expect(compactReturn).toBeInViewport({ratio:1});
  await compactReturn.click();await expect(summary.getByRole('heading')).toBeFocused();
  await expect(region.getByText('Retained mobile correction',{exact:true})).toBeVisible();
  expect(state.getInspections()).toEqual(originals);expect(state.uploads).toHaveLength(0);
 });
}

for(const phone of [false,true]){
 test(`keyboard help preference persists across inspections and reloads (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const help=current.locator('.inspection-keyboard-help');
  const hint=current.locator('.inspection-keyboard-hint');
  const toggle=current.getByText('Keyboard shortcuts',{exact:true});
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await condition.selectOption('');
   await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true}).click();
   await showCorrectionControls(page);
  };
  const save=async()=>{
   await condition.selectOption(marker.condition.id);
   await current.getByRole('button',{name:'Return to review',exact:true}).click();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await begin();await expect(hint).not.toBeVisible();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained preference draft');
  await toggle.click();await expect(hint).toBeVisible();
  await save();expect(state.getInspections()[2].source).toBe('Retained preference draft');
  await begin();await expect(hint).toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(hint).toBeVisible();
  await toggle.click();await expect(help).not.toHaveAttribute('open');
  await save();await begin();await expect(hint).not.toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(hint).not.toBeVisible();
  await toggle.click();await expect(hint).toBeVisible();
 });
}

test('keyboard help remains usable when browser preference storage is unavailable',async({page})=>{
 await page.addInitScript(()=>{
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
  Storage.prototype.getItem=function(key){if(['cemetery-mapping:inspection-keyboard-help-open','cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open'].includes(key))throw new DOMException('Unavailable','SecurityError');return get.call(this,key);};
  Storage.prototype.setItem=function(key,value){if(['cemetery-mapping:inspection-keyboard-help-open','cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open'].includes(key))throw new DOMException('Unavailable','QuotaExceededError');set.call(this,key,value);};
 });
 await setup(page);
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
 await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true}).click();
 const current=region.getByRole('region',{name:'Current required item',exact:true});
 const toggle=current.getByText('Keyboard shortcuts',{exact:true});
 const hint=current.locator('.inspection-keyboard-hint');
 await toggle.click();await expect(hint).toBeVisible();
 await current.getByRole('button',{name:'Return to review',exact:true}).click();
 await region.getByRole('region',{name:'Required information',exact:true}).getByRole('button',{name:'Choose condition',exact:true}).click();
 await showCorrectionControls(page);await expect(hint).toBeVisible();
 await toggle.click();await expect(hint).not.toBeVisible();
 await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
 await expect(current.getByRole('list',{name:'Remaining required items'})).not.toBeVisible();
 await showCorrectionControls(page);
 await expect(current.getByRole('list',{name:'Remaining required items'})).toBeVisible();
 await toggle.click();await expect(hint).toBeVisible();
 await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
 await region.getByRole('button',{name:'Reset display preferences',exact:true}).click();
 await expect(current.getByRole('list',{name:'Remaining required items'})).toBeVisible();
 await expect(hint).not.toBeVisible();
 const resetHelp=region.locator('.inspection-reset-keyboard-help');
 await resetHelp.getByText('Keyboard shortcuts',{exact:true}).click();
 await expect(resetHelp.locator('ul')).toBeVisible();
 await page.keyboard.press('Escape');
 await region.getByRole('button',{name:'Reset display preferences',exact:true}).click();
 await expect(resetHelp.locator('ul')).not.toBeVisible();
 const restored=region.locator('.inspection-restored-defaults-list');
 await restored.getByText(/^Restored defaults \(\d+\)$/).click();await expect(restored.locator('ul')).toBeVisible();
 await page.keyboard.press('Escape');
 await region.getByRole('button',{name:'Reset display preferences',exact:true}).click();
 await expect(restored.locator('ul')).not.toBeVisible();
});

for(const phone of [false,true]){
 test(`remaining-items preference persists without overriding phone correction collapse (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const list=current.getByRole('list',{name:'Remaining required items',exact:true});
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await condition.selectOption('');
   await inspectionStep(page,'Review & save');
   await region.getByRole('button',{name:'Edit visit & condition',exact:true}).click();
  };
  const save=async()=>{
   await condition.selectOption(marker.condition.id);
   await region.getByRole('button',{name:'Return to review',exact:true}).click();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await begin();await expect(list).toBeVisible();
  await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
  await expect(list).not.toBeVisible();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained remaining-items draft');
  await save();expect(state.getInspections()[2].source).toBe('Retained remaining-items draft');
  await begin();await expect(list).not.toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(list).not.toBeVisible();
  await current.getByRole('button',{name:'Show remaining items',exact:true}).click();
  await expect(list).toBeVisible();
  await current.getByRole('button',{name:'Next missing item',exact:true}).click();
  await expect(condition).toBeFocused();
  if(phone)await expect(list).not.toBeVisible();else await expect(list).toBeVisible();
  await save();await begin();await expect(list).toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(list).toBeVisible();
  await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true}).click();
  await expect(condition).toBeFocused();
  if(phone)await expect(list).not.toBeVisible();else await expect(list).toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`reset display preferences preserves the inspection draft (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const list=current.getByRole('list',{name:'Remaining required items',exact:true});
  const hint=current.locator('.inspection-keyboard-hint');
  const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained reset source');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Faces & photos');
  await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Retained reset reading');
  await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('reset-retained.png'));
  await face(1).getByRole('textbox',{name:'Notes',exact:true}).fill('Retained reset photo note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('');
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Label face 2',exact:true}).click();
  await showCorrectionControls(page);
  await current.getByText('Keyboard shortcuts',{exact:true}).click();await expect(hint).toBeVisible();
  await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  await expect(reset).toHaveCount(1);
  const stickyReset=current.getByRole('button',{name:'Reset display preferences',exact:true});
  const scrollPanel=page.locator('.detail-panel');
  const beforeScroll=await scrollPanel.evaluate(el=>el.scrollTop);
  await scrollPanel.evaluate(el=>{el.scrollTop-=120;});
  await expect.poll(()=>scrollPanel.evaluate(el=>el.scrollTop)).toBeLessThan(beforeScroll-80);
  await expect(stickyReset).toBeInViewport({ratio:1});
  await page.clock.install();
  await reset.focus();await page.keyboard.press('Enter');
  await expect(reset).toBeFocused();await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await expect(current.getByRole('status').filter({hasText:'Display defaults restored:'})).toBeVisible();
  await expect(stickyReset).toBeInViewport({ratio:1});
  const confirmation=region.getByRole('status').filter({hasText:'Display defaults restored:'});
  const restoredList=region.locator('.inspection-restored-defaults-list ul');
  const restoredToggle=region.getByText(/^Restored defaults \(\d+\)$/);
  await expect(restoredList).not.toBeVisible();
  await restoredToggle.focus();await page.keyboard.press('Enter');
  await expect(restoredToggle).toBeFocused();await expect(restoredList).toBeVisible();
  await expect(restoredList.getByRole('listitem')).toHaveText(['Remaining items: shown','Inspection keyboard hint: hidden','Reset confirmation keyboard hint: hidden','Restored-defaults list: hidden']);
  await expect(restoredToggle).toHaveText(`Restored defaults (${await restoredList.getByRole('listitem').count()})`);
  await page.keyboard.press('Space');await expect(restoredList).not.toBeVisible();
  await expect(restoredToggle).toBeFocused();await expect(confirmation).toBeVisible();
  const escapeHint=region.locator('.inspection-reset-escape-hint');
  await expect(escapeHint).not.toBeVisible();
  const confirmationHelp=region.locator('.inspection-reset-keyboard-help').getByText('Keyboard shortcuts',{exact:true});
  await confirmationHelp.focus();await page.keyboard.press('Enter');
  await expect(confirmationHelp).toBeFocused();await expect(escapeHint).toBeVisible();
  await expect(escapeHint.getByRole('listitem')).toHaveCount(3);
  if(phone)await page.screenshot({path:testInfo.outputPath('inspection-reset-shortcuts-phone.png')});
  await page.keyboard.press('Space');await expect(escapeHint).not.toBeVisible();await expect(confirmationHelp).toBeFocused();
  await expect(confirmation).toBeVisible();
  await confirmationHelp.click();await expect(escapeHint).toBeVisible();
  await page.clock.runFor(3000);await expect(confirmation).toBeVisible();
  await reset.click();
  await page.clock.runFor(1500);await expect(confirmation).toBeVisible();
  await page.clock.runFor(2500);await expect(confirmation).toHaveCount(0);
  await expect(reset).toBeFocused();await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await reset.click();
  const dismiss=region.getByRole('button',{name:'Dismiss display preferences confirmation',exact:true});
  await expect(restoredList).not.toBeVisible();
  await restoredToggle.click();await expect(restoredList).toBeVisible();
  await expect(escapeHint).not.toBeVisible();
  await expect(dismiss).toHaveAccessibleDescription('Tab/Shift+Tab Next/previous control Enter/Space Activate Dismiss Escape Dismiss and return to Reset display preferences');
  await page.keyboard.press('Escape');
  await expect(escapeHint).toHaveCount(0);
  await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await reset.click();await expect(restoredList).not.toBeVisible();
  await dismiss.focus();await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await reset.click();await dismiss.focus();await page.keyboard.press('Enter');
  await expect(confirmation).toHaveCount(0);await expect(dismiss).toHaveCount(0);
  await expect(reset).toBeFocused();await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await page.clock.runFor(4500);await expect(reset).toBeFocused();
  expect(dialogs).toBe(0);expect(state.getInspections()).toEqual(originals);expect(state.uploads).toHaveLength(0);
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('Reverse');
  await page.keyboard.press('Escape');await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await reset.click();await expect(escapeHint).not.toBeVisible();
  await confirmationHelp.click();await expect(escapeHint).toBeVisible();
  await restoredToggle.click();await expect(restoredList).toBeVisible();
  await current.getByRole('button',{name:'Return to review',exact:true}).click();
  await expect(escapeHint).toBeVisible();
  await expect(restoredList).toBeVisible();
  await reset.click();await expect(reset).toBeFocused();
  await expect(restoredList).not.toBeVisible();
  await expect(escapeHint).not.toBeVisible();
  await confirmationHelp.focus();await page.keyboard.press('Enter');await expect(escapeHint).toBeVisible();
  await page.keyboard.press('Escape');await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await reset.click();await expect(confirmation).toBeVisible();await expect(escapeHint).not.toBeVisible();
  await expect(restoredList).not.toBeVisible();
  await confirmationHelp.focus();await page.keyboard.press('Space');await expect(escapeHint).toBeVisible();
  await page.keyboard.press('Space');await expect(escapeHint).not.toBeVisible();
  await dismiss.click();
  await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await reset.click();await expect(escapeHint).not.toBeVisible();
  await page.clock.runFor(4000);await expect(confirmation).toHaveCount(0);
  await expect(region.getByText('Retained reset source',{exact:true})).toBeVisible();
  await expect(region.getByRole('paragraph').filter({hasText:/^Retained reset reading$/})).toBeVisible();
  await expect(region.getByRole('region',{name:'Photos for Front',exact:true})).toContainText('Retained reset photo note');
  await region.getByRole('button',{name:'Save inspection',exact:true}).click();
  await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  expect(state.getInspections()[2].source).toBe('Retained reset source');
  expect(state.getInspections()[2].faces[0].inscription).toBe('Retained reset reading');
  expect(state.uploads).toHaveLength(1);expect(dialogs).toBe(0);
  await openRecord(page,true);
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Edit visit & condition',exact:true}).click();
  await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`reset restores confirmation-hint defaults across inspections and reloads (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const hint=region.locator('.inspection-reset-escape-hint');
  const help=region.locator('.inspection-reset-keyboard-help').getByText('Keyboard shortcuts',{exact:true});
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  const dismiss=region.getByRole('button',{name:'Dismiss display preferences confirmation',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
   await inspectionStep(page,'Review & save');
   await reset.click();
  };
  const save=async()=>{
   await dismiss.click();await expect(reset).toBeFocused();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained reset-help preference draft');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Review & save');await reset.click();
  await expect(hint).not.toBeVisible();await help.click();await expect(hint).toBeVisible();
  await save();expect(state.getInspections()[2].source).toBe('Retained reset-help preference draft');
  await begin();await expect(hint).not.toBeVisible();await save();
  await openRecord(page,true);
  await begin();await expect(hint).not.toBeVisible();
  await help.click();await expect(hint).toBeVisible();
  await reset.click();await expect(hint).not.toBeVisible();await save();
  await begin();await expect(hint).not.toBeVisible();await save();
  await openRecord(page,true);
  await begin();await expect(hint).not.toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`reset restores list visibility defaults across inspections and reloads (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const restored=region.locator('.inspection-restored-defaults-list ul');
  const toggle=region.getByText(/^Restored defaults \(\d+\)$/);
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
   await inspectionStep(page,'Review & save');await reset.click();
  };
  const save=async()=>{
   await region.getByRole('button',{name:'Dismiss display preferences confirmation',exact:true}).click();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained restored-defaults draft');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Review & save');await reset.click();
  await expect(restored).not.toBeVisible();await toggle.click();await expect(restored).toBeVisible();
  await save();expect(state.getInspections()[2].source).toBe('Retained restored-defaults draft');
  await begin();await expect(restored).not.toBeVisible();await save();
  await openRecord(page,true);await begin();await expect(restored).not.toBeVisible();
  await toggle.click();await expect(restored).toBeVisible();
  await reset.click();await expect(restored).not.toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('cemetery-mapping:inspection-restored-defaults-open'))).toBe('false');
  await save();
  await begin();await expect(restored).not.toBeVisible();await save();
  await openRecord(page,true);await begin();await expect(restored).not.toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`display reset applies every listed default from nondefault preferences (${phone?'phone':'desktop'})`,async({page})=>{
  await page.addInitScript(()=>{
   localStorage.setItem('cemetery-mapping:inspection-remaining-items-open','false');
   localStorage.setItem('cemetery-mapping:inspection-keyboard-help-open','true');
   localStorage.setItem('cemetery-mapping:inspection-reset-keyboard-help-open','true');
   localStorage.setItem('cemetery-mapping:inspection-restored-defaults-open','true');
  });
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const original=structuredClone(state.getInspections());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Shared-defaults retained draft');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Review & save');
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  await reset.focus();await page.keyboard.press('Enter');await expect(reset).toBeFocused();
  expect(await page.evaluate(()=>[
   'cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-keyboard-help-open',
   'cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open',
  ].map(key=>localStorage.getItem(key)))).toEqual(['true','false','false','false']);
  await expect(region.locator('.inspection-restored-defaults-list ul')).not.toBeVisible();
  await expect(region.locator('.inspection-reset-escape-hint')).not.toBeVisible();
  await region.getByText(/^Restored defaults \(\d+\)$/).click();
  await expect(region.locator('.inspection-restored-defaults-list li')).toHaveText([
   'Remaining items: shown','Inspection keyboard hint: hidden','Reset confirmation keyboard hint: hidden','Restored-defaults list: hidden',
  ]);
  await expect(region.getByText('Shared-defaults retained draft',{exact:true})).toBeVisible();
  expect(dialogs).toBe(0);expect(state.getInspections()).toEqual(original);expect(state.uploads).toHaveLength(0);
 });
}

for(const phone of [false,true])for(const invalid of [false,true]){
 test(`display startup matches shared defaults (${invalid?'invalid':'absent'} storage, ${phone?'phone':'desktop'})`,async({page})=>{
  if(invalid)await page.addInitScript(()=>{
   for(const key of ['cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-keyboard-help-open','cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open'])localStorage.setItem(key,'invalid');
  });
  await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Edit visit & condition',exact:true}).click();
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  await expect(current.getByRole('list',{name:'Remaining required items',exact:true})).toBeVisible();
  await expect(current.locator('.inspection-keyboard-hint')).not.toBeVisible();
  const before=await region.getByLabel('Inspection source',{exact:true}).inputValue();
  await current.getByRole('button',{name:'Reset display preferences',exact:true}).click();
  await expect(current.getByRole('list',{name:'Remaining required items',exact:true})).toBeVisible();
  await expect(current.locator('.inspection-keyboard-hint')).not.toBeVisible();
  await expect(current.locator('.inspection-reset-escape-hint')).not.toBeVisible();
  await expect(current.locator('.inspection-restored-defaults-list ul')).not.toBeVisible();
  await expect(region.getByLabel('Inspection source',{exact:true})).toHaveValue(before);
 });
}
