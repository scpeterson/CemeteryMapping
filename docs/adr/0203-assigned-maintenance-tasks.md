---
---

# ADR 0203: Assigned maintenance work, due dates and personal reminders

- Status: Accepted; not deployed
- Date: 2026-11-05
- Related: [ADR 0198](0198-complete-record-edit-conflicts.md), [ADR 0202](0202-scoped-record-exports.md)

## Decision

Extend existing maintenance records with a global account assignee, due date,
optional reminder date and personal reminder dismissal. Keep observations, actions,
priority, source, completion details and photo evidence in the existing record.
One account can be assigned work across multiple cemeteries according to its
current cemetery roles. New assignments require an active editor in that cemetery, including accounts
whose legacy global role is reader but whose cemetery role grants editing;
a system administrator can also assign themselves. Do not create accounts or
change memberships through task management. Historical assignments remain visible
when an account loses access; editors can preserve that attribution or reassign
remaining work.

Use native links for the standalone Field/Export/Tasks routes, styled to the
existing header specifications; existing unsaved-draft unload protection applies.
Add an authenticated Tasks page with My tasks, all editable cemetery tasks,
unassigned work, open/completed/history states, search, pagination and overdue,
seven-day and reminder filters. New tasks require an explicit cemetery and active
gravesite/marker target. Use actual gravesite record IDs, independent of displayed
section/space labels. Current cemetery editors manage task schedules/status/notes;
other existing maintenance fields remain editable through record details. Display
assignment and due date in those details and include scheduling fields in private
maintenance CSV exports.

Dates are calendar dates. The browser sends its local calendar date for queue
status and reminders; the API validates it and defaults to its own calendar date
when omitted. A reminder needs a due date and must fall on or before it. Completed
work requires a completion date; terminal states stop reminders. Retain completion
history and explicit performed-by text rather than inferring who performed work
from the assignee. Local disabled-auth development has no registered person ID:
its cemetery queue works, while personal tasks/dismissal require a real account.
Return the caller's own optional account ID from `/api/me` to support that identity.

## Synchronization and reminders

Public task creation carries a stable request UUID. Use the existing transactional
receipt mechanism to prevent duplicate tasks after an uncertain response, bind its
normalized content and retain drafts on errors. Borrowed nested transactions use
distinct savepoints and release failed scopes so an inner failure cannot leave
an outer receipt pending. Parent/lookup/assignee validation
and assignment creation commit atomically. Recheck current cemetery authorization
for every query and mutation. Show only eligible assignees; search is bounded and
retains the selected account without enumerating unrelated accounts.

Use captured maintenance row versions for both the task editor and existing record
editor. Lock the record before checking its version; changes in either editor
invalidate the other's older form. A 409 retains edits and offers explicit,
confirmed reload. Task updates cannot retarget records or overwrite inspections,
source evidence or photos. Existing trusted transaction/import calls can omit a
version; public edit routes require it.

Reminders are in-app: a personal attention count on Tasks, queue badges, and
assigned-person dismissal. Refresh visible pages/on focus and periodically while
in use. Do not send email or push messages. Dismissing a reminder does not remove
overdue work. Only its assigned person can dismiss it. A database trigger resets
dismissal when assignment/dates change or terminal work reopens, including edits
through the original maintenance form. There is no background delivery promise
when the application is closed.

## Migration, performance and validation

Migration 516 adds scheduling columns, the reminder reset trigger and partial
active-work indexes for assignee/due date and cemetery/due date. Advance the API
startup schema guard to 516. Apply migrations and refresh restricted runtime grants
before restarting/publishing; old public maintenance clients must submit the new
version token. Roll back application code before dropping scheduling columns, and
back up assignment/due/reminder history first.

The separately loaded task page has a 6 KiB gzip cap. Shared header reminders and
vendor/helpers remain in the fixed 700 KiB core budget; separate field/export caps
remain 15/5 KiB. Reuse the shared loading UI and keep authenticated API responses
out of offline caches.

Unit/HTTP checks cover date/state validation, explicit versions, private scope and
reader denials before data work. PostgreSQL tests cover safe task retries,
eligible/current memberships, personal dismissal, rescheduling, completion/reopen,
audits, schedule preservation and independent task-vs-record editor races. Browser
checks cover retained conflicts, confirmed reload, completion history, stable
creation IDs, true target IDs, personal header counts and 320px layout. Run the
fresh database regression suite, migration validate/rollback/reapply, server tests,
lint, production budgets and built offline-shell regression before release.
