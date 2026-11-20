import {defineConfig,devices} from '@playwright/test';
import base from './playwright.ui-consistency.config';
const port=Number(process.env.POLICY_BROWSER_PORT??5197);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Choose a valid isolated policy browser port.');
const production=process.env.POLICY_BROWSER_PRODUCTION==='1';
// Isolated frontend and mocked APIs; never reuse the administrator's DEV server.
export default defineConfig({
 ...base,
 outputDir:`test-results/policies-${port}-${production?"production":"development"}`,
 use:{...base.use,baseURL:`http://127.0.0.1:${port}`},
 webServer:{
  command:production?`./node_modules/.bin/vite preview --host 127.0.0.1 --port ${port} --strictPort`:`VITE_PROXY_API_TARGET=http://127.0.0.1:9 VITE_AUTH_MODE=disabled VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA ./node_modules/.bin/vite --mode dev --host 127.0.0.1 --port ${port} --strictPort`,
  url:`http://127.0.0.1:${port}`,reuseExistingServer:false,
 },
 // Map-control instrumentation is DEV-only; run those specs in the normal profile.
 testIgnore:production?['**/map-controls.spec.ts']:[],
 // app.spec.ts also relies on the real API's profile/lookups and belongs to
 // the main E2E suite, not this closed-port, fully mocked frontend harness.
 testMatch:['admin-layout.spec.ts','admin-ui-fixes.spec.ts','grave-feature-lookups.spec.ts','admin-policies.spec.ts','marker-creation-defaults.spec.ts','marker-sections.spec.ts','map-controls.spec.ts'],
 projects:[
  {name:'desktop',use:{...devices['Desktop Chrome']}},
  {name:'mobile',testMatch:['marker-creation-defaults.spec.ts'],use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}},
 ],
});
