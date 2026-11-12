---
---

# ADR 0204: Bound the MapLibre 6.16 runtime increase separately

- Status: Superseded by [ADR 0209](0209-maplibre-growth-reporting.md) on November 12, 2026
- Date: 2026-11-06
- Related: PR #797

## Decision

Upgrade MapLibre from 6.14.0 to 6.16.0 while retaining application entry,
map application, admin, shared core and standalone workspace limits.

Clean installs and production builds of main and the dependency PR on the same
machine measured 8,379 additional gzip bytes in the map vendor chunks and 3,559
in the map worker. No other chunk grew by more than 100 bytes. Together this is
11.66 KiB of dependency runtime growth, rather than new application code.

The historical combined map vendor/worker baseline rounds up to 415 KiB gzip.
Permit at most 12 KiB growth above that baseline, only for those named runtime
assets. Their combined hard cap is 427 KiB; their growth credit against the
existing 700 KiB core calculation cannot exceed 12 KiB. All other JavaScript
still counts fully. The individual 285 KiB map vendor cap remains in place.

## Validation

Test that the measured runtime fits, one extra application byte at the core
boundary fails, and runtime growth beyond the dependency cap fails. Run lint,
server tests, production build, database startup and all browser CI groups.
No database or environment configuration changes are required.
