---
---

# ADR 0109: Back Inscriptions Use Marker Faces

- Status: Accepted
- Date: 2026-10-22
- Supersedes: separate back-description handling in ADRs 0009 and 0069

## Context

The marker model has both labeled faces and a separate Back of stone description. Operators must use different fields for the same kind of observation, and the back text is absent from inspection face snapshots. The administrator requests a system-wide conversion into Front and Back face inscriptions.

## Decision

Migration 490 converts every nonempty back description verbatim into an ordinary Back face. The existing sole Unspecified face becomes Front with its original UUID and metadata. Missing front readings get an empty Front face. Existing named faces are preserved; an existing Back face retains its ID, metadata and text, with distinct legacy text appended rather than overwritten.

Update only the field inspection matching the marker's last-inspected date, or the legacy year-only `field:2026` origin when no exact date exists. Preserve that visit's independent front reading and condition/source fields. Do not infer a 2005 or other historical back inscription from a modern field observation. Disable automatic inspection capture during the structural conversion so other visits are not refreshed. Photo contexts remain unchanged, and retained face IDs keep existing photo labels valid.

Retain original back text in `source_properties.BackFaceMigration490` for provenance, then drop `back_description`. Remove the separate UI, public response/input type and report item. Nonempty requests from older clients receive guidance to enter a Back face inscription, preventing silent text loss. Reports include Back through the combined face inscription. Future inspections copy face readings using the existing workflow without copying photos.

## Consequences

All sides share one editing and display model. A back description may include a carving or plaque description; preserve it exactly rather than guessing which parts are a transcription. Historical inspections remain independent and may still have unknown-face readings. A schema rollback restores the retired column and original text but retains converted faces; use reviewed forward changes for operational recovery.

## Rebuild And Validation

Apply the complete Liquibase changelog with `APP_ENV=<env> npm run db:migrate` and deploy the matching API/frontend. Validate migration/rollback on an isolated TEST database with `APP_ENV=test npm run db:rollback:test`. Run `APP_ENV=test node --test scripts/back-faces.integration.mjs`, the broader database rules suite, server tests, and browser coverage in `marker-faces.spec.ts`, `app.spec.ts`, inspection/photo specs and report specs. Migration fixtures roll back and never require real Trinity monuments. Back up operational data before applying and compare migrated readings and photo links with the pre-migration snapshot.

## Update Triggers

Revisit this decision if inspection provenance gains per-face dates or back-side descriptions need a different field meaning. Do not restore a side-specific inscription field.
