---
---

# ADR 0020: Shift Section C 0172 Passageway Gravesites North

[Documentation Home](../index.md) | [ADR Index](README.md)

## Status

Accepted

## Date

2026-06-09

## Context

Historic lot map evidence places `C-0172A` and `C-0172B` in the former Section C carriage passageway between lots `29` and `51`, not in lot `51`. The former passageway is 10 feet wide. Field review determined the pair of Simpson gravesites should be shifted 2 feet north so the pair sits more centrally in that passageway.

The associated shared headstone `TLC-HS-0172` should remain in its current position until its field location is verified separately.

## Decision

Create migration `062-shift-trinity-c-0172-passageway-gravesites.sql` to shift `C-0172A` and `C-0172B` 2 feet north.

The migration:

- updates only gravesites `TLC-GPS-0172-01` and `TLC-GPS-0172-02`
- uses a feet-based projected transform for the northward shift
- clears `lot_uuid` and `lot_id` so the gravesites remain passageway gravesites
- leaves headstone `TLC-HS-0172` untouched

## Consequences

The Simpson gravesites remain separate gravesites in the former passageway, outside lot `51`.

The headstone and gravesite geometry may temporarily differ until the marker location is verified.

## Rebuild And Validation

Run:

```bash
npm run test:server
npm run lint
npm run build
APP_ENV=test npm run db:validate
APP_ENV=test npm run db:migrate
```

In an environment with the real Section C data, confirm `C-0172A` and `C-0172B` moved north by 2 feet, have no lot assignment, and `TLC-HS-0172` did not move.

## Update Triggers

Update this ADR if the passageway width is remeasured, the Simpson gravesite geometry changes again, or the shared marker location is verified and adjusted.
