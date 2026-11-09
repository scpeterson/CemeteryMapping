---
---

# ADR 0206: Compare unsaved drafts when navigating

- Status: Accepted
- Date: 2026-11-09
- Related: ADR 0205

## Evidence

A production-built React harness measured the actual `useDraftState` hook with
real browser keyboard events in headless Chromium, without CPU throttling.
Each workload ran five trials of 104 measured keystrokes after six warm-up
keystrokes, followed by ten unrelated renders and one canceled navigation.
Before/after runs used the same harness and ran sequentially without other
browser regression workers. The baseline hook came from commit `05d6d2499f7a`;
source override at build time avoided changing the working checkout.

Workloads have one 1,000-character face, eight 2,000-character faces, or a stress
case with 32 faces and 20,000 characters each for both inscription and designs.
The stress case is deliberately extreme, not a typical cemetery record. Record
forms start with a populated baseline; the inspection variant starts at null
and loads a new draft through a functional update, matching inspection editing.
Two forms are mounted to exercise the guard registry. The before/after variant
changes only the guard source, not the harness or React production build mode.

Median trial results (milliseconds):

| Workload | Guard serializations per 104 keys, before → after | Input-commit p95, before → after | Serialization total during typing, before → after |
| --- | ---: | ---: | ---: |
| Small record | 208 → 0 | 0.1 → 0.1 | 0.6 → 0 |
| Eight-face record | 208 → 0 | 0.1 → 0.1 | 1.7 → 0 |
| Maximum-face record stress case | 208 → 0 | 1.0 → 0.1 | 62.5 → 0 |
| Maximum-face inspection stress case | 104 → 0 | 0.5 → 0.1 | 30.9 → 0 |

The previous guard also serialized twice per unrelated render for populated
baselines, or once for null inspection baselines. The new guard performs no
serialization for either. At navigation, the large workloads measured about
3 ms of serialization once per attempt. Small drafts did not show a material
input timing difference. Timing resolution is approximately 0.1 ms: a recorded
zero duration is not a claim of zero execution cost. Input commit measures the
input handler through layout effects; it excludes browser event queuing and
paint. This isolates guard work and is not a full-application latency benchmark.

Raw trials and machine/runtime metadata are in
[supporting/draft-guard-profile-2026-11-09/summary.json](supporting/draft-guard-profile-2026-11-09/summary.json)
and the adjacent `before-*.json` / `after-*.json` files.

## Decision and preserved behavior

Keep layout-time registration of the latest committed draft and baseline, but
compare them only when a navigation or beforeunload check needs a decision.
Use the same JSON-string equality as before, with an identity fast path for
unchanged values. Do not debounce the navigation guard: checks must reflect the
latest committed edit synchronously.

Canceled navigation keeps every draft intact. Confirmed navigation discards only
dirty forms, calls each discard callback once, and resets each draft to its
baseline. Remove a discarded registration immediately so two checks within one
event do not prompt twice. Unmount unregisters the form. Replacement setters
still load/accept a baseline; functional updates still edit against it. Preserve
JSON-equal copy/revert behavior and keep `onDiscard` current after rerenders.

The registry now includes clean forms, but unchanged value/baseline references
avoid serialization on navigation. Values must remain immutable and
JSON-serializable, as required by the existing hook contract. Inspection browser
recovery retains its independent 350 ms debounce and lifecycle flushing.

## Validation and profiling commands

Run `npm run lint`, `npm run build`, and
`npx playwright test --config playwright.draft-guard-regressions.config.ts`.
The regression set covers multiple dirty forms, canceled/confirmed navigation,
JSON-equal copies, reverts, accepted saves, failed saves, immediate unload,
unmount, repeated checks in one event, task/profile/member editors, inspection
recovery, photos, and phone workflows.

Reproduce the profile from the repository root:

```sh
git show 05d6d2499f7a:src/hooks/useDraftState.ts > /tmp/draft-guard-baseline.ts
DRAFT_GUARD_SOURCE=/tmp/draft-guard-baseline.ts DRAFT_PROFILE_VARIANT=before npx vite build --mode prod --config vite.draft-guard-profile.config.ts
DRAFT_PROFILE_VARIANT=before npx playwright test --config playwright.draft-guard-profile.config.ts
DRAFT_PROFILE_VARIANT=after npx vite build --mode prod --config vite.draft-guard-profile.config.ts
DRAFT_PROFILE_VARIANT=after npx playwright test --config playwright.draft-guard-profile.config.ts
```

Results are written under `node_modules/.tmp/draft-guard-profile/`. The isolated
production preview uses port 5200; behavior regressions use port 5199. Neither
requires a database. Profile harnesses and instrumentation are test-only and are
not included in the application's production entry points. Existing bundle
limits, including the 701 KiB charged-core cap from ADR 0205, remain unchanged.
