import {test,expect} from '@playwright/test';
import type {GeoJSONSource} from 'maplibre-gl';
import type {FeatureCollection} from 'geojson';
import {fixture,cemeteryId,geometry,summaries,detail,gravePath,select} from './fixtures/cemetery';

const statuses = (page: import('@playwright/test').Page) => page.evaluate(async()=>{
 const data=await (window.mapHighlightTest.map.getSource('graves') as GeoJSONSource).getData() as FeatureCollection;
 return Object.fromEntries(data.features.map(f=>[f.properties!.id,f.properties!.status]));
});

for(const width of [390,1280]) test(`deed save refreshes all lot statuses without reloading or moving the map at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await fixture(page);
 let saved=false,attempts=0,mapReads=0;
 const graves=[...summaries.map(g=>({...g,lot:'1'})),{...summaries[0],id:'C-TEST',space:'C',lot:'1',status:'occupied'},{...summaries[0],id:'D-TEST',space:'D',lot:'2'}];
 await page.route('**/api/cemetery-map',route=>{
  mapReads++;
  return route.fulfill({json:{boundaries:[{type:'Feature',properties:{name:'Test Cemetery'},geometry}],sections:[],lots:[],headstones:[],graves:graves.map(g=>({...g,status:saved&&['A-TEST','B-TEST'].includes(g.id)?'sold':g.status}))}});
 });
 await page.route(gravePath('A-TEST'),route=>route.fulfill({json:{...detail('A-TEST'),lot:'1',status:saved?'sold':'available'}}));
 await page.route(`**/api/cemeteries/${cemeteryId}/grave-spaces/A-TEST/ownership-events`,route=>{
  expect(route.request().postDataJSON()).toMatchObject({eventType:'deed',targetScope:'selected_lot'});
  if(++attempts===1)return route.fulfill({status:400,json:{error:'Save failed; please retry.'}});
  saved=true;return route.fulfill({json:{id:'fixture-deed'}});
 });
 await page.goto('/tests/map-highlighting.html');
 await expect.poll(()=>page.evaluate(()=>Boolean(window.mapHighlightTest?.map.getSource('graves')))).toBe(true);
 await page.getByRole('combobox',{name:'Cemetery',exact:true}).selectOption(cemeteryId);
 if(width===390)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
 await page.getByRole('combobox',{name:'Show one status',exact:true}).selectOption('available');
 await select(page,'A-TEST');await page.getByRole('tab',{name:'People and ownership',exact:true}).click();
 await page.getByRole('button',{name:'Record deed or transfer',exact:true}).click();
 const form=page.getByRole('form',{name:'Record ownership',exact:true});
 await expect(form.getByRole('combobox',{name:'Applies to',exact:true})).toHaveValue('selected_lot');
 await form.getByLabel('First name',{exact:true}).fill('Example');await form.getByLabel('Last name',{exact:true}).fill('Owner');
 const map=await page.evaluateHandle(()=>window.mapHighlightTest.map);
 const viewport=await page.evaluate(()=>{const map=window.mapHighlightTest.map;map.stop();map.jumpTo({center:[-80.0001,40.0001],zoom:18.7});return {center:map.getCenter().toArray(),zoom:map.getZoom()};});
 let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame())navigations++;});
 await form.getByRole('button',{name:'Record ownership',exact:true}).click();
 await expect(form.getByRole('alert')).toContainText('Save failed');expect(mapReads).toBe(1);
 expect(await statuses(page)).toMatchObject({'A-TEST':'available','B-TEST':'available','C-TEST':'occupied','D-TEST':'available'});
 await form.getByRole('button',{name:'Record ownership',exact:true}).click();
 await expect.poll(()=>statuses(page)).toEqual({'A-TEST':'sold','B-TEST':'sold','C-TEST':'occupied','D-TEST':'available'});
 expect(mapReads).toBe(2);expect(navigations).toBe(0);
 expect(await page.evaluate(map=>map===window.mapHighlightTest.map,map)).toBe(true);
 await expect.poll(()=>page.evaluate(()=>({center:window.mapHighlightTest.map.getCenter().toArray(),zoom:window.mapHighlightTest.map.getZoom()}))).toEqual(viewport);
 await expect(page.getByRole('combobox',{name:'Cemetery',exact:true})).toHaveValue(cemeteryId);
 await expect(page.locator('.detail-panel')).toContainText('Record ID: A-TEST');
 if(width===390)await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Show one status',exact:true})).toHaveValue('available');
});

test('removing a deed connection refreshes its grave while preserving other ownership statuses',async({page})=>{
 await fixture(page);let removed=false,mapReads=0;
 await page.route('**/api/cemetery-map',route=>{mapReads++;return route.fulfill({json:{sections:[],lots:[],headstones:[],graves:summaries.map(g=>({...g,status:removed&&g.id==='A-TEST'?'available':'sold'}))}});});
 const owner={id:'party-1',ownershipEventId:'ownership-event-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',ownershipEventRightId:'right-1',ownershipTargetType:'gravesite',displayName:'Example Owner',firstName:'Example',lastName:'Owner',fullAddress:'',municipality:'',state:'',zip:'',deedOnFile:true,deedRegisterOnFile:false};
 await page.route(gravePath('A-TEST'),route=>route.fulfill({json:{...detail('A-TEST'),owners:removed?[]:[owner],currentOwnerIds:removed?[]:[owner.id]}}));
 await page.route('**/api/ownership-event-rights/right-1',route=>{expect(route.request().method()).toBe('DELETE');removed=true;return route.fulfill({json:{id:'right-1'}});});
 await page.goto('/tests/map-highlighting.html');await select(page,'A-TEST');
 await page.getByRole('tab',{name:'People and ownership',exact:true}).click();
 await page.locator('.owner-list').getByRole('button',{name:'Remove',exact:true}).click();
 await page.getByRole('button',{name:'Remove connection',exact:true}).click();
 await expect.poll(()=>statuses(page)).toEqual({'A-TEST':'available','B-TEST':'sold'});
 expect(mapReads).toBe(2);await expect(page.locator('.owner-list')).toContainText('No current ownership');
});
