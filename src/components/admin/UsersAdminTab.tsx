import { EmptyState, Notice } from "../ui/Feedback";
import { useState } from "react";
import { fetchUserActivity } from "../../api/profileApi";
import type { UserActivity, CemeteryMembership } from "../../types/administration";
import { AccessRequestsPanel } from "./AccessRequestsPanel";
import { confirmDiscardChanges } from "../../hooks/useDraftState";
import { History, ShieldCheck, UserCheck, UserCog, UserPlus, UserX } from "lucide-react";
import type { AppRole, AppRoleName, AppUser, CemeteryAdminRecords } from "../../types";
import { useUserAdministration, type UserFormState } from "./useUserAdministration";

const roleLabels: Record<AppRoleName, string> = {
  reader: "Read-only",
  "power-user": "Power user",
  "cemetery-admin": "Cemetery admin",
  admin: "Admin",
};

const roleDescriptions: Record<AppRoleName, string> = {
  reader: "Read-only users can view map, gravesite, and burial information, but cannot see deed or owner information.",
  "power-user": "Power users can view deed and owner information and update existing records for their assigned cemetery.",
  "cemetery-admin": "Cemetery admins can administer their assigned cemetery and have read-only access to others.",
  admin: "Admins can manage users, add cemetery records, update records, and soft-delete records.",
};

const roleLabel = (role: AppRoleName) => roleLabels[role] ?? role;
const roleTitle = (role: AppRole) => `${roleLabel(role.name)}: ${role.description}`;
const userTitle = (user: AppUser) =>
  `Edit ${user.displayName || user.email}. Role: ${roleLabel(user.role)}. Status: ${user.isActive ? "active" : "inactive"}.`;

function userFormFromUser(user: AppUser): UserFormState {
  return {
    id: user.id,
    externalSubject: user.externalSubject,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    assignedCemeteryIds: user.assignedCemeteryIds,
    cemeteryMemberships: user.cemeteryMemberships,
    isActive: user.isActive,
  };
}

export function UsersAdminTab({ cemeteryRecords }: { cemeteryRecords: CemeteryAdminRecords }) {
  const {
    query, setQuery, status, setStatus, cemeteryFilter, setCemeteryFilter,
    offset, pageSize, hasMore, setOffset, prepareAccessRequest,
    requestRefreshKey,
    form,
    setForm,
    roles,
    users,
    isSaving,
    isResolvingAuth0User,
    togglingUserIds,
    saveUser,
    resolveAuth0SubjectFromForm,
    resetForm,
    toggleUserActive,
    isLoading,
    message,
    error
  } = useUserAdministration();
  const [activity, setActivity] = useState<UserActivity[]>([]);
  const [activityUser, setActivityUser] = useState("");
  const [activityError, setActivityError] = useState("");
  const [activityLoading, setActivityLoading] = useState(false);
  const memberships = form.cemeteryMemberships ?? form.assignedCemeteryIds.map(cemeteryId => ({ cemeteryId, role: form.role === "admin" ? "reader" as const : form.role }));
  const setMemberships = (entries: CemeteryMembership[]) => setForm(current => ({ ...current, cemeteryMemberships: entries, assignedCemeteryIds: entries.map(entry => entry.cemeteryId) }));
  const visibleUsers = users;
  return (
    <>
      {isLoading ? <Notice>Loading users…</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}
      <AccessRequestsPanel refreshKey={requestRefreshKey} onReview={async (request) => {
        if (!confirmDiscardChanges()) return;
        if (await prepareAccessRequest(request)) document.getElementById("user-setup-form")?.scrollIntoView({ behavior: "smooth" });
      }} />
      <section className="admin-section">
        <div className="section-title">
          <UserCog size={17} aria-hidden="true" />
          <h3>{form.id ? "Edit User" : "Add User"}</h3>
        </div>
        <form id="user-setup-form" className="admin-form" onSubmit={(event) => void saveUser(event)}>
          {form.accessRequestId && <p>Reviewing an access request. Save this active user to approve it, or choose New user to cancel.</p>}
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
              title="The user's email address. This is used to find or create the matching Auth0 account."
            />
          </label>
          <label>
            Display name
            <input
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              title="Optional name shown in the admin user list and saved with the local user record."
            />
          </label>
          <label>
            Auth0 user ID
            <span
              className="auth0-user-id-row"
              title="The Auth0 user_id for this person. Leave it blank for a new user to find or create the Auth0 account during save."
            >
              <input
                value={form.externalSubject}
                onChange={(event) => setForm((current) => ({ ...current, externalSubject: event.target.value }))}
                title="The Auth0 user_id value, usually shaped like auth0|abc123. This must match the token subject from Auth0."
              />
              <button
                type="button"
                className="icon-button auth0-resolve-button"
                onClick={() => void resolveAuth0SubjectFromForm()}
                disabled={isResolvingAuth0User || !form.email.trim()}
                aria-label="Find or create Auth0 user"
                title="Find an Auth0 user by email, or create one if no Auth0 user exists yet."
              >
                <UserPlus size={17} />
              </button>
            </span>
          </label>
          <label>System access
            <select value={form.role === "admin" ? "admin" : "member"} onChange={event => setForm(current => ({ ...current, role: event.target.value === "admin" ? "admin" : "reader" }))}>
              <option value="member">Cemetery member</option><option value="admin">System administrator (all cemeteries)</option>
            </select>
          </label>
          {form.role !== "admin" ? <fieldset className="user-memberships"><legend>Cemetery memberships</legend>
            <p>Assign a role separately for each cemetery.</p>
            {memberships.map((membership, index) => <div key={index} className="user-membership-row">
              <label>Cemetery<select required value={membership.cemeteryId} onChange={event => setMemberships(memberships.map((entry, i) => i === index ? { ...entry, cemeteryId: event.target.value } : entry))}>
                <option value="">Choose cemetery</option>
                {cemeteryRecords.cemeteries.filter(cemetery => cemetery.id === membership.cemeteryId || !memberships.some(entry => entry.cemeteryId === cemetery.id)).map(cemetery => <option key={cemetery.id} value={cemetery.id}>{cemetery.name}</option>)}
              </select></label>
              <label>Cemetery role<select value={membership.role} onChange={event => setMemberships(memberships.map((entry, i) => i === index ? { ...entry, role: event.target.value as CemeteryMembership["role"] } : entry))}>
                <option value="reader">Read-only</option><option value="power-user">Power user</option><option value="cemetery-admin">Cemetery admin</option>
              </select></label>
              <div className="admin-form-actions"><button type="button" className="secondary-button danger-button" onClick={() => setMemberships(memberships.filter((_, i) => i !== index))}>Remove membership</button></div>
            </div>)}
            <div className="admin-form-actions"><button type="button" className="secondary-button" disabled={memberships.length >= cemeteryRecords.cemeteries.length} onClick={() => setMemberships([...memberships, { cemeteryId: "", role: "reader" }])}>Add cemetery</button></div>
          </fieldset> : null}
          <label className="checkbox-row" title="Inactive users are kept in the database but cannot access the application.">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              title="Controls whether this user is allowed to sign in and use the application."
            />
            Active user
          </label>
          <div className="admin-form-actions">
            <button type="submit" disabled={isSaving} title="Save this local user record and role assignment. New users with no Auth0 user ID will be resolved in Auth0 first.">
              {isSaving ? "Saving..." : "Save user"}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm} title="Clear the form so you can add a new user.">
              New user
            </button>
          </div>
        </form>
      </section>

      <section className="admin-section">
        <div className="section-title">
          <UserCog size={17} aria-hidden="true" />
          <h3>Users</h3>
        </div>
        <div className="admin-form">
          <label>Search users<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, email, organization, cemetery" /></label>
          <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label>Cemetery filter<select value={cemeteryFilter} onChange={event => setCemeteryFilter(event.target.value)}><option value="">All cemeteries</option>{cemeteryRecords.cemeteries.map(cemetery => <option key={cemetery.id} value={cemetery.id}>{cemetery.name}</option>)}</select></label>
        </div>
        <p>{visibleUsers.length} {visibleUsers.length === 1 ? "user" : "users"}</p>
        <div className="admin-form-actions" aria-label="User pages">
          <button type="button" className="secondary-button" disabled={isLoading || offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous users</button>
          <span>Page {Math.floor(offset / pageSize) + 1}</span>
          <button type="button" className="secondary-button" disabled={isLoading || !hasMore} onClick={() => setOffset(offset + pageSize)}>Next users</button>
        </div>
        <div className="admin-table" aria-label="Application users">
          {visibleUsers.map((user) => (
            <article key={user.id} className="admin-user-row" title={userTitle(user)}>
              <button type="button" className="admin-user-edit" data-discard-draft onClick={() => setForm(userFormFromUser(user))} title={userTitle(user)}>
                <span>
                  <strong>{user.displayName || user.email}</strong>
                  <small>{user.email}</small>
                </span>
                <span>{user.role === "admin" ? "System administrator" : "Cemetery member"}</span>
                <span>{user.cemeteryMemberships?.map(entry => `${cemeteryRecords.cemeteries.find(cemetery => cemetery.id === entry.cemeteryId)?.name ?? "Cemetery"}: ${roleLabel(entry.role)}`).join("; ")}</span>
                <small>{[user.organization, user.phone].filter(Boolean).join(" · ")}</small>
                <small>Created {new Date(user.createdAt).toLocaleDateString()} · Last active {user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : "Not recorded"}</small>
                <small>{user.assignedCemeteryIds.length ? `${user.assignedCemeteryIds.length} assigned cemeter${user.assignedCemeteryIds.length === 1 ? "y" : "ies"}` : "No cemetery assignment"}</small>
                <span
                  className={user.isActive ? "status-active" : "status-inactive"}
                  title={user.isActive ? "This user can currently access the application." : "This user is blocked from application access."}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </button>
              <button type="button" className="user-status-action" disabled={activityLoading} onClick={async () => {
                setActivityUser(user.displayName || user.email); setActivity([]); setActivityError(""); setActivityLoading(true);
                try { setActivity(await fetchUserActivity(user.id)); }
                catch (error) { setActivityError(error instanceof Error ? error.message : "Unable to load activity."); }
                finally { setActivityLoading(false); }
              }}><History size={15} aria-hidden="true" /><span>View activity</span></button>
              <button
                type="button"
                className={`user-status-action ${user.isActive ? "is-deactivate" : "is-reactivate"}`}
                onClick={() => void toggleUserActive(user)}
                disabled={togglingUserIds.has(user.id)}
                aria-label={`${user.isActive ? "Deactivate" : "Reactivate"} ${user.displayName || user.email}`}
                title={
                  user.isActive
                    ? "Deactivate this user. The local account remains in the database, but access is blocked."
                    : "Reactivate this user so they can access the application again."
                }
              >
                {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                <span>{user.isActive ? "Deactivate" : "Reactivate"}</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      {activityUser ? <section className="admin-section" aria-label="User activity">
        <div className="section-title"><History size={17} aria-hidden="true" /><h3>Recent changes by {activityUser}</h3></div>
        <div className="admin-form-actions"><button type="button" className="secondary-button" onClick={() => setActivityUser("")}>Close activity</button></div>
        {activityLoading ? <Notice>Loading activity…</Notice> : null}
        {activityError ? <Notice tone="error">{activityError}</Notice> : null}
        {!activityLoading && !activityError && !activity.length ? <EmptyState title="No recorded changes" /> : null}
        <div className="role-list">{activity.map(event => <article className="role-row user-activity-row" key={event.id}><strong>{event.tableName.replaceAll("_", " ")}</strong><p>{event.reason || event.operation}</p><small>{new Date(event.changedAt).toLocaleString()}</small></article>)}</div>
        <p className="profile-help">Latest 50 changes retained in the audit log. Last active records authenticated API use, updated at most every five minutes.</p>
      </section> : null}
      <section className="admin-section">
        <div className="section-title">
          <ShieldCheck size={17} aria-hidden="true" />
          <h3>Roles</h3>
        </div>
        <div className="role-list">
          {roles.map((role) => (
            <article key={role.name} className="role-row" title={roleTitle(role)}>
              <strong title={roleDescriptions[role.name]}>{roleLabel(role.name)}</strong>
              <p>{role.description}</p>
              <small title={`There ${role.userCount === 1 ? "is" : "are"} ${role.userCount} active or inactive account${role.userCount === 1 ? "" : "s"} with this role in at least one cemetery (or system-wide for Admin).`}>
                {role.userCount} user{role.userCount === 1 ? "" : "s"}
              </small>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
