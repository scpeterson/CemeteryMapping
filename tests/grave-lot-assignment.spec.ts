import {test,expect} from '@playwright/test';
import {fixture,cemeteryId,geometry,summaries,detail,gravePath,select} from './fixtures/cemetery';

for(const width of [1280,390]){
 test(`lot picker distinguishes A-8 from B-8 and preserves selection on failure at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await fixture(page);
  const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',full='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const lots=[{uuid:a,id:'8',section:'A',burialUseStatus:'non_burial'},{uuid:b,id:'8',section:'B',burialUseStatus:'standard'},{uuid:full,id:'7',section:'B',burialUseStatus:'standard'}].map(lot=>({...lot,cemeteryId,name:`${lot.section}-8`,geometry}));
  await page.route('**/api/cemetery-map',route=>route.fulfill({json:{boundaries:[{type:'Feature',properties:{name:'Test Cemetery'},geometry}],sections:[],lots,graves:summaries,headstones:[]}}));
  let assigned='';
  await page.route(gravePath('B-TEST'),route=>route.fulfill({json:{...detail('B-TEST'),section:'B',lot:assigned}}));
  const requests:Record<string,unknown>[]=[];
  await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/B-TEST/lot`,route=>{
   const body=route.request().postDataJSON();requests.push(body);
   if(body.lotUuid===a)return route.fulfill({status:409,json:{error:'Lot A-8 cannot contain gravesites or markers.'}});
   if(body.lotUuid===full)return route.fulfill({status:409,json:{error:'Lot B-7 already has the maximum of five active gravesites. Review its existing assignments before adding another.'}});
   assigned=body.lotId;return route.fulfill({json:{id:'B-TEST',lotId:assigned,section:'B'}});
  });
  await page.goto('/');if(width===390)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
  await select(page,'B-TEST');await page.getByRole('tab',{name:'Location and geometry',exact:true}).click();
  const picker=page.getByRole('combobox',{name:'Assigned lot',exact:true});
  await picker.selectOption({label:'B-8'});await page.getByRole('button',{name:'Save lot assignment',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save lot assignment',exact:true})).toBeDisabled();
  expect(requests[0]).toMatchObject({lotId:'8',lotUuid:b});await expect(picker).toHaveValue(b);
  await picker.selectOption({label:'A-8'});await page.getByRole('button',{name:'Save lot assignment',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Lot A-8 cannot contain gravesites or markers.');
  expect(requests[1]).toMatchObject({lotId:'8',lotUuid:a});await expect(picker).toHaveValue(a);
  await picker.selectOption({label:'B-7'});await page.getByRole('button',{name:'Save lot assignment',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Lot B-7 already has the maximum of five active gravesites.');
  await expect(picker).toHaveValue(full);expect(requests[2]).toMatchObject({lotId:'7',lotUuid:full});
  await expect(page.getByRole('button',{name:'Save lot assignment',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Unlink from lot 8',exact:true}).click();
  await page.getByRole('button',{name:'Confirm unlink',exact:true}).click();
  await expect(picker).toHaveValue('');expect(requests[3].lotId).toBe('');expect(requests[3].lotUuid).toBeUndefined();
 });
}
