---
---

# ADR 0209: Allow and report MapLibre bundle growth

- Status: Accepted
- Date: 2026-11-12
- Supersedes: ADR 0204's blocking MapLibre limits and ADR 0208's size-based deferral

## Decision

The owner directs that MapLibre upgrades may always exceed bundle-size budgets
because the map engine is central to this application. Report the size change
rather than blocking the upgrade or requesting approval for MapLibre growth.
Compatibility, functional and other CI checks still apply.

Convert the historical 285 KiB individual map-vendor threshold and 427 KiB combined
map-vendor/worker limit into nonblocking reports. Credit all named MapLibre runtime
growth above the historical 415 KiB baseline against the 701 KiB core calculation,
replacing the old 12 KiB credit ceiling. Do not credit application/shared code or
unrelated workers. Missing required chunks, application/vendor chunk overages and
non-map core overages continue to fail the build.

Every production bundle check prints actual MapLibre vendor/worker gzip size,
credited growth above baseline, adjusted core size and total JavaScript size.
Overages print explicit nonblocking messages. Future upgrade PRs must report the
before/after MapLibre and total bundle measurements, including any threshold
excess; the historical baseline is not silently reset at each upgrade.

## MapLibre 6.18 measurement

With the same updated toolchain, MapLibre 6.16 vendor and worker assets measured
425.95 KiB gzip. MapLibre 6.18 measures 427.41 KiB: **+1.46 KiB**, exceeding the
former combined map limit by **0.41 KiB**. Total JavaScript gzip increases from
729.76 to 731.18 KiB (**+1.43 KiB**). The 6.18 build reports 700.99 KiB adjusted
core against the unchanged 701 KiB limit.
These are build measurements rather than network-transfer or user-latency claims.

Upgrade the pinned MapLibre dependency to 6.18.0 under this policy. Preserve the
Liquibase 4.33.0 and TypeScript 6.0.3 holds. No hosted deployment or database changes
are part of this source update.

## Validation

Exercise unbounded map vendor/worker growth and reporting, including an oversized
individual map chunk, while checking that one extra application byte at the core
boundary still fails. Retain missing-chunk, unrelated-worker and standalone-entry
checks. Run lint, server tests, production bundle checks and full CI browser and
database suites before merge.
