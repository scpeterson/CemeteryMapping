import {expect,test} from '@playwright/test';
import {fixture,cemeteryId} from './fixtures/cemetery';

test('onboarding stages source, requires reviewed approval and retains a rejected conflict draft',async({page})=>{
 await fixture(page);await page.route('**/api/admin/cemetery-records',r=>r.fulfill({json:{cemeteries:[{id:cemeteryId,name:'Test Cemetery'}],sections:[],lots:[]}}));
 const batch={id:cemeteryId,cemeteryId,kind:'burials',sourceName:'people.csv',sourceSha256:'a'.repeat(64),status:'staged',version:'100',review:{recordCount:1,errorCount:0,rows:[{row:1,errors:[],warnings:[],record:{gravesiteId:'A-1',burial:{firstName:'Alice',lastName:'Example'}}}]}};
 let staged=false,approved=false,attempts=0;
 await page.route('**/import-batches**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path.endsWith('/decision')){attempts++;expect(request.postDataJSON()).toMatchObject({expectedVersion:'100',decision:'approve',reason:'Checked source evidence'});if(attempts===1)return route.fulfill({status:409,json:{error:'Source validation changed. Reload the batch.'}});approved=true;return route.fulfill({json:{...batch,status:'approved',createdRecords:[{id:'new-person'}]}});}
  if(request.method()==='POST'){staged=true;expect(request.postDataJSON()).toMatchObject({kind:'burials',sourceName:'people.csv'});return route.fulfill({status:201,json:batch});}
  return route.fulfill({json:staged?[{...batch,status:approved?'approved':'staged',review:{...batch.review,rows:[]}}]:[]});
 });
 await page.goto('/');await page.getByRole('button',{name:/^Open administration:/}).click();const admin=page.getByRole('dialog',{name:'Admin management'});await admin.getByRole('button',{name:'Onboarding',exact:true}).click();
 await admin.getByRole('combobox',{name:'Source format'}).selectOption('burials');await admin.getByLabel('Source file').setInputFiles({name:'people.csv',mimeType:'text/csv',buffer:Buffer.from('gravesiteId,firstName,lastName\nA-1,Alice,Example')});await admin.getByRole('button',{name:'Stage and validate source'}).click();await expect(admin.getByRole('heading',{name:'Review people.csv'})).toBeVisible();
 const approve=admin.getByRole('button',{name:'Approve import',exact:true});await expect(approve).toBeDisabled();await admin.getByRole('textbox',{name:'Review reason',exact:true}).fill('Checked source evidence');await admin.getByRole('checkbox').check();
 page.once('dialog',d=>d.accept());await approve.click();await expect(admin.getByText('Source validation changed. Reload the batch.')).toBeVisible();await expect(admin.getByRole('textbox',{name:'Review reason',exact:true})).toHaveValue('Checked source evidence');
 page.once('dialog',d=>d.accept());await approve.click();await expect(admin.getByText('1 records imported. Original source retained.')).toBeVisible();await expect(approve).toHaveCount(0);
 await page.setViewportSize({width:320,height:900});expect(await admin.locator('.admin-content').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
