import {test,expect} from '@playwright/test';
import {fixture,cemeteryId,detail,geometry,summaries,gravePath,select} from './fixtures/cemetery';
import {marker} from './fixtures/overview';

for(const scenario of [{section:'G',existing:false},{section:'A',existing:false},{section:'G',existing:true},{section:'A',existing:true},{section:'G',existing:true,unrestricted:true}]){
 test(`marker defaults in ${scenario.section}, existing marker: ${scenario.existing}, unrestricted: ${'unrestricted' in scenario}`,async({page})=>{
  await fixture(page);
  const restricted=scenario.section==='G' && !('unrestricted' in scenario);
  const grave={...summaries[0],section:scenario.section,locationPolicies:{flat_markers_only:restricted,single_primary_marker:restricted}};
  const existing=scenario.existing?[{...marker,photoUrl:'',mediaAssets:[],relationshipType:'primary'}]:[];
  await page.route('**/api/cemetery-map',r=>r.fulfill({json:{boundaries:[{type:'Feature',properties:{id:cemeteryId,name:'Test Cemetery'},geometry}],sections:[],lots:[],graves:[grave],headstones:[]}}));
  await page.route('**/api/search**',r=>r.fulfill({json:[{grave,reasons:[]}] }));
  await page.route(gravePath(grave.id),r=>r.fulfill({json:{...detail(grave.id),...grave,headstones:existing}}));
  const option=(code:string)=>({id:code,code,label:code==='flat_marker'?'Flat marker':code==='footstone'?'Footstone':'Unknown'});
  await page.route('**/api/headstone-lookups*',r=>r.fulfill({json:{markerTypes:[option('footstone'),option('flat_marker')],markerScopes:[option('unknown')],materials:[option('unknown')],conditions:[option('unknown')]}}));
  let saved:Record<string,unknown>|undefined;
  await page.route('**/api/cemeteries/*/gravesites/*/headstones',async r=>{
   saved=r.request().postDataJSON();await r.fulfill({status:201,json:{...marker,id:'created-marker',headstoneId:'TLC-HS-0600',relationshipType:saved!.relationshipType}});
  });
  await page.route('https://imagery.pasda.psu.edu/**',r=>r.abort());
  await page.route('https://gisdata.alleghenycounty.us/**',r=>r.abort());
  await page.goto('/');
  if((page.viewportSize()?.width ?? 1280)<700)await page.getByRole('button',{name:'Search',exact:true}).click();
  await select(page,grave.id);
  await page.getByRole('tab',{name:'Monuments and photos'}).click();
  const add=page.getByRole('button',{name:'Add marker',exact:true});
  if(restricted && scenario.existing){
   await expect(add).toBeDisabled();
   await expect(page.getByText('One flat marker per gravesite; sharing is allowed.',{exact:true})).toBeVisible();
   expect(saved).toBeUndefined();return;
  }
  await add.click();
  const form=page.locator('form').filter({has:page.getByLabel('Marker ID',{exact:true})});
  await expect(form.getByLabel('Marker ID',{exact:true})).toHaveValue('');
  await expect(form.getByLabel('Relationship notes',{exact:true})).toHaveValue('');
  await expect(form.getByPlaceholder('Assigned automatically when saved')).toBeVisible();
  await expect(form.getByRole('combobox',{name:'Relationship',exact:true})).toHaveValue(!scenario.existing?'primary':'footstone');
  if(restricted){
   await expect(form.getByRole('combobox',{name:'Marker type',exact:true}).locator('option')).toHaveCount(1);
   await expect(form.getByRole('combobox',{name:'Marker type',exact:true})).toHaveValue('flat_marker');
   await expect(form.getByRole('combobox',{name:'Relationship',exact:true}).locator('option')).toHaveCount(2);
  }
  if(!restricted){
   await expect(form.getByRole('combobox',{name:'Marker type',exact:true}).locator('option')).toHaveCount(2);
   await expect(form.getByRole('combobox',{name:'Relationship',exact:true}).locator('option')).toHaveCount(6);
  }
  if(restricted)await form.getByRole('combobox',{name:'Relationship',exact:true}).selectOption('spans');
  await expect(form.getByRole('button',{name:'Save marker',exact:true})).toBeEnabled();
  await form.getByRole('button',{name:'Save marker',exact:true}).click();
  await expect.poll(()=>saved?.headstoneId).toBe('');
  if(restricted)expect(saved?.relationshipType).toBe('spans');
  await expect(page.getByText('Marker TLC-HS-0600 added.',{exact:true})).toBeVisible();
 });
}
