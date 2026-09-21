---
---

# ADR 0064: Restore NHG Snyder/Soergel Reading on Page 189

- Status: Accepted
- Date: 2026-09-17

## Decision

Migration 402 restores the missing SNYDER/SOERGEL reading from NHG printed
page 189, PDF page 10, extracted lines 9-10. Visual review confirms the
location is (8A, 7, s); extracted OCR misreads 8A as BA. The OCR variant is
retained in source metadata.

The source describes an upright gray granite marker in excellent condition,
with a cross, and the inscription:

> Katherine Soergel / wife of / Peter Snyder / 1865-1937 / Mother

Restore one reviewed source entry per existing page-189 import batch for the
matching cemetery, linking each to TLC-HS-0072 and gravesite A-0072. DEV has
three such batches. Keeping all batches complete follows the previous NHG
restoration pattern.

Katherine Snyder already has maiden name Soergel and recorded birth/death
years 1865 and 1937. Burial details, marker inscription, current condition,
and spatial geometry remain unchanged. The historic condition remains source
evidence. Peter is mentioned as spouse; this is a single-person marker
reading and does not justify creating a second burial. No exact dates or
additional Church Records facts are inferred.

## Validation and Recovery

A rolled-back DEV transaction checks one restored entry per relevant batch,
correct headstone/gravesite links, and unchanged burial, headstone, and
gravesite records. Liquibase validates the migration before application.

The migration uses an empty rollback. Recovery requires a forward correction
or backup restoration accounting for subsequent source review edits.
