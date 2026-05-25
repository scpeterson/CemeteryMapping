import { FormEvent, useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserCog, UserPlus, X } from "lucide-react";
import { createAdminUser, fetchAdminRoles, fetchAdminUsers, resolveAuth0User, type SaveUserInput, updateAdminUser } from "../api/cemeteryApi";
import type { AppRole, AppRoleName, AppUser } from "../types";

type AdminPanelProps = {
  onClose: () => void;
};

type UserFormState = SaveUserInput & {
  id?: string;
};

const blankUser: UserFormState = {
  externalSubject: "",
  email: "",
  displayName: "",
  role: "reader",
  isActive: true,
};

const roleLabels: Record<AppRoleName, string> = {
  reader: "Read-only",
  "power-user": "Power user",
  admin: "Admin",
};

function roleLabel(role: AppRoleName) {
  return roleLabels[role] ?? role;
}

function userFormFromUser(user: AppUser): UserFormState {
  return {
    id: user.id,
    externalSubject: user.externalSubject,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
  };
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [form, setForm] = useState<UserFormState>(blankUser);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolvingAuth0User, setIsResolvingAuth0User] = useState(false);

  const roleOptions = useMemo(() => roles.map((role) => role.name), [roles]);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    Promise.all([fetchAdminRoles(), fetchAdminUsers()])
      .then(([nextRoles, nextUsers]) => {
        if (!isCurrent) return;
        setRoles(nextRoles);
        setUsers(nextUsers);
        setError(undefined);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : "Unable to load admin records.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const resetForm = () => {
    setForm(blankUser);
    setMessage(undefined);
    setError(undefined);
  };

  const resolveAuth0Subject = async (user: UserFormState) => {
    const resolved = await resolveAuth0User({ email: user.email, displayName: user.displayName });
    setForm((current) => ({
      ...current,
      externalSubject: resolved.externalSubject,
      email: resolved.email,
      displayName: current.displayName || resolved.displayName,
    }));
    const invitationStatus = resolved.invitationSent ? " and sent an invitation email" : "";
    setMessage(`${resolved.email} ${resolved.created ? `created in Auth0${invitationStatus}` : "found in Auth0"}.`);
    return {
      ...user,
      externalSubject: resolved.externalSubject,
      email: resolved.email,
      displayName: user.displayName || resolved.displayName,
    };
  };

  const resolveAuth0SubjectFromForm = async () => {
    setIsResolvingAuth0User(true);
    setMessage(undefined);
    setError(undefined);

    try {
      await resolveAuth0Subject(form);
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Unable to find or create Auth0 user.");
    } finally {
      setIsResolvingAuth0User(false);
    }
  };

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(undefined);
    setError(undefined);

    try {
      const userToSave = form.id || form.externalSubject.trim() ? form : await resolveAuth0Subject(form);
      const saved = form.id ? await updateAdminUser(form.id, userToSave) : await createAdminUser(userToSave);
      setUsers((current) => {
        const existingIndex = current.findIndex((user) => user.id === saved.id);
        if (existingIndex === -1) return [...current, saved].sort((a, b) => a.email.localeCompare(b.email));
        return current.map((user) => (user.id === saved.id ? saved : user));
      });
      setForm(userFormFromUser(saved));
      setMessage(`${saved.email} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save user.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="admin-panel" aria-label="Admin management">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>User Access</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close admin panel">
          <X size={18} />
        </button>
      </div>

      {isLoading ? <div className="admin-message" role="status">Loading users and roles...</div> : null}
      {error ? <div className="admin-message is-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-message" role="status">{message}</div> : null}

      <section className="admin-section">
        <div className="section-title">
          <UserCog size={17} aria-hidden="true" />
          <h3>{form.id ? "Edit User" : "Add User"}</h3>
        </div>
        <form className="admin-form" onSubmit={(event) => void saveUser(event)}>
          <label>
            Email
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
          </label>
          <label>
            Display name
            <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} />
          </label>
          <label>
            Auth0 user ID
            <span className="auth0-user-id-row">
              <input
                value={form.externalSubject}
                onChange={(event) => setForm((current) => ({ ...current, externalSubject: event.target.value }))}
              />
              <button
                type="button"
                className="icon-button auth0-resolve-button"
                onClick={() => void resolveAuth0SubjectFromForm()}
                disabled={isResolvingAuth0User || !form.email.trim()}
                aria-label="Find or create Auth0 user"
                title="Find or create Auth0 user"
              >
                <UserPlus size={17} />
              </button>
            </span>
          </label>
          <label>
            Role
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AppRoleName }))}>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            Active user
          </label>
          <div className="admin-form-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save user"}
            </button>
            <button type="button" className="secondary-button" onClick={resetForm}>
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
            <button key={user.id} type="button" className="admin-user-row" onClick={() => setForm(userFormFromUser(user))}>
              <span>
                <strong>{user.displayName || user.email}</strong>
                <small>{user.email}</small>
              </span>
              <span>{roleLabel(user.role)}</span>
              <span className={user.isActive ? "status-active" : "status-inactive"}>{user.isActive ? "Active" : "Inactive"}</span>
            </button>
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
            <article key={role.name} className="role-row">
              <strong>{roleLabel(role.name)}</strong>
              <p>{role.description}</p>
              <small>{role.userCount} user{role.userCount === 1 ? "" : "s"}</small>
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
