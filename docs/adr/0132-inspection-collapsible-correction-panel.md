---
---

# ADR 0132: Collapse The Sticky Correction Panel

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0131

## Decision

Add a native button to collapse or expand the sticky correction panel. Keep the current issue and live remaining count visible in both modes. Hide the remaining-issues disclosure and correction actions together when collapsed; Show controls restores them in one action. Start expanded and retain the user's choice across corrections in this mounted workflow.

Use aria-expanded and aria-controls, retain focus on the toggle, and keep hidden controls out of keyboard navigation. Hide rather than unmount the body so disclosure state remains intact. Panel visibility is local UI state, independent of the inspection draft. Required status continues updating while collapsed, including completion. Existing direct navigation, Previous/Next and Return behavior remain unchanged.

## Validation

Run lint, production build and focused required-information browser checks. Desktop and phone coverage checks keyboard collapse/expand, reduced panel height, sticky toggle visibility while scrolling, hidden actions, live completion while collapsed, restored Return action, retained readings/designs/photos and final save. Inspect phone layout.
