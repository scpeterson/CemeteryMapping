import { useDraftState } from "../../hooks/useDraftState";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { SaveUserInput } from "../../api/cemeteryApi";
import { createAdminUser, fetchAdminRoles, fetchAdminUsers, resolveAuth0User, updateAdminUser } from "../../api/cemeteryApi";
import type { AccessRequest } from "../../api/accessRequestsApi";
import type { AppRole, AppUser } from "../../types";
export type UserFormState = SaveUserInput & { id?: string };

const blankUser: UserFormState = {
  externalSubject: "",
  email: "",
  displayName: "",
  role: "reader",
  assignedCemeteryIds: [],
  cemeteryMemberships: [],
  isActive: true,
};

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

export function useUserAdministration() {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [requestRefreshKey, setRequestRefreshKey] = useState(0);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [query, changeQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, changeStatus] = useState("all");
  const [cemeteryFilter, changeCemeteryFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 100;
  const setQuery = (value: string) => { changeQuery(value); setOffset(0); };
  const setStatus = (value: string) => { changeStatus(value); setOffset(0); };
  const setCemeteryFilter = (value: string) => { changeCemeteryFilter(value); setOffset(0); };
  useEffect(() => { const timer = setTimeout(() => setDebouncedQuery(query), 200); return () => clearTimeout(timer); }, [query]);
  const [form, setForm] = useDraftState<UserFormState>(blankUser);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolvingAuth0User, setIsResolvingAuth0User] = useState(false);
  const [togglingUserIds, setTogglingUserIds] = useState<Set<string>>(() => new Set());
  const roleOptions = useMemo(() => roles.map((role) => role.name), [roles]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let current = true;
    fetchAdminRoles().then(roles => { if (current) setRoles(roles); })
      .catch((error: unknown) => { if (current) setError(error instanceof Error ? error.message : "Unable to load roles."); });
    return () => { current = false; };
  }, [requestRefreshKey]);
  useEffect(() => {
    let current = true;
    setIsLoading(true);
    fetchAdminUsers({ q: debouncedQuery, status, cemeteryId: cemeteryFilter, offset, limit: pageSize + 1 })
      .then(users => { if (current) { setUsers(users.slice(0, pageSize)); setHasMore(users.length > pageSize); } })
      .catch((error: unknown) => { if (current) setError(error instanceof Error ? error.message : "Unable to load users."); })
      .finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, [debouncedQuery, status, cemeteryFilter, offset, requestRefreshKey]);

  const prepareAccessRequest = async (request: AccessRequest) => {
    try {
      // An existing account can be outside the current directory page/filter.
      const matches = await fetchAdminUsers({ email: request.email, status: "all" });
      const existing = matches.find(user => user.email.toLowerCase() === request.email.toLowerCase());
      setForm(existing ? { ...userFormFromUser(existing), isActive: true, accessRequestId: request.id } : {
        ...blankUser, email: request.email, displayName: request.displayName, accessRequestId: request.id,
      });
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to load the requested account.");
      return false;
    }
  };

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
      if (form.role !== "admin" && form.assignedCemeteryIds.length === 0) {
        throw new Error("Assigned cemetery is required for this role.");
      }
      const userToSave = form.id || form.externalSubject.trim() ? form : await resolveAuth0Subject(form);
      const saved = form.id ? await updateAdminUser(form.id, userToSave) : await createAdminUser(userToSave);
      setUsers((current) => {
        const existingIndex = current.findIndex((user) => user.id === saved.id);
        if (existingIndex === -1) return [...current, saved].sort((a, b) => a.email.localeCompare(b.email));
        return current.map((user) => (user.id === saved.id ? saved : user));
      });
      setForm(userFormFromUser(saved));
      setMessage(`${saved.email} saved.${userToSave.accessRequestId ? " Access request approved. If an invitation was not sent, arrange password setup before notifying the user." : ""}`);
      setRequestRefreshKey((value) => value + 1);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save user.");
    } finally {
      setIsSaving(false);
    }
  };

  const replaceUser = (saved: AppUser) => {
    setUsers((current) => current.map((user) => (user.id === saved.id ? saved : user)));
    setForm((current) => (current.id === saved.id ? userFormFromUser(saved) : current));
  };

  const toggleUserActive = async (user: AppUser) => {
    setTogglingUserIds((current) => new Set(current).add(user.id));
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateAdminUser(user.id, {
        externalSubject: user.externalSubject,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        assignedCemeteryIds: user.assignedCemeteryIds,
        cemeteryMemberships: user.cemeteryMemberships,
        isActive: !user.isActive,
      });
      replaceUser(saved);
      setRequestRefreshKey(value => value + 1);
      setMessage(`${saved.email} ${saved.isActive ? "reactivated" : "deactivated"}.`);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update user status.");
    } finally {
      setTogglingUserIds((current) => {
        const next = new Set(current);
        next.delete(user.id);
        return next;
      });
    }
  };

  return {
    query, setQuery, status, setStatus, cemeteryFilter, setCemeteryFilter,
    offset, pageSize, hasMore, setOffset, prepareAccessRequest,
    requestRefreshKey,
    form,
    setForm,
    roles,
    roleOptions,
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
  };
}
