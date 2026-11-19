---
---

# ADR 0219: Previewed policy administration with attributed history

- Status: Proposed
- Date: 2026-11-19

## Decision

Add Admin → Policies on top of ADR 0218’s typed catalog. Show each local value,
resolved inherited value and source; support explicit enabled/disabled overrides
and removal back to inheritance. System admins manage all scopes. Cemetery admins
manage only their actual editable cemetery-admin memberships. Require an active
application account, a reason and a successful preview for the exact save.

Preview uses the real guarded mutation and deferred constraints, computes affected
rule counts under the policy/data locks, then rolls back the configuration,
revision and proposed history. A five-minute account-bound HMAC proof binds scope,
rule, value, reason and revision. Save rechecks database authority and current
records; conflicts, stale revisions and busy locks leave configuration unchanged.

Keep direct runtime DML revoked on the catalog and new history table. Migration
522 introduces the narrow guarded mutation function and actor/scope/before/after
history. Preserve immutable actor email and scope label after account/location
renames or deletion. Use permission-scoped keyset pagination for older history.

## Boundaries

System integrity checks remain non-overridable. Existing stacking cutoff fields
and grandfathered reservations remain authoritative. There is no scheduling engine
or arbitrary rule expression editor. Policy edits do not rewrite existing cemetery
records. Disabled-auth sessions lack an attributable account and cannot mutate.

Group related admin workflows into a lazy admin bundle to improve compression
without increasing bundle budgets; related workflows load together on admin open.
Keep the existing minifier and dependencies. See [Location policies](../location-policies.md)
for operator steps, rollout, preview-key handling and rollback/history precautions.
