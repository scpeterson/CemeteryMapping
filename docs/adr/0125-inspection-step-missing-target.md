---
---

# ADR 0125: Navigate Incomplete Steps To Their First Missing Item

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0124

## Decision

Selecting an incomplete Visit & condition step focuses its first missing field in date/source/condition order. Selecting incomplete Faces & photos selects the first missing face label by stable ID and focuses it. The incomplete Review & save shortcut targets the first missing visit field, then the first face label. Complete steps retain their usual heading focus. This affects step shortcuts; Next and Return still open the full review summary even while incomplete.

Use existing validation and post-commit input-focus refs. Increment a focus-request revision on shortcut activation so clicking an already active step still focuses its first remaining issue. Shortcuts from/to review use the existing review-origin correction flow and return to Required information. Earlier entry navigation retains its normal Next action. All navigation preserves the mounted draft and performs no writes.

## Validation

Run `npm run lint`, `npm run build`, and `npm run test:inspections:browser`. Browser tests cover keyboard and repeated active-step targeting, date/source/condition order, first unlabeled face selection, Review priority and Return behavior, complete-step fallback, retained reading/file/library drafts, final save and phone layout. Existing review-summary tests intentionally use Next/Return to inspect incomplete drafts. No API or database changes are needed.
