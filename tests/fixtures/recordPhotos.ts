import { expect, type Page } from '@playwright/test';
import { overviewFixture, marker } from './overview';
import { select } from './cemetery';

export async function openRecord(page:Page,reload=false){
 if(reload)await page.reload();else await page.goto('/');
 if((page.viewportSize()?.width??1280)<=760)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
 await select(page,'A-TEST');
 await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByRole('button',{name:/HS-OVERVIEW/}).click();
 await page.getByRole('tab',{name:'Details',exact:true}).click();
}

export async function setup(page:Page,multipleFaces=false,threeFaces=false,lostPhotoResponse?:string){
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
 await page.route('**/api/headstone-lookups*',route=>route.fulfill({json:{markerTypes:[marker.markerType],markerScopes:[marker.markerScope],materials:[marker.material],conditions:[marker.condition]}}));
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
 const receipts=new Map<string,typeof photos[number]>();
 const uploadAttempts:{filename:string|null;operationId:string|null}[]=[];
 const uploads:{inspectionId:string|null;maintenanceRecordId:string|null;phase:string|null;faceId:string|null}[]=[];
 await page.route('**/api/headstones/marker-1/media-assets?**',route=>{
  const params=new URL(route.request().url()).searchParams;
  const filename=params.get('filename'),operationId=params.get('operationId');
  uploadAttempts.push({filename,operationId});
  const receipt=operationId?receipts.get(operationId):undefined;
  if(receipt)return route.fulfill({json:receipt});
  const target={inspectionId:params.get('inspectionId'),maintenanceRecordId:params.get('maintenanceRecordId'),phase:params.get('phase'),faceId:params.get('faceId')};uploads.push(target);
  const photo={...photos[0],id:uploads.length===1?'uploaded':`uploaded-${uploads.length}`,fileUrl:'/media/uploaded.png',originalFilename:'uploaded.png',notes:'uploaded'};photos.push(photo);
  if(target.inspectionId||target.maintenanceRecordId)links.push({id:`uploaded-link-${uploads.length}`,mediaAssetId:photo.id,inspectionId:target.inspectionId??undefined,maintenanceRecordId:target.maintenanceRecordId??undefined,phase:target.phase??'unspecified',faceId:target.faceId??undefined});
  if(operationId)receipts.set(operationId,photo);
  if(lostPhotoResponse && filename===lostPhotoResponse)return route.abort();
  return route.fulfill({json:photo});
 });
 await openRecord(page);
 return {uploads,uploadAttempts,getLinks:()=>links,getInspections:()=>readings,getPhotos:()=>photos};
}

export async function showPhotos(region:import('@playwright/test').Locator,count:number){
 await expect(region.locator('.media-gallery-card')).toHaveCount(count);
 for(const card of await region.locator('.media-gallery-card').all()){
  await card.scrollIntoViewIfNeeded();
  await expect(card.getByRole('link',{name:/Open photo:/})).toHaveCount(1);
 }
 await expect(region.getByRole('link',{name:/Open photo:/})).toHaveCount(count);
}

export const gallery=(page:Page)=>page.getByRole('dialog',{name:'Marker photo gallery',exact:true});
export async function openGallery(page:Page,record='inspection'){
 const photos=page.getByRole('region',{name:record==='inspection'?'Inspection photos':'Maintenance photos',exact:true});
 await photos.getByRole('button',{name:'Open photo gallery',exact:true}).click();
 await expect(gallery(page).getByText('Refreshing photo associations…',{exact:true})).toHaveCount(0);
 return gallery(page);
}
export async function closeGallery(page:Page){await gallery(page).getByRole('button',{name:'Close gallery',exact:true}).click();}
export const card=(page:Page,id:string)=>gallery(page).locator('.media-gallery-card').filter({has:page.locator('.media-photo-filename').filter({hasText:id})});
export async function upload(page:Page,name='upload.png'){
 const modal=gallery(page);
 await modal.getByRole('button',{name:'Add photos',exact:true}).click();
 await modal.locator('input[type=file]').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from('photo')});
 await modal.getByRole('button',{name:'Upload photo',exact:true}).click();
 await expect(modal.getByText('Photo uploaded and linked.',{exact:true})).toBeVisible();
}

export const draftPhoto=(name:string)=>({name,mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')});

export async function showCorrectionControls(page:Page){
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

export async function inspectionStep(page: Page, name: string) {
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
