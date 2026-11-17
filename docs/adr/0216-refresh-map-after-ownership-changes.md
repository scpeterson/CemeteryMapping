---
---

# ADR 0216: Refresh map statuses after ownership changes

- Status: Proposed
- Date: 2026-11-17

## Decision

Successful ownership writes already reload selected details, but previously left
the map's grave summaries unchanged. Connect those writes to the existing
cemetery-data refresh: new deeds, edited/released events, owner updates and
removed rights. Fetch authoritative derived statuses rather than marking only
the selected grave Sold. Whole-lot and listed-grave rights can affect several
graves, including targets removed from an edited deed; occupancy and manual
status precedence remain server decisions.

Refresh map source data in place. Fit the map to a selected grave when its
identity or geometry changes, rather than every replacement summary object.
This preserves the camera when ownership refreshes status without changing the
footprint. Existing selection, scope and filters remain in application state.
No page reload, schema change, new endpoint, polling or cross-session push is
introduced. Other sessions retain their existing refresh behavior.

Failed writes trigger no map refresh. Background data fetch failures retain the
last map data and use the existing API-error display; they do not turn a committed
ownership write into a failed form submission or resubmit it automatically.

## Validation

Browser regressions cover desktop/mobile whole-lot deed creation, failed saves,
unchanged occupied/unrelated graves, edited old/new deed targets, removal of a
single deed connection, map source statuses, selection/scope/filter retention,
and preserved map identity/camera with no document navigation. Existing targeted
non-ownership mutations and passageway workflows remain covered. Run:

```sh
npx playwright test --config playwright.ui-consistency.config.ts tests/ownership-map-refresh.spec.ts tests/edit-ownership.spec.ts tests/targeted-mutations.spec.ts tests/passageways.spec.ts
npm run lint
npm run build
npm run test:server
```

See the [operator guide](../operator-workflows.md#ongoing-maintenance-workflows).
