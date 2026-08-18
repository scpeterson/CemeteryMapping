import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ShieldCheck, UserCheck, UserCog, UserPlus, UserX } from "lucide-react";
import type { AppRole, AppRoleName, AppUser, CemeteryAdminRecords } from "../../types";
import type { SaveUserInput } from "../../api/cemeteryApi";

export type UserFormState = SaveUserInput & {
  id?: string;
};

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
    isActive: user.isActive,
  };
}

type UsersAdminTabProps = {
  form: UserFormState;
  setForm: Dispatch<SetStateAction<UserFormState>>;
  roles: AppRole[];
  roleOptions: AppRoleName[];
  users: AppUser[];
  cemeteryRecords: CemeteryAdminRecords;
  isSaving: boolean;
  isResolvingAuth0User: boolean;
  togglingUserIds: Set<string>;
  saveUser: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  resolveAuth0SubjectFromForm: () => Promise<void>;
  resetForm: () => void;
  toggleUserActive: (user: AppUser) => Promise<void>;
};

export function UsersAdminTab({
  form,
  setForm,
  roles,
  roleOptions,
  users,
  cemeteryRecords,
  isSaving,
  isResolvingAuth0User,
  togglingUserIds,
  saveUser,
  resolveAuth0SubjectFromForm,
  resetForm,
  toggleUserActive,
}: UsersAdminTabProps) {
  return (
        <>
      <section className="admin-section">
        <div className="section-title">
          <UserCog size={17} aria-hidden="true" />
          <h3>{form.id ? "Edit User" : "Add User"}</h3>
        </div>
        <form className="admin-form" onSubmit={(event) => void saveUser(event)}>
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
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => {
                const role = event.target.value as AppRoleName;
                setForm((current) => ({
                  ...current,
                  role,
                  assignedCemeteryIds: role === "power-user" || role === "cemetery-admin" ? current.assignedCemeteryIds : [],
                }));
              }}
              title={roleDescriptions[form.role]}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role} title={roleDescriptions[role]}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          {form.role === "power-user" || form.role === "cemetery-admin" ? (
            <label>
              Assigned cemetery
              <select
                value={form.assignedCemeteryIds[0] ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    assignedCemeteryIds: event.target.value ? [event.target.value] : [],
                  }))
                }
                required
                title="The cemetery this user can edit. They retain read-only access to other cemeteries."
              >
                <option value="">Select cemetery</option>
                {cemeteryRecords.cemeteries.map((cemetery) => (
                  <option key={cemetery.id} value={cemetery.id}>
                    {cemetery.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
        <div className="admin-table" role="table" aria-label="Application users">
          {users.map((user) => (
            <article key={user.id} className="admin-user-row" title={userTitle(user)}>
              <button type="button" className="admin-user-edit" onClick={() => setForm(userFormFromUser(user))} title={userTitle(user)}>
                <span>
                  <strong>{user.displayName || user.email}</strong>
                  <small>{user.email}</small>
                </span>
                <span title={roleDescriptions[user.role]}>{roleLabel(user.role)}</span>
                <small>{user.assignedCemeteryIds.length ? `${user.assignedCemeteryIds.length} assigned cemeter${user.assignedCemeteryIds.length === 1 ? "y" : "ies"}` : "No cemetery assignment"}</small>
                <span
                  className={user.isActive ? "status-active" : "status-inactive"}
                  title={user.isActive ? "This user can currently access the application." : "This user is blocked from application access."}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </button>
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
              <small title={`There ${role.userCount === 1 ? "is" : "are"} ${role.userCount} active or inactive local user record${role.userCount === 1 ? "" : "s"} assigned to this role.`}>
                {role.userCount} user{role.userCount === 1 ? "" : "s"}
              </small>
            </article>
          ))}
        </div>
      </section>
        </>
  );
}
