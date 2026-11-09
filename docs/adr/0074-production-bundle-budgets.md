---
---

# ADR 0074: Enforce Production Bundle Budgets in CI

Status: Accepted

## Current budget reference — November 9, 2026

The dated decisions and measurements below are historical. Later accepted ADRs
refine the original combined JavaScript allowance:

- [ADR 0199](0199-offline-field-collection.md),
  [ADR 0202](0202-scoped-record-exports.md) and
  [ADR 0203](0203-assigned-maintenance-tasks.md) introduce separately budgeted
  field, export and maintenance-task entries.
- [ADR 0204](0204-maplibre-runtime-budget.md) bounds MapLibre runtime growth
  separately, with at most 12 KiB of credit against the charged core calculation.
- [ADR 0205](0205-debounced-inspection-recovery.md) raises the charged core cap
  from 700 to **701 KiB gzip** after measurement and review.
  [ADR 0206](0206-draft-guard-navigation-comparison.md) retains that cap after
  profiling the navigation guard.

See [`scripts/check-bundle-size.mjs`](https://github.com/scpeterson/CemeteryMapping/blob/main/scripts/check-bundle-size.mjs) for current
enforced limits and accounting. The 701 KiB figure is the charged core cap, not
an unconditional cap on every emitted JavaScript asset combined. The historical
figures below are retained as the record of the original decisions.

## Original decision

CI runs `npm run build:prod` in addition to the TEST build. Production budgets are 50 KiB for the application entry, 70 KiB for React, and 700 KiB for all JavaScript, including lazy chunks and MapLibre workers. Existing Auth0, admin, and map chunk limits remain in effect.

The October 2026 measured baseline was 45.78 KiB entry, 65.95 KiB React, and 646.62 KiB total. Previous 45/65/500 limits already failed at baseline. The new limits provide bounded headroom and make the check enforceable; they are not claims of runtime speed improvement. Initial-load transfer and runtime latency still require separate measurement. Increasing a budget requires a reviewed explanation.

Validation: `node --test scripts/check-bundle-size.test.mjs` and `npm run build:prod`.

## October 17, 2026: upstream MapLibre packaging

MapLibre 6.14.0 combines vendor code previously emitted in separate chunks into
one measured 273.07 KiB gzip chunk. The individual map-vendor allowance is now
285 KiB. This is an approved third-party dependency exception; the application
entry and map application remain limited to 50 KiB each, the admin shell to
22 KiB, and total JavaScript to 700 KiB. Third-party growth may justify a measured
vendor-budget adjustment; application-code growth still requires investigation
and must not be hidden in a vendor allowance. Vite groups map vendor chunks by
`node_modules` paths, keeping application modules outside that allowance.
