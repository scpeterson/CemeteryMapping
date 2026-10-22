import {defineConfig,devices} from '@playwright/test';

// These specs mock the API and keep state in their fixtures across page reloads.
// Use a separate web server so the administrator's running app is undisturbed.
export default defineConfig({
 testDir:'./tests',
 testMatch:['record-photos.spec.ts','monument-inspections.spec.ts'],
 reporter:'list',
 use:{baseURL:'http://127.0.0.1:5199',trace:'on-first-retry'},
 webServer:{
  command:'VITE_AUTH_MODE=disabled VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA ./node_modules/.bin/vite --mode dev --host 127.0.0.1 --port 5199 --strictPort',
  url:'http://127.0.0.1:5199',
  reuseExistingServer:false,
 },
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
});
