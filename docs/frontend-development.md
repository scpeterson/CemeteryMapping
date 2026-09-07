---
---

# Frontend Development

[Documentation Home](index.md) | [Frontend ADR](adr/0001-vite-react-typescript-frontend.md)

## Component Boundaries

Keep the application shell responsible for selection, workspace navigation, and coordinating data. Keep workflow-specific state and API operations in the relevant hooks. Preserve the lazy-loading boundaries for administration, reports, and control points.

- `src/components/detail/` contains record views, editors, evidence lists, and galleries; `DetailPanel.tsx` coordinates the appropriate detail view.
- `src/components/admin/use*Administration.ts` owns administration workflow state and operations.
- `src/components/admin/deeds/` separates case filters, lists, editing, actions, and evidence review.
- `src/components/admin/north-hills/` separates reading filters, lists, editing, source facts, and candidate matches.
- `DeedsAdminTab.tsx` and `NorthHillsAdminTab.tsx` compose those sections with narrow typed props. Shared types and presentation helpers belong in their domain's `shared.ts`.

Prefer a component with one editing or review responsibility over extending a coordinator with another large form. Avoid copying workflow state into child components unless the child intentionally owns an independent draft.

## Shared Controls and Feedback

Use `src/components/ui/` for common behavior:

| Component | Contract |
| --- | --- |
| `Button` | Primary, secondary, or danger styling; defaults to `type="button"`. Set `type="submit"` for form submission. `busy` disables the control and exposes `aria-busy`. |
| `TextField` | Associates its label with the input, assigns an ID when needed, and connects hint/error text through `aria-describedby` and `aria-invalid`. |
| `Notice` | Uses a status announcement for informational/success feedback and an alert for errors. |
| `EmptyState` | Explains an empty view and can provide a useful next step. |
| `StatusBadge` | Combines a text label with a neutral, success, or warning appearance. Do not communicate status through color alone. |
| `Modal` | Uses native `showModal()`, makes background content inert, wraps Tab/Shift+Tab, handles Escape, and restores focus. It does not dismiss on backdrop clicks. |
| `ConfirmationProvider` / `useConfirmation` | Provides an asynchronous confirmation dialog; Cancel receives initial focus. Await the returned boolean before performing the action. |

Use `protectDrafts` on editable panels that must check drafts before Escape closes them. Photo viewers and nested action confirmations do not discard editor drafts just by closing. The navigation-discard warning currently uses the browser's synchronous confirmation, independently of `useConfirmation`.

## Draft State and Navigation

`src/hooks/useDraftState.ts` intentionally distinguishes edits from loading or accepting a record. It compares JSON-serializable values against a saved baseline; update values immutably and keep files, DOM nodes, and other non-serializable objects outside this state.

```tsx
const [form, setForm] = useDraftState(initialRecord);

// A functional update edits the draft and retains its baseline.
setForm((current) => ({ ...current, name: nextName }));

// A replacement loads a record or accepts a successful save as the new baseline.
setForm(savedRecord);
```

Do not pass a replacement object from a user-edit handler: that would incorrectly mark the edit as saved. Only establish a new baseline after loading a record, explicitly discarding/reloading, or successfully saving it. A failed save must leave the draft intact. Switching records must be guarded before replacing state.

`App` installs `useDraftNavigationGuard` once. It protects result selection, detail/admin tabs, marked record-selection controls, recognized cancel/close/new/reset buttons, and page exit while tracked drafts exist. Add `data-discard-draft` to a new button that replaces an editor. For map callbacks or keyboard navigation outside those click handlers, call `confirmDiscardChanges()` before changing selection. A confirmed discard resets all registered drafts to their baselines; canceled navigation must not proceed.

This tracking is not universal form middleware. Audit new form state and navigation handlers explicitly. Mounted phone views retain their state while hidden; drafts are not persisted across reloads or browser sessions.

Gravesite updates additionally send the detail response's `version` as `expectedVersion`. HTTP 409 preserves the draft and requires an explicit reload/reconciliation. Keep this concurrency check distinct from the local unsaved-edit warning. Async save completion may update the map data, but must not reselect a grave after the user has selected another record.

## Styling and Responsive Layout

`src/styles/tokens.css` defines shared colors, spacing, type sizes, radii, and control sizing. Reuse these tokens when extending controls. The stylesheet entry remains `src/styles.css`:

- core map and general layout: `src/styles/core-map.css`;
- record details and administration: `src/styles/detail.css` and `src/styles/admin.css`;
- report/print and control-point styles: `src/components/reports.css` and `src/components/control-points.css`;
- common UI controls, focus outlines, and reduced-motion behavior: `src/components/ui/ui.css`;
- breakpoint overrides and phone navigation: `src/styles/responsive.css`.

Preserve cascade order when moving rules. Check print output when changing report or modal styles. At 760 pixels or less, Search/Map/Details are separate visible views while their components remain mounted. The map uses a resize observer when its container changes size. Keep map action groups in the wrapping toolbar, zoom controls in their separate column, and measurement feedback in toolbar flow.

## Signed-In Workspace

`AuthenticatedShell` places the account identity and Sign out in a normal-flow header above the application. Keep this header outside the map toolbar and reserve its space through the authenticated workspace grid; avoid viewport-fixed account controls that can cover map actions. The grid must allow narrow children to shrink, including the phone Details view. Signing out checks tracked drafts before invoking Auth0 logout.

`tests/auth-layout.spec.ts` runs the production shell with a controlled Auth0 context, so layout tests exercise the signed-in controls even when normal TEST authentication is disabled. Cover long identities, fallback labels, phone navigation, logout/canceled logout, and report print visibility. The account header is excluded from print output while the authenticated workspace remains printable.

## Protected Photos

Use `src/hooks/useMediaUrl.ts` for protected media, as the gallery and marker reports do. It fetches same-API-origin `/media/` images through `authorizedFetch`, creates an object URL, aborts stale loads, and revokes the object URL on cleanup. External image URLs bypass the authenticated fetch. Do not use a plain `<img src="/media/...">` for protected assets or persist a temporary `blob:` URL as a share link.

## Validation

Prepare a migrated, seeded TEST database using the [rebuild guide](rebuild.md), then run the checks appropriate to the change:

```bash
npm run lint
npm run build:test
npm run test:server
APP_ENV=test npm run test:db-rules
APP_ENV=test npm run test:e2e
```

`tests/improvements.spec.ts` covers delayed saves, conflict recovery, authenticated photos, toolbar overlap/clicks, draft navigation, mobile navigation, and search recovery. `tests/ui.spec.ts` covers keyboard tabs, nested dialog focus, administration rendering/selection, and horizontal overflow. Responsive tests save screenshots under Playwright's `test-results/` output. Review these images as well as assertions; overflow checks alone do not catch overlapping controls.

Shared browser fixtures live in `tests/fixtures/cemetery.ts`. The nested-dialog harness and its mounting helper are test-only files. Keep API mocking limited to the boundaries a test needs, and retain API-backed coverage for real record reads and mutations. CI rebuilds TEST and runs lint, build, server, database, and browser checks. Test counts change as coverage grows; use the current run's results rather than a fixed documented count.
