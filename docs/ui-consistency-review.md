---
layout: default
title: UI consistency review
---

# UI consistency review — November 16, 2026

Reviewed the application at merged main `c20b535` and made shared presentation
corrections on `codex/ui-consistency-review`. This is a local source/fixture review,
not a hosted deployment or an audit of every record, browser or permission state.

## Findings and corrections

- Administration text-input selectors also affected checkboxes, allowing a 16px
  square to inherit a 38px minimum height. Shared native checkbox/radio sizing
  now prevents that inheritance; active/acknowledgment labels align beside their
  controls with a full-height click area. Inspection flag behavior is retained.
- Textareas were missing from the foundation's inherited-font rule. Multiline
  reading, source and lookup editors now share the application font.
- Standalone controls could render with browser-default borders and padding when
  outside an editor-specific selector. Low-specificity shared defaults cover
  these controls, while composite search, compact tools and domain layouts keep
  their own overrides.
- Repeated field border/radius/height and action-fill values now reference shared
  tokens across map, record, photo, inspection, admin and report styles. Standard
  forms use 38px controls; dense tooling retains 36px and explicit map/touch
  targets retain their sizes. These differences are deliberate, not drift.
- Request access now uses the same card, Button and Notice patterns as signed-in
  pages, including error/success feedback. Task-access retry uses the shared
  Button. Detail/admin/report error messages share the same error palette.

## Review coverage

| Surface | Evidence checked |
| --- | --- |
| Map/header/search | Responsive navigation, scope controls, compact map tools and workspace overflow |
| Gravesite/ownership/burial | Editor layout, validation, draft preservation and failed-save recovery |
| Monuments/inspections/photos | Face flags, source/history, narrow-panel layout, gallery actions and review/save flow |
| Administration | Users, records, quality, bulk tools, lookups, deeds, readings, source people, audit and system layouts |
| Reports | Full/partial/history filters, evidence table, phone layout and print overflow |
| Profile | Field/action sizing, readonly identity, feedback and phone layout |
| Standalone pages | Field collection, export, tasks and request-access layouts, errors and permissions |
| Shared controls | Square binary controls, multiline typography, keyboard focus and no horizontal clipping at 320/390/1280px |

The repeatable fixture suite is `npm run test:ui:browser`; see
[frontend styling guidance](frontend-development.md#styling-and-responsive-layout).
Review screenshots use fictional/fixture records. API requests are intercepted by
tests and the dedicated web server has no real backend target. Existing hosted
records, photo assets, accounts and operations documentation are unchanged.
A built service-worker/offline-reload check belongs to the separate built field
suite; this review does not claim that a dev server proves offline deployment.

Production TypeScript/build, lint and the existing bundle budgets are also checked.
No bundle allowance was raised for application code. New regression assertions
cover the inherited checkbox sizing, shared font, focus indication and responsive
control boundaries rather than merely asserting CSS class names.

Validation completed locally: 118 broad browser checks passed, with one built-only
offline case skipped; a final targeted run passed all 26 checks, including the
seven new consistency cases and additional map/admin layouts. Lint, production
TypeScript/build, bundle budgets, documentation build and local documentation
file-link checks passed. The adjusted core bundle remains below the existing
702 KiB gzip cap; no application-code allowance was changed.
