---
---

# ADR 0199: Encrypted offline field collection and safe synchronization

- Status: Accepted; not deployed
- Date: 2026-11-05
- Related: [ADR 0198](0198-complete-record-edit-conflicts.md)

## Decision

Provide a separate `/field/` entry that opens without a live identity-provider
connection. An editor explicitly prepares one cemetery workspace, downloading
selected marker/person snapshots, lookup choices and up to 100 nearby gravesites.
Ownership records and photo binaries are not downloaded. Existing records can be
corrected, new observations recorded, existing gravesites linked, and original
photo files retained. New observations retain their own dates and sources.
Primary gravesite changes and new geometry remain in the connected application.

Encrypt the workspace and each original photo in IndexedDB with a user-created
offline passphrase: PBKDF2-SHA256, 210,000 iterations, random salt, nonextractable
AES-GCM key, separate random IV and authenticated workspace/file identities.
No bearer tokens or passphrases are persisted. The key stays in memory until lock
or navigation. A revision comparison prevents competing tabs from overwriting a
saved workspace. Limits are 50 markers, 1,000 actions, 500 photos, 20 MiB document
and 25 MiB per photo; quota failures preserve the open form and selected file.

Device save and server synchronization are separate explicit actions. Reconnect
with the original account; check current account and cemetery edit access before
sync and authorize each request again at the server. Cached roles guide offline
controls but grant no server authority. Record versions protect metadata edits;
inspection-only mutations retain existing inspection authorization and guards.
Review conflicts field by field against fresh server values, keeping unrelated
server fields. Replacing a conflicted proposal generates a new action ID and
retains the original in device history. Uncertain requests retain their original
ID and payload. Stopping retries does not undo a committed server write.

Migration 513 adds receipts keyed by authenticated subject and operation UUID.
Store the canonical request hash and minimal acknowledgement in the mutation's
transaction. Nested repository transactions use savepoints. Concurrent retries
wait for the first outcome; rollback creates no receipt. Changed content under
the same ID is rejected. Photo uploads bind the receipt to the original bytes,
metadata and target, check scope before replay, and reuse the existing staged-file
publication/uncertain-commit handling. Receipts must survive for the lifetime of
outstanding device work; no automatic purge is introduced.

## Offline shell and operation

The service worker controls `/field` only, caching the field HTML and immutable
same-origin build assets from a generated manifest. API, media and third-party
requests are never cached. Cache API ignores HTTP caching headers, so this is an
explicit URL allowlist, not reliance on `no-store` ([MDN Cache](https://developer.mozilla.org/en-US/docs/Web/API/Cache)).
Keep two asset generations; refresh preparation while connected after an upgrade.
The 700 KiB gzip core JavaScript budget stays fixed; the separately loaded field
entry has a 15 KiB gzip cap. Its measured initial implementation is about 12 KiB.

API startup requires migration 513. Require HTTPS (localhost is supported for development). Deploy migration first,
then rerun the restricted API-role grant setup, restart the API and publish web
assets together. Development Vite pages report that shell preparation needs a
built deployment; they can still exercise device storage. Browser clearing,
private sessions, quota eviction and forgotten passphrases can lose device-only
work. Request persistent browser storage, keep original photos until synchronization,
and verify the synchronized status before deleting a device workspace.

Rollback web/API before migration 513, after resolving pending device work.
Dropping receipts while old device retries remain would remove idempotency
protection; retain the table and backups until those retries have been retired.

## Validation

Real PostgreSQL concurrent retries commit once; changed requests conflict and
failed transactions leave no receipts. Photo integration checks one file/asset,
exact replay, changed bytes and revoked scope. Browser checks encrypted storage,
wrong passphrase, original bytes after reopen, competing-tab and account guards,
retained drafts, lost-response retry IDs, photo upload and 320px layout. A separate
built-page CI check disconnects the browser and reloads the full shell, checking
that no private URLs entered its caches. Conflict merge tests retain unrelated
server evidence and the current version.
