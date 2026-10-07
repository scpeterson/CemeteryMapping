# ADR 0074: Enforce Production Bundle Budgets in CI

Status: Accepted

CI runs `npm run build:prod` in addition to the TEST build. Production budgets are 50 KiB for the application entry, 70 KiB for React, and 700 KiB for all JavaScript, including lazy chunks and MapLibre workers. Existing Auth0, admin, and map chunk limits remain in effect.

The October 2026 measured baseline was 45.78 KiB entry, 65.95 KiB React, and 646.62 KiB total. Previous 45/65/500 limits already failed at baseline. The new limits provide bounded headroom and make the check enforceable; they are not claims of runtime speed improvement. Initial-load transfer and runtime latency still require separate measurement. Increasing a budget requires a reviewed explanation.

Validation: `node --test scripts/check-bundle-size.test.mjs` and `npm run build:prod`.
