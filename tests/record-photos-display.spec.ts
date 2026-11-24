import { test, expect } from '@playwright/test';
import { marker } from './fixtures/overview';
import { setup, openRecord, draftPhoto, showCorrectionControls, inspectionStep } from './fixtures/recordPhotos';

for(const phone of [false,true]){
 test(`keyboard help preference persists across inspections and reloads (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const help=current.locator('.inspection-keyboard-help');
  const hint=current.locator('.inspection-keyboard-hint');
  const toggle=current.getByText('Keyboard shortcuts',{exact:true});
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await condition.selectOption('');
   await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true}).click();
   await showCorrectionControls(page);
  };
  const save=async()=>{
   await condition.selectOption(marker.condition.id);
   await current.getByRole('button',{name:'Return to review',exact:true}).click();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await begin();await expect(hint).not.toBeVisible();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained preference draft');
  await toggle.click();await expect(hint).toBeVisible();
  await save();expect(state.getInspections()[2].source).toBe('Retained preference draft');
  await begin();await expect(hint).toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(hint).toBeVisible();
  await toggle.click();await expect(help).not.toHaveAttribute('open');
  await save();await begin();await expect(hint).not.toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(hint).not.toBeVisible();
  await toggle.click();await expect(hint).toBeVisible();
 });
}

test('keyboard help remains usable when browser preference storage is unavailable',async({page})=>{
 await page.addInitScript(()=>{
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
  Storage.prototype.getItem=function(key){if(['cemetery-mapping:inspection-keyboard-help-open','cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open'].includes(key))throw new DOMException('Unavailable','SecurityError');return get.call(this,key);};
  Storage.prototype.setItem=function(key,value){if(['cemetery-mapping:inspection-keyboard-help-open','cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open'].includes(key))throw new DOMException('Unavailable','QuotaExceededError');set.call(this,key,value);};
 });
 await setup(page);
 const region=page.getByRole('region',{name:'Inspections',exact:true});
 await region.getByRole('button',{name:'New inspection',exact:true}).click();
 await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
 await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true}).click();
 const current=region.getByRole('region',{name:'Current required item',exact:true});
 const toggle=current.getByText('Keyboard shortcuts',{exact:true});
 const hint=current.locator('.inspection-keyboard-hint');
 await toggle.click();await expect(hint).toBeVisible();
 await current.getByRole('button',{name:'Return to review',exact:true}).click();
 await region.getByRole('region',{name:'Required information',exact:true}).getByRole('button',{name:'Choose condition',exact:true}).click();
 await showCorrectionControls(page);await expect(hint).toBeVisible();
 await toggle.click();await expect(hint).not.toBeVisible();
 await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
 await expect(current.getByRole('list',{name:'Remaining required items'})).not.toBeVisible();
 await showCorrectionControls(page);
 await expect(current.getByRole('list',{name:'Remaining required items'})).toBeVisible();
 await toggle.click();await expect(hint).toBeVisible();
 await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
 await region.getByRole('button',{name:'Reset display preferences',exact:true}).click();
 await expect(current.getByRole('list',{name:'Remaining required items'})).toBeVisible();
 await expect(hint).not.toBeVisible();
 const resetHelp=region.locator('.inspection-reset-keyboard-help');
 await resetHelp.getByText('Keyboard shortcuts',{exact:true}).click();
 await expect(resetHelp.locator('ul')).toBeVisible();
 await page.keyboard.press('Escape');
 await region.getByRole('button',{name:'Reset display preferences',exact:true}).click();
 await expect(resetHelp.locator('ul')).not.toBeVisible();
 const restored=region.locator('.inspection-restored-defaults-list');
 await restored.getByText(/^Restored defaults \(\d+\)$/).click();await expect(restored.locator('ul')).toBeVisible();
 await page.keyboard.press('Escape');
 await region.getByRole('button',{name:'Reset display preferences',exact:true}).click();
 await expect(restored.locator('ul')).not.toBeVisible();
});

for(const phone of [false,true]){
 test(`remaining-items preference persists without overriding phone correction collapse (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const list=current.getByRole('list',{name:'Remaining required items',exact:true});
  const condition=region.getByRole('combobox',{name:'Monument condition',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await condition.selectOption('');
   await inspectionStep(page,'Review & save');
   await region.getByRole('button',{name:'Edit visit & condition',exact:true}).click();
  };
  const save=async()=>{
   await condition.selectOption(marker.condition.id);
   await region.getByRole('button',{name:'Return to review',exact:true}).click();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await begin();await expect(list).toBeVisible();
  await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
  await expect(list).not.toBeVisible();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained remaining-items draft');
  await save();expect(state.getInspections()[2].source).toBe('Retained remaining-items draft');
  await begin();await expect(list).not.toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(list).not.toBeVisible();
  await current.getByRole('button',{name:'Show remaining items',exact:true}).click();
  await expect(list).toBeVisible();
  await current.getByRole('button',{name:'Next missing item',exact:true}).click();
  await expect(condition).toBeFocused();
  if(phone)await expect(list).not.toBeVisible();else await expect(list).toBeVisible();
  await save();await begin();await expect(list).toBeVisible();
  await save();await openRecord(page,true);
  await begin();await expect(list).toBeVisible();
  await region.getByRole('navigation',{name:'Inspection steps'}).getByRole('button',{name:'1. Visit & condition',exact:true}).click();
  await expect(condition).toBeFocused();
  if(phone)await expect(list).not.toBeVisible();else await expect(list).toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`reset display preferences preserves the inspection draft (${phone?'phone':'desktop'})`,async({page},testInfo)=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const originals=structuredClone(state.getInspections());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  const list=current.getByRole('list',{name:'Remaining required items',exact:true});
  const hint=current.locator('.inspection-keyboard-hint');
  const face=(n:number)=>region.getByRole('group',{name:`Inspection face ${n}`,exact:true});
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained reset source');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Faces & photos');
  await face(1).getByRole('textbox',{name:'Face inscription',exact:true}).fill('Retained reset reading');
  await face(1).getByLabel('Choose photos to upload',{exact:true}).setInputFiles(draftPhoto('reset-retained.png'));
  await face(1).getByRole('textbox',{name:'Notes',exact:true}).fill('Retained reset photo note');
  await region.getByRole('button',{name:'Select face 2: Back',exact:true}).click();
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('');
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Label face 2',exact:true}).click();
  await showCorrectionControls(page);
  await current.getByText('Keyboard shortcuts',{exact:true}).click();await expect(hint).toBeVisible();
  await current.getByRole('button',{name:'Hide remaining items',exact:true}).click();
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  await expect(reset).toHaveCount(1);
  const stickyReset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  await expect(current.getByRole('button',{name:'Reset display preferences',exact:true})).toHaveCount(0);
  const scrollPanel=page.locator('.detail-panel');
  const beforeScroll=await scrollPanel.evaluate(el=>el.scrollTop);
  await scrollPanel.evaluate(el=>{el.scrollTop-=120;});
  await expect.poll(()=>scrollPanel.evaluate(el=>el.scrollTop)).toBeLessThan(beforeScroll-80);
  await expect(stickyReset).toBeVisible();
  await page.clock.install();
  await reset.focus();await page.keyboard.press('Enter');
  await expect(reset).toBeFocused();await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await expect(region.getByRole('status').filter({hasText:'Display defaults restored:'})).toBeVisible();
  await expect(stickyReset).toBeVisible();
  const confirmation=region.getByRole('status').filter({hasText:'Display defaults restored:'});
  const restoredList=region.locator('.inspection-restored-defaults-list ul');
  const restoredToggle=region.getByText(/^Restored defaults \(\d+\)$/);
  await expect(restoredList).not.toBeVisible();
  await restoredToggle.focus();await page.keyboard.press('Enter');
  await expect(restoredToggle).toBeFocused();await expect(restoredList).toBeVisible();
  await expect(restoredList.getByRole('listitem')).toHaveText(['Remaining items: shown','Inspection keyboard hint: hidden','Reset confirmation keyboard hint: hidden','Restored-defaults list: hidden']);
  await expect(restoredToggle).toHaveText(`Restored defaults (${await restoredList.getByRole('listitem').count()})`);
  await page.keyboard.press('Space');await expect(restoredList).not.toBeVisible();
  await expect(restoredToggle).toBeFocused();await expect(confirmation).toBeVisible();
  const escapeHint=region.locator('.inspection-reset-escape-hint');
  await expect(escapeHint).not.toBeVisible();
  const confirmationHelp=region.locator('.inspection-reset-keyboard-help').getByText('Keyboard shortcuts',{exact:true});
  await confirmationHelp.focus();await page.keyboard.press('Enter');
  await expect(confirmationHelp).toBeFocused();await expect(escapeHint).toBeVisible();
  await expect(escapeHint.getByRole('listitem')).toHaveCount(3);
  if(phone)await page.screenshot({path:testInfo.outputPath('inspection-reset-shortcuts-phone.png')});
  await page.keyboard.press('Space');await expect(escapeHint).not.toBeVisible();await expect(confirmationHelp).toBeFocused();
  await expect(confirmation).toBeVisible();
  await confirmationHelp.click();await expect(escapeHint).toBeVisible();
  await page.clock.runFor(3000);await expect(confirmation).toBeVisible();
  await reset.click();
  await page.clock.runFor(1500);await expect(confirmation).toBeVisible();
  await page.clock.runFor(2500);await expect(confirmation).toHaveCount(0);
  await expect(reset).toBeFocused();await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await reset.click();
  const dismiss=region.getByRole('button',{name:'Dismiss display preferences confirmation',exact:true});
  await expect(restoredList).not.toBeVisible();
  await restoredToggle.click();await expect(restoredList).toBeVisible();
  await expect(escapeHint).not.toBeVisible();
  await expect(dismiss).toHaveAccessibleDescription('Tab/Shift+Tab Next/previous control Enter/Space Activate Dismiss Escape Dismiss and return to Reset display preferences');
  await page.keyboard.press('Escape');
  await expect(escapeHint).toHaveCount(0);
  await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await reset.click();await expect(restoredList).not.toBeVisible();
  await dismiss.focus();await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await reset.click();await dismiss.focus();await page.keyboard.press('Enter');
  await expect(confirmation).toHaveCount(0);await expect(dismiss).toHaveCount(0);
  await expect(reset).toBeFocused();await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
  await page.clock.runFor(4500);await expect(reset).toBeFocused();
  expect(dialogs).toBe(0);expect(state.getInspections()).toEqual(originals);expect(state.uploads).toHaveLength(0);
  await face(2).getByRole('textbox',{name:'Face label',exact:true}).fill('Reverse');
  await page.keyboard.press('Escape');await expect(face(2).getByRole('textbox',{name:'Face label',exact:true})).toBeFocused();
  await reset.click();await expect(escapeHint).not.toBeVisible();
  await confirmationHelp.click();await expect(escapeHint).toBeVisible();
  await restoredToggle.click();await expect(restoredList).toBeVisible();
  await current.getByRole('button',{name:'Return to review',exact:true}).click();
  await expect(escapeHint).toBeVisible();
  await expect(restoredList).toBeVisible();
  await reset.click();await expect(reset).toBeFocused();
  await expect(restoredList).not.toBeVisible();
  await expect(escapeHint).not.toBeVisible();
  await confirmationHelp.focus();await page.keyboard.press('Enter');await expect(escapeHint).toBeVisible();
  await page.keyboard.press('Escape');await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await reset.click();await expect(confirmation).toBeVisible();await expect(escapeHint).not.toBeVisible();
  await expect(restoredList).not.toBeVisible();
  await confirmationHelp.focus();await page.keyboard.press('Space');await expect(escapeHint).toBeVisible();
  await page.keyboard.press('Space');await expect(escapeHint).not.toBeVisible();
  await dismiss.click();
  await expect(confirmation).toHaveCount(0);await expect(reset).toBeFocused();
  await reset.click();await expect(escapeHint).not.toBeVisible();
  await page.clock.runFor(4000);await expect(confirmation).toHaveCount(0);
  await expect(region.getByText('Retained reset source',{exact:true})).toBeVisible();
  await expect(region.getByRole('paragraph').filter({hasText:/^Retained reset reading$/})).toBeVisible();
  await expect(region.getByRole('region',{name:'Photos for Front',exact:true})).toContainText('Retained reset photo note');
  await region.getByRole('button',{name:'Save inspection',exact:true}).click();
  await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  expect(state.getInspections()[2].source).toBe('Retained reset source');
  expect(state.getInspections()[2].faces[0].inscription).toBe('Retained reset reading');
  expect(state.uploads).toHaveLength(1);expect(dialogs).toBe(0);
  await openRecord(page,true);
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Edit visit & condition',exact:true}).click();
  await expect(list).toBeVisible();await expect(hint).not.toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`reset restores confirmation-hint defaults across inspections and reloads (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const hint=region.locator('.inspection-reset-escape-hint');
  const help=region.locator('.inspection-reset-keyboard-help').getByText('Keyboard shortcuts',{exact:true});
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  const dismiss=region.getByRole('button',{name:'Dismiss display preferences confirmation',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
   await inspectionStep(page,'Review & save');
   await reset.click();
  };
  const save=async()=>{
   await dismiss.click();await expect(reset).toBeFocused();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained reset-help preference draft');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Review & save');await reset.click();
  await expect(hint).not.toBeVisible();await help.click();await expect(hint).toBeVisible();
  await save();expect(state.getInspections()[2].source).toBe('Retained reset-help preference draft');
  await begin();await expect(hint).not.toBeVisible();await save();
  await openRecord(page,true);
  await begin();await expect(hint).not.toBeVisible();
  await help.click();await expect(hint).toBeVisible();
  await reset.click();await expect(hint).not.toBeVisible();await save();
  await begin();await expect(hint).not.toBeVisible();await save();
  await openRecord(page,true);
  await begin();await expect(hint).not.toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`reset restores list visibility defaults across inspections and reloads (${phone?'phone':'desktop'})`,async({page})=>{
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  const restored=region.locator('.inspection-restored-defaults-list ul');
  const toggle=region.getByText(/^Restored defaults \(\d+\)$/);
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  const begin=async()=>{
   await region.getByRole('button',{name:'New inspection',exact:true}).click();
   await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
   await inspectionStep(page,'Review & save');await reset.click();
  };
  const save=async()=>{
   await region.getByRole('button',{name:'Dismiss display preferences confirmation',exact:true}).click();
   await region.getByRole('button',{name:'Save inspection',exact:true}).click();
   await expect(region.getByRole('button',{name:'New inspection',exact:true})).toBeVisible();
  };
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Retained restored-defaults draft');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Review & save');await reset.click();
  await expect(restored).not.toBeVisible();await toggle.click();await expect(restored).toBeVisible();
  await save();expect(state.getInspections()[2].source).toBe('Retained restored-defaults draft');
  await begin();await expect(restored).not.toBeVisible();await save();
  await openRecord(page,true);await begin();await expect(restored).not.toBeVisible();
  await toggle.click();await expect(restored).toBeVisible();
  await reset.click();await expect(restored).not.toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('cemetery-mapping:inspection-restored-defaults-open'))).toBe('false');
  await save();
  await begin();await expect(restored).not.toBeVisible();await save();
  await openRecord(page,true);await begin();await expect(restored).not.toBeVisible();
 });
}

for(const phone of [false,true]){
 test(`display reset applies every listed default from nondefault preferences (${phone?'phone':'desktop'})`,async({page})=>{
  await page.addInitScript(()=>{
   localStorage.setItem('cemetery-mapping:inspection-remaining-items-open','false');
   localStorage.setItem('cemetery-mapping:inspection-keyboard-help-open','true');
   localStorage.setItem('cemetery-mapping:inspection-reset-keyboard-help-open','true');
   localStorage.setItem('cemetery-mapping:inspection-restored-defaults-open','true');
  });
  const state=await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const original=structuredClone(state.getInspections());
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByLabel('Inspection source',{exact:true}).fill('Shared-defaults retained draft');
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption(marker.condition.id);
  await inspectionStep(page,'Review & save');
  let dialogs=0;page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss();});
  const reset=region.getByRole('button',{name:'Reset display preferences',exact:true});
  await reset.focus();await page.keyboard.press('Enter');await expect(reset).toBeFocused();
  expect(await page.evaluate(()=>[
   'cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-keyboard-help-open',
   'cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open',
  ].map(key=>localStorage.getItem(key)))).toEqual(['true','false','false','false']);
  await expect(region.locator('.inspection-restored-defaults-list ul')).not.toBeVisible();
  await expect(region.locator('.inspection-reset-escape-hint')).not.toBeVisible();
  await region.getByText(/^Restored defaults \(\d+\)$/).click();
  await expect(region.locator('.inspection-restored-defaults-list li')).toHaveText([
   'Remaining items: shown','Inspection keyboard hint: hidden','Reset confirmation keyboard hint: hidden','Restored-defaults list: hidden',
  ]);
  await expect(region.getByText('Shared-defaults retained draft',{exact:true})).toBeVisible();
  expect(dialogs).toBe(0);expect(state.getInspections()).toEqual(original);expect(state.uploads).toHaveLength(0);
 });
}

for(const phone of [false,true])for(const invalid of [false,true]){
 test(`display startup matches shared defaults (${invalid?'invalid':'absent'} storage, ${phone?'phone':'desktop'})`,async({page})=>{
  if(invalid)await page.addInitScript(()=>{
   for(const key of ['cemetery-mapping:inspection-remaining-items-open','cemetery-mapping:inspection-keyboard-help-open','cemetery-mapping:inspection-reset-keyboard-help-open','cemetery-mapping:inspection-restored-defaults-open'])localStorage.setItem(key,'invalid');
  });
  await setup(page,true);
  if(phone)await page.setViewportSize({width:390,height:844});
  const region=page.getByRole('region',{name:'Inspections',exact:true});
  await region.getByRole('button',{name:'New inspection',exact:true}).click();
  await region.getByRole('combobox',{name:'Monument condition',exact:true}).selectOption('');
  await inspectionStep(page,'Review & save');
  await region.getByRole('button',{name:'Edit visit & condition',exact:true}).click();
  const current=region.getByRole('region',{name:'Current required item',exact:true});
  await expect(current.getByRole('list',{name:'Remaining required items',exact:true})).toBeVisible();
  await expect(current.locator('.inspection-keyboard-hint')).not.toBeVisible();
  const before=await region.getByLabel('Inspection source',{exact:true}).inputValue();
  await region.getByRole('button',{name:'Reset display preferences',exact:true}).click();
  await expect(current.getByRole('list',{name:'Remaining required items',exact:true})).toBeVisible();
  await expect(current.locator('.inspection-keyboard-hint')).not.toBeVisible();
  await expect(region.locator('.inspection-reset-escape-hint')).not.toBeVisible();
  await expect(region.locator('.inspection-restored-defaults-list ul')).not.toBeVisible();
  await expect(region.getByLabel('Inspection source',{exact:true})).toHaveValue(before);
 });
}
