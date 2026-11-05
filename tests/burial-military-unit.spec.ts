import {expect,test} from '@playwright/test';
import {select} from './fixtures/cemetery';
import {overviewFixture,overviewGrave} from './fixtures/overview';
const unit='Company E, 136th Pennsylvania Infantry Regiment';
for(const width of [1280,390]) test(`burial military unit saves, displays, and clears at ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:1000});await overviewFixture(page);
 await page.route('**/api/headstone-lookups',route=>route.fulfill({json:{militaryBranches:[{id:'army',code:'army',label:'U.S. Army'},{id:'navy',code:'navy',label:'U.S. Navy'}]}}));
 await page.route('**/api/burials/alice',async route=>{
  const input=route.request().postDataJSON();expect(input.militaryUnit).toBe(input.veteran?unit:'');
  return route.fulfill({json:{...overviewGrave('A-TEST').burials[0],veteran:input.veteran,militaryUnit:input.militaryUnit,militaryBranchCode:input.militaryBranchCode}});
 });
 await page.goto('/');
 if(width<760) await page.getByRole('navigation',{name:'Workspace views'}).getByRole('button',{name:'Search',exact:true}).click();
 await select(page,'A-TEST');await page.getByRole('tab',{name:'People and ownership'}).click();
 await page.getByRole('button',{name:'Edit burial Alice Example'}).click();
 const field=page.getByRole('textbox',{name:'Military unit / organization',exact:true});
 await expect(field).toBeDisabled();await page.getByRole('checkbox',{name:'Veteran',exact:true}).check();
 await field.fill(unit);await expect(field).toHaveAttribute('maxlength','500');
 await page.getByRole('combobox',{name:'Military branch',exact:true}).selectOption('army');await expect(field).toHaveValue(unit);
 await page.getByRole('combobox',{name:'Military branch',exact:true}).selectOption('navy');await expect(field).toHaveValue(unit);
 await page.getByRole('combobox',{name:'Military branch',exact:true}).selectOption('army');
 await page.screenshot({path:testInfo.outputPath(`military-unit-${width}.png`),fullPage:true});
 await page.getByRole('button',{name:'Save burial',exact:true}).click();
 await expect(page.locator('.burial-service')).toContainText(`Military unit / organization: ${unit}`);
 await page.getByRole('button',{name:'Edit burial Alice Example'}).click();await expect(field).toHaveValue(unit);
 await page.getByRole('checkbox',{name:'Veteran',exact:true}).uncheck();await expect(field).toHaveValue('');await expect(field).toBeDisabled();
 await page.getByRole('button',{name:'Save burial',exact:true}).click();await expect(page.locator('.burial-service')).toHaveCount(0);
});
