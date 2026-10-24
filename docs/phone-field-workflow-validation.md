# Phone inspection workflow validation

Date: 2026-10-24

## Scope

Run the touch-enabled Chromium journey at 320 × 844 and 390 × 844 against mocked API fixtures. It creates a visit with Front and Back readings and photos, corrects a missing source and face label using the sticky panel, saves with a delayed upload and one failed upload, reloads, resumes the pending queue, reselects the missing file, retries, and opens the resulting gallery.

Assertions cover 44px correction targets, visible correction actions, no settings reset in the sticky panel, no horizontal gallery overflow, the filtered photo count, one saved inspection, two uploaded photos, and no repeated upload of the completed photo. Screenshots capture correction, saving, and saved-gallery states in Playwright's test-results directory. Portrait and landscape regressions check natural image proportions, consistent thumbnail frames, and object-fit contain so the complete photo remains visible.

Commands:

```sh
npm run test:inspections:browser -- --grep 'phone field workflow'
npm run test:inspections:browser
npm run lint
npm run build
```

## Follow-up on a physical phone

The automated journey covers layout, touch-sized controls, data preservation, and simulated connection interruptions. Check these conditions during a real cemetery visit:

1. In bright daylight, read the captions, selected face, missing-item count, and save status without zooming.
2. With one hand, take Front and Back photos, switch faces, correct one required field, and return to review.
3. Use the camera/photo picker with actual large portrait and landscape files; inspect full-size text legibility and orientation.
4. Interrupt connectivity, verify the saved-inspection/photo-retry distinction, reload, and resume the pending files.
5. Confirm native keyboard and camera overlays leave the active field and correction actions reachable.

Browser tests cannot establish outdoor contrast, one-handed comfort, camera behavior, or performance on the user's actual device and network. Record those observations before calling the physical field trial complete.

## Ordered branches

Each branch contains one improvement on top of the previous branch. Review or integrate in this order:

| Branch | Change | Base |
| --- | --- | --- |
| codex/01-photos-first-gallery | One Add photos action, record-specific linking | main |
| codex/02-compact-inspection-corrections | Compact correction row, separate display settings | 01 |
| codex/03-scannable-photo-cards | Consistent uncropped thumbnails, photo action menus | 02 |
| codex/04-inspection-save-status | Unsaved, saving, photo retry, and completion states | 03 |
| codex/05-resumable-inspection-drafts | Explicit browser/account/marker draft recovery | 04 |
| codex/06-phone-field-workflow | Complete touch-phone regression and filtered count clarity | 05 |
