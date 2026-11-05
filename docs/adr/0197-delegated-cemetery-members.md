---
---

# ADR 0197: Delegate cemetery membership administration

- Status: Accepted; not deployed
- Date: 2026-11-05

## Decision

Add an Admin **Members** workspace for cemetery administrators and system
administrators. Every request checks the role for the selected cemetery. Members
are searchable and paged; responses contain only the selected cemetery's role,
name, email, account-active indicator and membership version.

Reuse one existing account by case-insensitive email. New accounts use the existing
Auth0 provisioning/invitation service; its setup is required only for a new account.
An invitation can create an Auth0 account before a database error; retry reuses
that identity and access still requires a saved local membership. No real emails
are sent by automated verification.

Cemetery administrators can assign reader, power-user and cemetery-admin roles,
but cannot change global identity, activation or system-administrator access.
Inactive or ambiguous accounts require system administrator review. Inviting an
existing member cannot silently replace their role. A cemetery-scoped removal
retains the person's account and other memberships. Every mutation records actor
and reason through the existing audit context.

Serialize membership mutations on the cemetery row and new account creation on
an email advisory lock. Version-check edits/removals. Prevent scoped administrators
from removing or demoting the last active cemetery administrator; a system
administrator may deliberately override this guard. Global account administration
remains in Users. There is no permission cache.

## Validation

HTTP tests reject anonymous, reader, power-user and other-cemetery administrator
requests without querying member data. Database regressions preserve identities,
unrelated memberships, audit history and last-admin/version guards. Browser tests
cover scoped controls, invitation, role changes, conflict recovery and mobile fit.
