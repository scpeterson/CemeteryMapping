import {test,expect} from '@playwright/test';
import {fixture,cemeteryId,detail,gravePath,select} from './fixtures/cemetery';

const eventId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const party={firstName:'Jane',lastName:'Example',fullAddress:'123 Test St',municipality:'Test City',state:'PA',zip:'15000',shareNumerator:'1',shareDenominator:'2'};
for(const width of [1280,390]){
 test(`full ownership editor loads the deed and all graves, retaining corrections after a failed save at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await fixture(page);
  const owner={id:'ownership-party-jane',ownershipEventId:`ownership-event-${eventId}`,displayName:'Jane Example',...party,deedOnFile:true,deedRegisterOnFile:false,effectiveDate:'2001'};
  let updated=false;
  await page.route(gravePath('A-TEST'),route=>route.fulfill({json:{...detail('A-TEST'),owners:updated?[]:[owner],currentOwnerIds:updated?[]:[owner.id]}}));
  await page.route(`**/api/ownership-events/${eventId}`,route=>route.fulfill({json:{owners:[party,{...party,firstName:'John'}],previousOwners:[],eventType:'deed',targetScope:'listed_gravesites',targetGravesiteIds:['A-TEST'],effectiveDate:'2001',deedOnFile:true,deedRegisterOnFile:false,documentReference:'Book 1',notes:'Original',expectedRevision:'a'.repeat(64)}}));
  const requests:Record<string,unknown>[]=[];
  await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/A-TEST/ownership-events/${eventId}`,route=>{
   expect(route.request().method()).toBe('PATCH');requests.push(route.request().postDataJSON());
   if(requests.length===1)return route.fulfill({status:409,json:{error:'Ownership could not be saved. Please retry.'}});
   updated=true;return route.fulfill({json:{id:eventId}});
  });
  await page.goto('/');if(width===390)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
  await select(page,'A-TEST');await page.getByRole('tab',{name:'People and ownership'}).click();
  await page.getByRole('button',{name:'Edit ownership',exact:true}).click();
  const form=page.getByRole('form',{name:'Edit ownership',exact:true});
  await expect(form.getByLabel('Document reference',{exact:true})).toHaveValue('Book 1');
  await expect(form.getByLabel('First name',{exact:true})).toHaveCount(2);
  await form.getByLabel('First name',{exact:true}).first().fill('Janet');
  page.once('dialog',dialog=>dialog.dismiss());
  await form.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(form).toBeVisible();
  await expect(form.getByLabel('First name',{exact:true}).first()).toHaveValue('Janet');
  await form.getByLabel('Document reference',{exact:true}).fill('Book 2');
  await form.locator('.ownership-gravesite-options label').filter({hasText:'A-TEST'}).getByRole('checkbox').uncheck();
  await form.locator('.ownership-gravesite-options label').filter({hasText:'B-TEST'}).getByRole('checkbox').check();
  await form.getByRole('button',{name:'Save ownership',exact:true}).click();
  await expect(form.getByRole('alert')).toContainText('Please retry');
  await expect(form.getByLabel('First name',{exact:true}).first()).toHaveValue('Janet');
  await expect(form.locator('.ownership-gravesite-options label').filter({hasText:'B-TEST'}).getByRole('checkbox')).toBeChecked();
  await form.getByRole('button',{name:'Save ownership',exact:true}).click();
  await expect(page.locator('.owner-list')).toContainText('No current ownership');
  expect(requests[1]).toMatchObject({editingEventId:eventId,expectedRevision:'a'.repeat(64),documentReference:'Book 2',targetGravesiteIds:['B-TEST']});
  expect((requests[1].owners as typeof party[])[0].firstName).toBe('Janet');
 });
}
