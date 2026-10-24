import {expect,test,type Page} from '@playwright/test';
import {overviewFixture,marker,overviewGrave} from './fixtures/overview';
import {cemeteryId,gravePath,select} from './fixtures/cemetery';

const expectedSections=['inspections','photos','maintenance','information','review'];
const section=(page:Page,id:string)=>page.locator(`[data-marker-section="${id}"]`);
async function setup(page:Page,standalone=true,role='admin'){
 await overviewFixture(page);
 await page.route('**/api/me',route=>route.fulfill({json:{role,assignedCemeteryIds:role==='admin'?[]:[cemeteryId],permissions:{}}}));
 await page.route('**/api/headstone-lookups',route=>route.fulfill({json:{markerTypes:[marker.markerType],markerScopes:[marker.markerScope],materials:[marker.material],conditions:[{...marker.condition,code:'unknown'}],maintenanceIssueTypes:[{id:'weathering',code:'weathering',label:'Weathering'}],maintenanceActionTypes:[{id:'cleaning',code:'cleaning',label:'Cleaning'}],maintenancePriorities:[{id:'normal',code:'normal',label:'Normal'}]}}));
 const entry={...marker,sourceConflict:true,reviewNotes:'Check source date',dataConfidence:'low',reviewStatus:'needs_review',provenanceVerifiedAt:'2026-10-20'};
 await page.route('**/api/headstones/marker-1',route=>route.fulfill({json:entry}));
 await page.route(gravePath('A-TEST'),route=>route.fulfill({json:{...overviewGrave('A-TEST'),headstones:[entry]}}));
 await page.goto('/');
 if((page.viewportSize()?.width??1280)<=760)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
 await select(page,'A-TEST');
 if(standalone){
  await page.getByRole('tabpanel',{name:'Overview',exact:true}).getByRole('button',{name:/HS-OVERVIEW/}).click();
  await page.getByRole('tab',{name:'Details',exact:true}).click();
 }else await page.getByRole('tab',{name:'Monuments and photos'}).click();
}

for(const standalone of [true,false])test(`${standalone?'standalone':'gravesite'} marker has five sections with actions and evidence in their own section`,async({page})=>{
 await setup(page,standalone);
 await expect.poll(()=>page.locator('[data-marker-section]').evaluateAll(elements=>elements.map(element=>element.getAttribute('data-marker-section')))).toEqual(expectedSections);
 const nav=page.getByRole('navigation',{name:'Sections for marker HS-OVERVIEW'});
 await expect(nav.getByRole('combobox',{name:'Jump to section'}).getByRole('option')).toHaveText(['Inspections','Photos','Maintenance','Marker information','Sources & review']);
 await expect(section(page,'inspections').getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
 await expect(section(page,'photos').getByRole('button',{name:'Photo gallery (2)',exact:true})).toBeVisible();
 await expect(section(page,'information').getByRole('button',{name:'Edit marker information HS-OVERVIEW',exact:true})).toBeVisible();
 await expect(section(page,'information').getByText('Check source date',{exact:true})).toHaveCount(0);
 await expect(section(page,'review')).toContainText('Check source date');
 await expect(section(page,'review')).toContainText('NHG inclusion');
 await expect(section(page,'review').getByRole('button',{name:'Edit sources & review',exact:true})).toBeVisible();
});

test('section menu focuses headings without discarding a pending inspection or its photos',async({page})=>{
 await setup(page);
 const inspections=section(page,'inspections');
 await inspections.getByRole('button',{name:'New inspection',exact:true}).click();
 await inspections.getByLabel('Inspection source',{exact:true}).fill('Unfinished site visit');
 await inspections.getByRole('button',{name:'Next: Faces & photos',exact:true}).click();
 await inspections.getByLabel('Choose photos to upload',{exact:true}).setInputFiles({name:'unsaved.png',mimeType:'image/png',buffer:Buffer.from('photo')});
 const nav=page.getByRole('navigation',{name:'Sections for marker HS-OVERVIEW'});
 await nav.getByRole('combobox',{name:'Jump to section'}).selectOption('photos');
 await expect(section(page,'photos').getByRole('heading',{name:'Photos',exact:true})).toBeFocused();
 await expect(nav.getByRole('combobox',{name:'Jump to section'})).toHaveValue('photos');
 await nav.getByRole('combobox',{name:'Jump to section'}).selectOption('photos');
 await expect(section(page,'photos').getByRole('heading',{name:'Photos',exact:true})).toBeFocused();
 await section(page,'photos').getByRole('button',{name:'Photo gallery (2)',exact:true}).click();
 await page.getByRole('dialog',{name:'Marker photo gallery'}).getByRole('button',{name:'Close gallery',exact:true}).click();
 await nav.getByRole('combobox',{name:'Jump to section'}).selectOption('inspections');
 await expect(inspections.getByRole('img',{name:'Preview of unsaved.png',exact:true})).toBeVisible();
 await inspections.getByRole('button',{name:'Back',exact:true}).click();
 await expect(inspections.getByLabel('Inspection source',{exact:true})).toHaveValue('Unfinished site visit');
});

test('marker maintenance creation stays bound to that marker from its section',async({page})=>{
 await setup(page,false);
 let input:Record<string,unknown>|undefined;
 await page.route('**/api/cemeteries/*/maintenance-records',route=>{
  input=route.request().postDataJSON();return route.fulfill({json:{...input,id:'work-1',headstoneUuid:marker.id,priority:{id:'normal',label:'Normal'}}});
 });
 const maintenance=section(page,'maintenance');
 await maintenance.getByText('Add maintenance record',{exact:true}).click();
 await maintenance.getByRole('textbox',{name:'Notes',exact:true}).fill('Check leaning marker');
 await maintenance.getByRole('button',{name:'Add maintenance',exact:true}).click();
 await expect(maintenance).toContainText('Maintenance recorded.');
 expect(input).toMatchObject({targetType:'headstone',headstoneId:marker.id,graveSpaceId:'',notes:'Check leaning marker'});
});

test('sources section and focused editors are readable on phones, and cancel returns focus',async({page},testInfo)=>{
 await page.setViewportSize({width:390,height:844});
 await setup(page);
 const nav=page.getByRole('navigation',{name:'Sections for marker HS-OVERVIEW'});
 await expect(nav.getByRole('combobox',{name:'Jump to section'})).toBeVisible();
 expect((await nav.boundingBox())!.height).toBeLessThanOrEqual(64);
 await nav.screenshot({path:testInfo.outputPath('marker-section-navigation-phone.png')});
 await nav.getByRole('combobox',{name:'Jump to section'}).selectOption('review');
 await section(page,'review').screenshot({path:testInfo.outputPath('marker-sources-phone.png')});
 await section(page,'review').getByRole('button',{name:'Edit sources & review',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Data confidence',exact:true})).toBeFocused();
 await page.locator('form.headstone-record').getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(section(page,'review').getByRole('heading',{name:'Sources & review',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('readers retain all five sections without editing controls',async({page})=>{
 await setup(page,true,'reader');
 await expect(page.locator('[data-marker-section]')).toHaveCount(5);
 await expect(section(page,'review')).toContainText('Check source date');
 await expect(section(page,'review').getByRole('button',{name:'Edit sources & review',exact:true})).toHaveCount(0);
 await expect(section(page,'information').getByRole('button',{name:'Edit face records',exact:true})).toHaveCount(0);
 await expect(section(page,'maintenance').getByText('Add maintenance record',{exact:true})).toHaveCount(0);
});

for(const standalone of [true,false])for(const phone of [false,true]){
 test(`section menu stays below tabs during scrolling (${standalone?'standalone':'gravesite'}, ${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  if(phone)await page.setViewportSize({width:390,height:844});
  await setup(page,standalone);
  const nav=page.getByRole('navigation',{name:'Sections for marker HS-OVERVIEW'});
  const menu=nav.getByRole('combobox',{name:'Jump to section'});
  const tabs=page.locator('.detail-panel .detail-tabs');
  const panel=page.locator('.detail-panel');
  for(const id of ['photos','review','maintenance','inspections']){
   await menu.selectOption(id);
   const heading=section(page,id).getByRole('heading').first();
   await expect(heading).toBeFocused();await expect(menu).toBeInViewport({ratio:1});
   await expect(menu).toHaveValue(id);
   const navBox=await nav.boundingBox(),tabsBox=await tabs.boundingBox(),headingBox=await heading.boundingBox();
   expect(navBox!.y).toBeGreaterThanOrEqual(tabsBox!.y+tabsBox!.height-1);
   expect(headingBox!.y).toBeGreaterThanOrEqual(navBox!.y+navBox!.height-1);
  }
  await menu.selectOption('photos');
  const before=await nav.boundingBox(),scrollBefore=await panel.evaluate(el=>el.scrollTop);
  await panel.evaluate(el=>{el.scrollTop+=120;});
  await expect.poll(()=>panel.evaluate(el=>el.scrollTop)).toBeGreaterThan(scrollBefore+80);
  const after=await nav.boundingBox();expect(Math.abs(after!.y-before!.y)).toBeLessThan(2);
  await expect(menu).toBeInViewport({ratio:1});
  await menu.focus();
  for(const id of ['information','maintenance','photos','inspections','review']){
   await nav.evaluate((nav,id)=>{
    const panel=nav.closest('.detail-panel')!;
    const target=nav.parentElement!.querySelector(`[data-marker-section="${id}"]`)!;
    panel.scrollTop+=target.getBoundingClientRect().top-nav.getBoundingClientRect().bottom-8;
   },id);
   await expect(menu).toHaveValue(id);await expect(menu).toBeFocused();
  }
  if(phone)await page.screenshot({path:testInfo.outputPath('marker-sticky-section-menu-phone.png')});
 });
}
