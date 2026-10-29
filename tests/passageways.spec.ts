import {test,expect} from '@playwright/test';
import {fixture,cemeteryId,geometry,summaries,detail,gravePath,select} from './fixtures/cemetery';

for(const width of [1280,390])test(`assign a passageway and record an individual gravesite deed at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await fixture(page);
 const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const lots=[{uuid,id:'P03',section:'D',name:'D-P03',cemeteryId,areaType:'passageway',geometry}];
 await page.route('**/api/cemetery-map',route=>route.fulfill({json:{sections:[],lots,graves:summaries,headstones:[]}}));
 let assigned=false;
 await page.route(gravePath('B-TEST'),route=>route.fulfill({json:{...detail('B-TEST'),section:'D',lot:assigned?'P03':'',lotAreaType:assigned?'passageway':'lot'}}));
 await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/B-TEST/lot`,route=>{
  expect(route.request().postDataJSON()).toMatchObject({lotUuid:uuid,lotId:'P03'});assigned=true;
  return route.fulfill({json:{id:'B-TEST',lotId:'P03',section:'D',areaType:'passageway'}});
 });
 await page.route('**/deed-registry-suggestions**',route=>route.fulfill({json:[]}));
 let saved:Record<string,unknown>|undefined;
 await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/B-TEST/ownership-events`,route=>{
  saved=route.request().postDataJSON();return route.fulfill({json:{id:'fixture-event'}});
 });
 await page.goto('/');if(width===390)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
 await select(page,'B-TEST');await page.getByRole('tab',{name:'Location and geometry',exact:true}).click();
 await page.getByRole('combobox',{name:'Assigned lot or passageway',exact:true}).selectOption(uuid);
 await page.getByRole('button',{name:'Save lot assignment',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save lot assignment',exact:true})).toBeDisabled();
 await page.getByRole('tab',{name:'People and ownership',exact:true}).click();
 await page.getByRole('button',{name:'Record deed or transfer',exact:true}).click();
 const form=page.getByRole('form',{name:'Record ownership',exact:true});
 await expect(form.getByRole('combobox',{name:'Applies to',exact:true})).toHaveValue('selected_gravesite');
 await expect(form.locator('option[value="selected_lot"]')).toHaveAttribute('disabled','');
 await expect(form).toContainText('passageway D-P03');
 await form.getByLabel('First name',{exact:true}).fill('Fixture');await form.getByLabel('Last name',{exact:true}).fill('Owner');
 await form.getByRole('button',{name:'Record ownership',exact:true}).click();
 await expect.poll(()=>saved?.targetScope).toBe('selected_gravesite');
 expect(saved?.eventType).toBe('deed');
});
