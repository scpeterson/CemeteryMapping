import {expect,test} from '@playwright/test';
import {cemeteryId} from './fixtures/cemetery';

test('export page downloads only explicit scoped selections and retains filters on size errors',async({page})=>{
 await page.route('**/api/export-cemeteries?**',route=>route.fulfill({json:[{id:cemeteryId,name:'Test Cemetery',canExportOwnership:false,canExportMaintenance:false}]}));
 let attempts=0;
 await page.route('**/export?**',route=>{attempts++;const url=new URL(route.request().url());expect(url.pathname).toBe(`/api/cemeteries/${cemeteryId}/export`);expect(url.searchParams.get('dataset')).toBe('gravesites');if(attempts===1)return route.fulfill({status:400,json:{error:'More than 5000 records match. Narrow the search; no partial export was downloaded.'}});expect(url.searchParams.get('q')).toBe('A-1');return route.fulfill({body:'{"type":"FeatureCollection","features":[]}',headers:{'Content-Type':'application/geo+json','X-Record-Count':'0'}});});
 await page.goto('/exports/');await expect(page.getByRole('combobox',{name:'Export cemetery',exact:true})).toHaveValue(cemeteryId);await expect(page.getByRole('combobox',{name:'Records to export'}).locator('option[value="ownership"]')).toHaveCount(0);await page.getByRole('button',{name:'Download records'}).click();await expect(page.getByText('More than 5000 records match. Narrow the search; no partial export was downloaded.')).toBeVisible();
 await page.getByRole('searchbox',{name:'Search within records'}).fill('A-1');await page.getByRole('combobox',{name:'File format'}).selectOption('geojson');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download records'}).click();expect((await download).suggestedFilename()).toBe('cemetery-gravesites.geojson');await expect(page.getByText('Downloaded 0 records from Test Cemetery.')).toBeVisible();await expect(page.getByRole('searchbox',{name:'Search within records'})).toHaveValue('A-1');
 await page.setViewportSize({width:320,height:900});expect(await page.locator('main').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});

test('private ownership exports require a separate explicit confirmation',async({page})=>{
 await page.route('**/api/export-cemeteries?**',route=>route.fulfill({json:[{id:cemeteryId,name:'Test Cemetery',canExportOwnership:true,canExportMaintenance:true}]}));let requests=0;
 await page.route('**/export?**',route=>{requests++;return route.fulfill({body:'"party_name"\r\n"Private owner"',headers:{'Content-Type':'text/csv','X-Record-Count':'1'}});});
 await page.goto('/exports/');await page.getByRole('combobox',{name:'Records to export'}).selectOption('ownership');await expect(page.getByRole('combobox',{name:'File format'}).locator('option[value="geojson"]')).toHaveCount(0);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Download records'}).click();expect(requests).toBe(0);
 page.once('dialog',d=>d.accept());const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download records'}).click();await download;expect(requests).toBe(1);
});
