import {expect,test} from '@playwright/test';
import {cemeteryId} from './fixtures/cemetery';
import {marker,overviewGrave} from './fixtures/overview';

test('encrypted device drafts and original photos survive reload; retries keep stable IDs',async({page,context})=>{
  await page.route('**/api/me',route=>route.fulfill({json:{subject:'fixture|field',role:'admin',assignedCemeteryIds:[],displayName:'Field User'}}));
  await page.route('**/api/field-cemeteries**',route=>route.fulfill({json:[{id:cemeteryId,name:'Test Cemetery'}]}));
  await page.route('**/api/field-markers**',route=>route.fulfill({json:[{id:marker.id,code:'HS-OVERVIEW',label:'HS-OVERVIEW'}]}));
  await page.route('**/field-snapshot/**',route=>route.fulfill({json:{cemeteryId,cemeteryName:'Test Cemetery',headstone:{...marker,version:'100'},burials:[{...overviewGrave('A-TEST').burials[0],version:'200'}],lookups:{},nearbyGraves:[],downloadedAt:'2026-11-05T12:00:00Z'}}));
  await page.goto('/field/');await page.getByRole('button',{name:'Connect for downloads and synchronization'}).click();await page.getByRole('button',{name:'Connect to cemetery records'}).click();
  await page.getByLabel('Create offline passphrase').fill('field passphrase');await page.getByRole('button',{name:'Create device workspace'}).click();
  await page.getByRole('combobox',{name:'Marker to download',exact:true}).selectOption(marker.id);await page.getByRole('button',{name:'Download record to this device'}).click();
  await page.getByRole('textbox',{name:'Person notes',exact:true}).fill('Private field notes');await page.getByRole('button',{name:'Save person on this device'}).click();
  await page.getByRole('textbox',{name:'Photo notes',exact:true}).fill('Original photo evidence');await page.getByLabel('Photo',{exact:true}).setInputFiles({name:'field.png',mimeType:'image/png',buffer:Buffer.from('original photo bytes')});await page.getByRole('button',{name:'Save photo on this device'}).click();
  await expect(page.getByRole('status').filter({hasText:'2 saved actions'})).toBeVisible();
  const persisted=await page.evaluate(async()=>new Promise<string>((resolve,reject)=>{const r=indexedDB.open('cemetery-field-v1');r.onsuccess=()=>{const t=r.result.transaction(['vaults','files']);const values:unknown[]=[];for(const name of ['vaults','files']){const q=t.objectStore(name).getAll();q.onsuccess=()=>values.push(q.result);}t.oncomplete=()=>resolve(JSON.stringify(values));};r.onerror=()=>reject(r.error);}));
  expect(persisted).not.toContain('Private field notes');expect(persisted).not.toContain('fixture|field');expect(persisted).not.toContain('field.png');
  await page.reload();await page.getByRole('combobox',{name:'Saved workspace'}).selectOption({index:1});await page.getByRole('textbox',{name:'Offline passphrase',exact:true}).fill('incorrect passphrase');await page.getByRole('button',{name:'Unlock saved work'}).click();await expect(page.getByText('Unable to unlock this workspace. Check the offline passphrase.')).toBeVisible();
  await page.getByRole('textbox',{name:'Offline passphrase',exact:true}).fill('field passphrase');await page.getByRole('button',{name:'Unlock saved work'}).click();await expect(page.getByRole('textbox',{name:'Person notes',exact:true})).toHaveValue('Private field notes');await expect(page.getByText('field.png',{exact:true})).toBeVisible();
  await context.setOffline(true);await expect(page.getByText('Offline — use your downloaded records')).toBeVisible();await context.setOffline(false);
  let lost=true;const ids:string[]=[];
  await page.route('**/api/field-sync',route=>{ids.push(route.request().postDataJSON().id);if(lost){lost=false;return route.abort();}return route.fulfill({json:{received:true,replayed:true}});});
  const photoIds:string[]=[];
  await page.route('**/api/headstones/*/media-assets**',route=>{photoIds.push(new URL(route.request().url()).searchParams.get('operationId')!);return route.fulfill({json:{id:'photo'}});});
  await page.getByRole('button',{name:'Connect for downloads and synchronization'}).click();await page.getByRole('button',{name:'Connect to cemetery records'}).click();await page.getByRole('button',{name:'Synchronize saved work'}).click();await expect(page.getByText('Needs retry',{exact:false}).first()).toBeVisible();await page.getByRole('button',{name:'Synchronize saved work'}).click();await expect(page.getByText('Saved changes and photos are synchronized. Downloaded records were refreshed.')).toBeVisible();
  expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);expect(photoIds).toHaveLength(1);
  await page.setViewportSize({width:320,height:900});expect(await page.locator('main').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});


test('prepared built field page reloads completely offline without caching private URLs',async({page,context})=>{
  test.skip(process.env.FIELD_BUILD!=="1","Requires built immutable assets and service worker manifest");
  await page.goto('/field/');
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.register('/field-sw.js',{scope:'/field'});
    await navigator.serviceWorker.ready;
    if(!registration.active)throw new Error('Field shell did not activate');
  });
  await page.reload();
  await expect(page.getByRole('heading',{name:'Field collection',exact:true})).toBeVisible();
  const cached=await page.evaluate(async()=>{const paths:string[]=[];for(const name of await caches.keys())for(const request of await(await caches.open(name)).keys())paths.push(new URL(request.url).pathname);return paths;});
  expect(cached).toContain('/field/');expect(cached.every(path=>path==='/field/'||path==='/__field_shell_version'||path.startsWith('/assets/'))).toBe(true);
  await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Field collection',exact:true})).toBeVisible();await expect(page.getByText('Offline — use your downloaded records')).toBeVisible();
});

test('vault rejects competing tabs and identity changes; conflict merge preserves unrelated server fields',async({page})=>{
  test.skip(process.env.FIELD_BUILD==='1','Uses source modules on the development test server');
  await page.goto('/field/');
  const results=await page.evaluate(async()=>{
    const vaultPath='/src/lib/offlineVault.ts',mergePath='/src/lib/fieldConflictChanges.ts';
    const vault:typeof import('../src/lib/offlineVault')=await import(vaultPath);
    const merge:typeof import('../src/lib/fieldConflictChanges')=await import(mergePath);
    const document:import('../src/lib/offlineFieldTypes').OfflineWorkspace={format:1,id:crypto.randomUUID(),ownerSubject:'private|owner',cemeteryId:'cemetery',cemeteryName:'Fixture',records:[],operations:[],photos:[],savedAt:new Date().toISOString()};
    const first=await vault.createOfflineVault(document,'vault passphrase');const second=await vault.unlockOfflineVault(document.id,'vault passphrase');
    const next=await vault.saveOfflineVault(first,document,{id:'photo',file:new File(['original bytes'],'original.png',{type:'image/png'})});
    let tabConflict=false,identityConflict=false;
    try{await vault.saveOfflineVault(second.handle,document);}catch{tabConflict=true;}
    try{await vault.saveOfflineVault(next,{...document,ownerSubject:'another|person'});}catch{identityConflict=true;}
    const photo=await vault.readOfflinePhoto(next,'photo','original.png','image/png');
    await vault.deleteOfflineVault(document.id);
    const current={firstName:'Server',notes:'Server evidence',expectedVersion:'2'};
    const changes=merge.fieldChanges({firstName:'Before',notes:'Old evidence',expectedVersion:'1'},{firstName:'Device',notes:'Old evidence',expectedVersion:'1'},current);
    return {tabConflict,identityConflict,bytes:await photo.text(),defaultMerge:merge.applyFieldChanges(current,changes,new Set()),chosenMerge:merge.applyFieldChanges(current,changes,new Set([0]))};
  });
  expect(results.tabConflict).toBe(true);expect(results.identityConflict).toBe(true);expect(results.bytes).toBe('original bytes');expect(results.defaultMerge.firstName).toBe('Server');expect(results.chosenMerge.firstName).toBe('Device');expect(results.chosenMerge.notes).toBe('Server evidence');expect(results.chosenMerge.expectedVersion).toBe('2');
});
