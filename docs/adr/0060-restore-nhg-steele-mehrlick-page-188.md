# ADR 0060: Restore the Steele/Mehrlick NHG Reading

- Status: Accepted
- Date: 2026-09-16

## Evidence and correction

The NHG reading for Section A, row 8, position 1 was absent from all three
existing OCR import batches. Visual review of printed page 188 (PDF page 9)
and text extraction located it at lines 29–32. The scanned surname reads
MEHRLICK / Mehrlick. User-supplied OCR variants MEHRUCK / Mehrtick remain in
source metadata rather than being silently discarded.

Migration 397 restores one reviewed entry per existing source batch and links
each to TLC-HS-0066, A-0066, and A-0066A. The source preserves the inscription,
upright gray granite description, historical excellent condition, and flowers.
It adds four Church Records facts per entry: Wilbert's death on April 27, 1941;
Anna's death on February 13, 1959; Anna's reported age of 84y 10m 20da; and
her source-record name Anna S. Steele Mehrlick.

Both exact death dates and birth years were already present in the burial
records. Those values, the canonical names, marker details, and geometry remain
unchanged. Anna's notes now include the age and source-name evidence. No exact
birth date or maiden/married surname relationship is inferred from this excerpt.

## Validation and recovery

A rolled-back DEV transaction verified three restored entries, twelve facts,
three marker links, six gravesite links, and unchanged marker, gravesite, and
burial fields other than Anna's notes and update timestamp.

The migration has an empty rollback; recovery requires a forward correction
or restoration from backup with subsequent edits accounted for.
