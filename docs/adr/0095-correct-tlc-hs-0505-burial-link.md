# ADR 0095: Associate TLC-HS-0505 only with Clifford Chester Brant

Status: Accepted
Date: 2026-10-15

The owner confirmed TLC-HS-0505 commemorates Clifford Chester Brant only, not Jacoueline Lois Brant. Migration 447 linked the military foot marker to D-0499 but left no active person-specific burial link. The marker overview therefore falls back to all people in the linked grave, including Jacoueline.

Migration 454 explicitly links the existing Clifford burial to TLC-HS-0505 and soft-deletes any active link from this marker to Jacoueline. Preserve both burial records, all gravesites, the monument record and geometry, gravesite associations, other markers, and already retired plaque-label links. No application logic changes are needed: the existing overview filters by explicit burial IDs when present.

Reject unexpected grave assignments, missing or ambiguous people, and unrelated active burial links. Environments without the active marker are unchanged. Back up DEV before applying and verify Clifford is the sole active marker burial link, with all other maintained records unchanged. Automatic rollback is empty; use the pre-migration backup for recovery.
