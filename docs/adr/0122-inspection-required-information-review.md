---
---

# ADR 0122: Actionable Required-Information Review

- Status: Accepted
- Date: 2026-10-23
- Extends: ADR 0120 and ADR 0121

## Decision

Replace the generic incomplete-review message with a Required information section at the top of Review & save. List and count each missing new-inspection date, trimmed source, condition and trimmed face label. Give each issue a direct correction action. When none remain, explicitly show completion. Readings, photos and notes remain optional, and existing inspections may retain a year-only date.

Use the same missing-state computation for review rows, Save disabling and the save guard. Mark missing inputs with aria-required/aria-invalid and associate them with per-instance issue descriptions. Actions focus the exact visit input or select the correct face by stable ID and focus its label. Reuse Return to review and existing focus restoration. Resolved issues disappear without replacing draft state or performing writes. Whitespace-only sources and labels count as missing; review labels must not appear blank for such faces.

## Validation

Run `npm run lint`, `npm run build` and `npm run test:inspections:browser`. Browser coverage checks multiple simultaneous visit/face issues, whitespace validation, keyboard actions and exact accessible field focus/descriptions, live issue counts/completion, retained files/readings/designs/library selections, correct final save, existing year-only inspections, and phone layout. No API or database changes are needed.
