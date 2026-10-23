---
---

# ADR 0131: Keep All Correction Actions In The Sticky Panel

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0130

## Decision

Move Previous missing item, Next missing item and Return to review into the sticky correction panel. Render each action once. Use a two-column directional row with a full-width Return action and wrapping touch targets. Keep Return available after the last issue is resolved; hide directional actions when no issues remain.

Share the existing stage-advance handler between ordinary editing and correction mode. Guided required-item Return focuses the Required information summary, including corrections entered via an incomplete step. Preserve ordinary review-edit focus destinations. Navigation reuses the current draft and performs no persistence or uploads.

## Validation

Run lint, production build and focused required-information browser regressions. Desktop and phone coverage verifies all three controls remain within the viewport after scrolling, directional clicks and keyboard Return preserve focus and draft evidence, completion retains Return, and explicit save retains readings, designs and photos. Inspect phone screenshots.
