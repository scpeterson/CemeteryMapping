---
---

# ADR 0069: Multiple Faces on One Physical Marker

- Status: Accepted
- Date: 2026-09-21

## Decision

Keep one headstone record for each physical monument. Represent its faces as
an ordered collection on that record, with a stable UUID, editable label,
verbatim multiline inscription, notes, associated burial UUIDs, and photo
asset UUIDs. Labels may be compass directions or custom names such as Front
or Base. The same person or photo can appear on more than one face.

Location, material, condition, gravesite relationships, and shared-base
relationships remain on the marker. Separate stones on one base remain
separate markers linked by `common_base`.

## Storage and Compatibility

Migration 409 adds `headstones.faces` (JSONB) and `faces_revision`. Faces are
saved atomically with the marker and included in its existing audit history.
The bounded collection has at most 32 faces and an 80,000-character serialized
payload. Each face allows a 100-character label, 20,000-character inscription,
4,000-character notes, and up to 200 person/photo references. These are
references to existing records, not copies of people or media.

The API validates UUIDs, unique IDs and case-insensitive labels, active
marker-to-burial and marker-to-photo associations, and the caller's cemetery
editing scope. Stale face revisions return HTTP 409 without modifying the
marker. Face association references remain historical if a person/photo is
later removed; the editor identifies unavailable references and allows their
removal, and the viewer never displays deleted photos or unrelated names.

Existing nonempty inscriptions become one Unspecified face, preserving text
and line breaks exactly. Existing back-side descriptions remain separate
observations; no orientation, people, or photos are inferred. New markers
created through the existing form receive the same conversion.

A database trigger keeps the legacy `inscription` column synchronized for
existing search, exports, and reports. One face retains its exact text;
multiple faces produce a labeled combined transcription. Legacy writes may
edit a sole face but cannot flatten multiple faces. Deleting a face removes
its references and transcription from the current marker, with the prior
content retained in audit history; it does not delete people or photo assets.
Rollback retains the combined inscription but removes structured face data.

## Editing Workflow

Open the marker's Details tab and choose Edit. Faces / Inscriptions supports
adding, renaming, editing, and removing faces. Pick associated people from
those already linked to the marker and photos from its active marker photos.
To use a new photo, save, upload it through the existing marker photo form,
then edit the marker and assign the photo to a face. Unassigned photos remain
in the marker's general gallery. Read-only users can view faces and photos.

## Validation

Unit tests cover malformed payloads, exact text, repeated use of the same
person/photo across faces, and rejection of unrelated references. Database
integration tests cover migration/backfill, persistence, both marker/grave
read paths, permissions, stale writes, audit history, and legacy compatibility.
Browser regression covers multiple faces, person/photo selection, save/reload,
conflict feedback, draft retention, and removing a face without deleting people
or media. The API requires migration 409 before startup.

Ordinary markers show a plain Inscription field in Edit, including markers with no previous inscription. Entering text automatically stores an Unspecified face; no face label, person selection, or photo assignment is required. Manage faces opens the optional multi-face editor. Back of stone remains independently editable. Photos assigned to faces display only in those face galleries, with the usual photo controls; the general gallery displays unassigned photos.
