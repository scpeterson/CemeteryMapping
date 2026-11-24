import { test, expect } from '@playwright/test';
import { marker } from './fixtures/overview';
import { cemeteryId } from './fixtures/cemetery';
import { setup, openRecord, showPhotos, gallery, openGallery, closeGallery, card, upload, draftPhoto, inspectionStep } from './fixtures/recordPhotos';

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
 await modal.locator('.photo-gallery-extra-filters summary').click();
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
 await modal.getByRole('button',{name:'Add photos',exact:true}).click();
 await modal.getByRole('combobox',{name:'Photo face',exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
 await expect(modal.getByRole('combobox',{name:'Maintenance timing',exact:true})).toHaveCount(0);
 await modal.locator('input[type=file]').setInputFiles({name:'inspection.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 await modal.getByRole('button',{name:'Upload photo',exact:true}).click();
 await expect(modal.getByText('Photo uploaded and linked.',{exact:true})).toBeVisible();
 expect(state.uploads[0]).toMatchObject({inspectionId:'field',maintenanceRecordId:null,faceId:'22222222-2222-4222-8222-222222222222',phase:'unspecified'});
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('maintenance:cleaning');
 await modal.getByRole('button',{name:'Add photos',exact:true}).click();
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
 await modal.getByRole('button',{name:'Add photos',exact:true}).click();
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
 await expect(modal.getByRole('combobox',{name:'Filter by face',exact:true})).toBeHidden();
 await expect(modal.getByRole('combobox',{name:'Filter by maintenance timing',exact:true})).toBeHidden();
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('all');
 await expect(modal.getByRole('button',{name:'Choose existing photos',exact:true})).toHaveCount(0);
 await expect(modal.getByRole('button',{name:'Add photos',exact:true})).toBeVisible();
 await expect(card(page,'latest-marker.png')).toBeVisible();
 const photoBox=await card(page,'latest-marker.png').boundingBox();
 expect(photoBox!.y).toBeLessThan(500);
 await modal.screenshot({path:testInfo.outputPath('compact-gallery-phone.png')});
 await modal.locator('.photo-gallery-extra-filters summary').click();
 await modal.getByRole('combobox',{name:'Filter by maintenance timing',exact:true}).selectOption('after');
 await expect(modal.locator('.photo-gallery-extra-filters summary')).toHaveText('Filters (1)');
 await modal.locator('.photo-gallery-extra-filters summary').click();
 await expect(modal.getByRole('combobox',{name:'Filter by maintenance timing',exact:true})).toBeHidden();
 await modal.locator('.photo-gallery-extra-filters summary').click();
 await expect(modal.getByRole('combobox',{name:'Filter by maintenance timing',exact:true})).toHaveValue('after');
 await modal.getByRole('combobox',{name:'Filter by maintenance timing',exact:true}).selectOption('');
 await modal.locator('.photo-gallery-extra-filters summary').click();
 await modal.getByRole('combobox',{name:'Photo record',exact:true}).selectOption('maintenance:cleaning');
 await modal.getByRole('button',{name:'Choose existing photos',exact:true}).click();
 await card(page,'latest-marker.png').getByRole('button',{name:'Link to this record',exact:true}).click();
 await modal.getByRole('combobox',{name:'Maintenance timing',exact:true}).selectOption('during');
 await modal.screenshot({path:testInfo.outputPath('unified-gallery-phone.png')});
 expect(await modal.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
 await modal.getByRole('button',{name:'Cancel photo changes',exact:true}).click();
 await closeGallery(page);
});

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
 await expect(region.getByRole('status').filter({hasText:'first.png: Saved and linked'})).toContainText('first.png: Saved and linked');
 await expect(region.getByRole('status').filter({hasText:'retry.png: Pending'})).toContainText('retry.png: Pending');
 await expect(region.getByRole('status',{name:'Inspection save status',exact:true})).toContainText('photos need retry');
 expect(state.getInspections()).toHaveLength(3);expect(state.uploads).toHaveLength(2);
 await region.getByRole('button',{name:'Retry remaining photos',exact:true}).click();
 await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 await expect(region.getByRole('status',{name:'Inspection save status',exact:true})).toHaveText('All changes saved.');
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
 await modal.locator('.photo-gallery-extra-filters summary').click();
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
 await modal.getByRole('button',{name:'Add photos',exact:true}).click();
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

test('inspection recovery resumes face edits and requires photo reselection before save',async({page})=>{
 const state=await setup(page,true,true);
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByLabel('Inspection source',{exact:true}).fill('Recovered field visit');
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
 await inspectionStep(page,'Faces & photos');
 await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
 const back=region.getByRole('group',{name:'Inspection face 2',exact:true});
 await back.getByRole('textbox',{name:'Face inscription',exact:true}).fill('Recovered back reading');
 await back.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('recover.png'));
 await back.getByRole('textbox',{name:'Notes',exact:true}).fill('Retain these photo notes');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('cemetery-mapping:inspection-draft:v1:local:marker-1'))).toContain('Recovered back reading');
 page.once('dialog',dialog=>dialog.accept());
 await openRecord(page,true);
 await region.getByRole('button',{name:'Resume draft',exact:true}).click();
 await expect(back.getByRole('textbox',{name:'Face inscription',exact:true})).toHaveValue('Recovered back reading');
 await inspectionStep(page,'Review & save');
 await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeDisabled();
 await region.getByRole('button',{name:'Edit face 2: Back',exact:true}).click();
 await back.getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('recover.png'));
 await expect(back.getByRole('textbox',{name:'Notes',exact:true})).toHaveValue('Retain these photo notes');
 await region.getByRole('button',{name:'Return to review',exact:true}).click();
 await region.getByRole('button',{name:'Save inspection',exact:true}).click();
 await expect(region.getByRole('status',{name:'Inspection save status',exact:true})).toHaveText('All changes saved.');
 expect(state.getInspections()).toHaveLength(3);expect(state.uploads).toHaveLength(1);
 expect(state.getInspections()[2].source).toBe('Recovered field visit');
 expect(await page.evaluate(()=>localStorage.getItem('cemetery-mapping:inspection-draft:v1:local:marker-1'))).toBeNull();
});

test('inspection recovery ignores malformed snapshots and survives unavailable storage',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('cemetery-mapping:inspection-draft:v1:local:marker-1',JSON.stringify({version:1,draft:{id:'invalid'}}));
  Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};
 });
 await setup(page,true);
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await expect(region.getByRole('button',{name:'Resume draft',exact:true})).toHaveCount(0);
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await expect(region.getByRole('alert')).toContainText('Browser draft recovery is unavailable');
 await region.getByLabel('Inspection source',{exact:true}).fill('Still editable');
 await expect(region.getByLabel('Inspection source',{exact:true})).toHaveValue('Still editable');
});

test.describe('phone field workflow',()=>{
 test.use({hasTouch:true,isMobile:true});
 for(const width of [320,390]){
  test(`complete inspection with corrections and interrupted photo uploads at ${width}px`,async({page},testInfo)=>{
   const state=await setup(page,true,true);
   await page.setViewportSize({width,height:844});
   const region=page.getByRole('region',{name:'Inspections',exact:true});
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await region.getByLabel('Inspection source',{exact:true}).fill('');
   await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
   await inspectionStep(page,'Faces & photos');
   const face=(number:number)=>region.getByRole('group',{name:`Inspection face ${number}`,exact:true});
   await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Front reading recorded in the field');
   await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('field-front.png'));
   await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
   await face(2).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Back reading recorded in the field');
   await face(2).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('field-back.png'));
   await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('');
   await inspectionStep(page,'Review & save');
   await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeDisabled();
   await region.getByRole('button',{name:'Add inspection source',exact:true}).click();
   await region.getByLabel('Inspection source',{exact:true}).fill('Phone field visit');
   const panel=region.getByRole('region',{name:'Current required item',exact:true});
   for(const name of ['Previous missing item','Next missing item','Return to review']){
    const button=panel.getByRole('button',{name,exact:true});
    await expect(button).toBeInViewport();
    const box=await button.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);
   }
   await expect(panel.getByRole('button',{name:'Reset display preferences',exact:true})).toHaveCount(0);
   await panel.getByRole('button',{name:'Next missing item',exact:true}).click();
   await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
   await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('Back');
   await panel.screenshot({path:testInfo.outputPath(`corrections-${width}.png`)});
   await panel.getByRole('button',{name:'Return to review',exact:true}).click();
   await expect(region.getByRole('button',{name:'Save inspection',exact:true})).toBeEnabled();
   let attempts=0,release!:()=>void;
   const held=new Promise<void>(resolve=>{release=resolve;});
   await page.route('**/api/headstones/marker-1/media-assets?**',async route=>{
    attempts++;
    if(attempts===1)return route.fulfill({status:503,json:{error:'Temporary connection interruption'}});
    if(attempts===2)await held;
    return route.fallback();
   });
   try{
    await region.getByRole('button',{name:'Save inspection',exact:true}).click();
    await expect(region.getByRole('status',{name:'Inspection save status',exact:true})).toContainText('Inspection saved — saving photos');
    await region.screenshot({path:testInfo.outputPath(`saving-${width}.png`)});
   }finally{release();}
   await expect(region.getByRole('button',{name:'Retry remaining photos',exact:true})).toBeVisible();
   expect(state.getInspections()).toHaveLength(3);expect(state.uploads).toHaveLength(1);
   page.once('dialog',dialog=>dialog.accept());await openRecord(page,true);
   await region.getByRole('button',{name:'Resume draft',exact:true}).click();
   await expect(region.getByRole('button',{name:'Retry remaining photos',exact:true})).toBeDisabled();
   await region.getByLabel('Reselect field-front.png',{exact:true}).setInputFiles(draftPhoto('field-front.png'));
   await region.getByRole('button',{name:'Retry remaining photos',exact:true}).click();
   await expect(region.getByRole('status',{name:'Inspection save status',exact:true})).toHaveText('All changes saved.');
   expect(attempts).toBe(3);expect(state.uploads).toHaveLength(2);expect(state.getInspections()).toHaveLength(3);
   await region.getByRole('button',{name:'Open photo gallery',exact:true}).click();
   const modal=gallery(page);await expect(modal.locator('.media-gallery-card')).toHaveCount(2);
   await expect(modal.locator('header')).toContainText('2 of 4 photos');
   await expect(modal.getByRole('button',{name:'Add photos',exact:true})).toBeVisible();
   expect(await modal.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
   await modal.screenshot({path:testInfo.outputPath(`saved-gallery-${width}.png`)});
   await closeGallery(page);
  });
 }
});
