import {defineConfig,devices} from '@playwright/test';
import base from './playwright.ui-consistency.config';
// Isolated frontend and mocked APIs; never reuse the administrator's DEV server.
export default defineConfig({
 ...base,
 testMatch:['marker-creation-defaults.spec.ts','marker-sections.spec.ts','map-controls.spec.ts'],
 projects:[
  {name:'desktop',use:{...devices['Desktop Chrome']}},
  {name:'mobile',testMatch:['marker-creation-defaults.spec.ts'],use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},
 ],
});
