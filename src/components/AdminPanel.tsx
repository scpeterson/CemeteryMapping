import { FormEvent, useEffect, useMemo, useState } from "react";
import { FileSearch, History, Landmark, ShieldCheck, UserCheck, UserCog, UserPlus, UserX, X } from "lucide-react";
import {
  createAdminUser,
  fetchAdminAuditEvents,
  fetchAdminRoles,
  fetchAdminUsers,
  fetchCemeteryAdminRecords,
  fetchDeedRegistryReview,
  resolveAuth0User,
  type SaveUserInput,
  updateAdminUser,
  updateCemeteryText,
  updateLotText,
  updateSectionText,
} from "../api/cemeteryApi";
import type {
  AppRole,
  AppRoleName,
  AppUser,
  AuditEvent,
  AuditEventFilters,
  CemeteryAdminRecords,
  CemeteryTextRecord,
  DeedRegistryReview,
  DeedRegistryReviewEntry,
  DeedRegistryReviewFilters,
  LotTextRecord,
  SectionTextRecord,
} from "../types";

type AdminPanelProps = {
  onClose: () => void;
};

type UserFormState = SaveUserInput & {
  id?: string;
};

type AdminTab = "users" | "records" | "deeds" | "audit";

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

const roleDescriptions: Record<AppRoleName, string> = {
  reader: "Read-only users can view map, gravesite, and burial information, but cannot see deed or owner information.",
  "power-user": "Power users can view deed and owner information and update existing cemetery records.",
  admin: "Admins can manage users, add cemetery records, update records, and soft-delete records.",
};

function roleLabel(role: AppRoleName) {
  return roleLabels[role] ?? role;
}

function roleTitle(role: AppRole) {
  return `${roleLabel(role.name)}: ${role.description}`;
}

function userTitle(user: AppUser) {
  return `Edit ${user.displayName || user.email}. Role: ${roleLabel(user.role)}. Status: ${user.isActive ? "active" : "inactive"}.`;
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

const emptyCemeteryRecords: CemeteryAdminRecords = {
  cemeteries: [],
  sections: [],
  lots: [],
};

const defaultAuditFilters: AuditEventFilters = {
  action: "",
  targetTable: "",
  actor: "",
  targetRecordId: "",
  dateFrom: "",
  dateTo: "",
  limit: 50,
};

const defaultDeedReviewFilters: DeedRegistryReviewFilters = {
  batchId: "",
  confidence: "",
  ownershipScope: "",
  q: "",
  limit: 100,
};

const emptyDeedRegistryReview: DeedRegistryReview = {
  batches: [],
  selectedBatchId: "",
  summary: [],
  entries: [],
};

const auditActionLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  soft_delete: "Deleted",
  restore: "Restored",
  delete: "Hard deleted",
  import_promote: "Imported",
};

const auditTableLabels: Record<string, string> = {
  app_roles: "Roles",
  app_users: "Users",
  blocks: "Blocks",
  burials: "Burials",
  cemeteries: "Cemeteries",
  deed_registry_entries: "Deed registry entries",
  deed_registry_entry_allocations: "Deed registry allocations",
  deed_registry_import_batches: "Deed registry imports",
  gravesites: "Gravesites",
  headstone_burials: "Headstone burials",
  headstones: "Headstones",
  lot_owner_parties: "Lot owners",
  lots: "Lots",
  memorials: "Memorials",
  owners: "Owners",
  sections: "Sections",
};

const alternateNamesText = (alternateNames: string[]) => alternateNames.join("\n");
const parseAlternateNames = (value: string) =>
  [...new Set(value.split(/\r?\n|,/u).map((item) => item.trim()).filter(Boolean))];
const cemeteryPickerLabel = (cemetery: CemeteryTextRecord) => cemetery.name;
const sectionPickerLabel = (section: SectionTextRecord) => `Section ${section.name}`;
const lotPickerLabel = (lot: LotTextRecord) => `Lot ${lot.lotId} - ${lot.name}`;
const formatAdminTimestamp = (value: string) => (value ? new Date(value).toLocaleString() : "Not recorded");
const auditActorLabel = (event: AuditEvent) => event.actorEmail || event.actorDatabaseUser || event.actorSessionUser || "Unknown actor";
const auditActionLabel = (action: string) => auditActionLabels[action] ?? action;
const auditTableLabel = (targetTable: string) => auditTableLabels[targetTable] ?? targetTable;
const auditEventSummary = (event: AuditEvent) => {
  if (event.changedFields.length === 0) return event.reason || "No field-level changes recorded";
  const fields = event.changedFields.slice(0, 3).join(", ");
  const suffix = event.changedFields.length > 3 ? ` +${event.changedFields.length - 3} more` : "";
  return `${fields}${suffix}`;
};
const formatAuditJson = (value: Record<string, unknown>) => (Object.keys(value).length ? JSON.stringify(value, null, 2) : "None recorded");
const scopeLabels: Record<string, string> = {
  grave_count_only: "Grave count only",
  multiple_lots: "Multiple lots",
  passage: "Passage",
  section_g_gravesite: "Section G gravesite",
  specific_graves: "Specific graves",
  unknown: "Unknown",
  whole_lot: "Whole lot",
};
const confidenceLabels: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  review: "Review",
};
const deedScopeLabel = (scope: string) => scopeLabels[scope] ?? scope;
const deedConfidenceLabel = (confidence: string) => confidenceLabels[confidence] ?? confidence;
const formatList = (values: string[]) => (values.length ? values.join(", ") : "None");
const deedEntryTitle = (entry: DeedRegistryReviewEntry) =>
  `Row ${entry.sourceRowNumber}. ${entry.ownerDisplayName || "No owner"}. ${deedConfidenceLabel(entry.parseConfidence)} confidence.`;

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditFilters, setAuditFilters] = useState<AuditEventFilters>(defaultAuditFilters);
  const [selectedAuditEventId, setSelectedAuditEventId] = useState("");
  const [deedRegistryReview, setDeedRegistryReview] = useState<DeedRegistryReview>(emptyDeedRegistryReview);
  const [deedReviewFilters, setDeedReviewFilters] = useState<DeedRegistryReviewFilters>(defaultDeedReviewFilters);
  const [cemeteryRecords, setCemeteryRecords] = useState<CemeteryAdminRecords>(emptyCemeteryRecords);
  const [form, setForm] = useState<UserFormState>(blankUser);
  const [selectedCemeteryId, setSelectedCemeteryId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedLotId, setSelectedLotId] = useState("");
  const [cemeteryPickerValue, setCemeteryPickerValue] = useState("");
  const [sectionPickerValue, setSectionPickerValue] = useState("");
  const [lotPickerValue, setLotPickerValue] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAuditEvents, setIsLoadingAuditEvents] = useState(false);
  const [isLoadingDeedReview, setIsLoadingDeedReview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolvingAuth0User, setIsResolvingAuth0User] = useState(false);
  const [togglingUserIds, setTogglingUserIds] = useState<Set<string>>(() => new Set());
  const [savingRecordKey, setSavingRecordKey] = useState<string>();

  const roleOptions = useMemo(() => roles.map((role) => role.name), [roles]);
  const selectedCemetery = useMemo(
    () => cemeteryRecords.cemeteries.find((cemetery) => cemetery.id === selectedCemeteryId),
    [cemeteryRecords.cemeteries, selectedCemeteryId],
  );
  const sectionsForSelectedCemetery = useMemo(
    () => cemeteryRecords.sections.filter((section) => section.cemeteryId === selectedCemeteryId),
    [cemeteryRecords.sections, selectedCemeteryId],
  );
  const selectedSection = useMemo(
    () => sectionsForSelectedCemetery.find((section) => section.id === selectedSectionId),
    [sectionsForSelectedCemetery, selectedSectionId],
  );
  const lotsForSelectedSection = useMemo(
    () => cemeteryRecords.lots.filter((lot) => lot.cemeteryId === selectedCemeteryId && lot.sectionId === selectedSection?.sectionId),
    [cemeteryRecords.lots, selectedCemeteryId, selectedSection?.sectionId],
  );
  const selectedLot = useMemo(
    () => lotsForSelectedSection.find((lot) => lot.id === selectedLotId),
    [lotsForSelectedSection, selectedLotId],
  );
  const selectedAuditEvent = useMemo(
    () => auditEvents.find((event) => event.id === selectedAuditEventId),
    [auditEvents, selectedAuditEventId],
  );
  const selectedDeedBatch = useMemo(
    () => deedRegistryReview.batches.find((batch) => batch.id === deedRegistryReview.selectedBatchId),
    [deedRegistryReview.batches, deedRegistryReview.selectedBatchId],
  );

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    Promise.all([fetchAdminRoles(), fetchAdminUsers(), fetchCemeteryAdminRecords()])
      .then(([nextRoles, nextUsers, nextCemeteryRecords]) => {
        if (!isCurrent) return;
        setRoles(nextRoles);
        setUsers(nextUsers);
        setCemeteryRecords(nextCemeteryRecords);
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

  useEffect(() => {
    if (!cemeteryPickerValue || selectedCemeteryId) return;
    const match = cemeteryRecords.cemeteries.find((cemetery) => cemeteryPickerLabel(cemetery) === cemeteryPickerValue);
    if (match) setSelectedCemeteryId(match.id);
  }, [cemeteryPickerValue, cemeteryRecords.cemeteries, selectedCemeteryId]);

  useEffect(() => {
    if (!sectionPickerValue || selectedSectionId) return;
    const match = sectionsForSelectedCemetery.find(
      (section) => sectionPickerLabel(section) === sectionPickerValue || section.name === sectionPickerValue || section.sectionId === sectionPickerValue,
    );
    if (match) setSelectedSectionId(match.id);
  }, [sectionPickerValue, sectionsForSelectedCemetery, selectedSectionId]);

  useEffect(() => {
    if (!lotPickerValue || selectedLotId) return;
    const match = lotsForSelectedSection.find((lot) => lotPickerLabel(lot) === lotPickerValue || lot.name === lotPickerValue || lot.lotId === lotPickerValue);
    if (match) setSelectedLotId(match.id);
  }, [lotPickerValue, lotsForSelectedSection, selectedLotId]);

  const loadAuditEvents = async (filters = auditFilters) => {
    setIsLoadingAuditEvents(true);
    setError(undefined);

    try {
      const nextAuditEvents = await fetchAdminAuditEvents(filters);
      setAuditEvents(nextAuditEvents);
      setSelectedAuditEventId((current) => (nextAuditEvents.some((event) => event.id === current) ? current : (nextAuditEvents[0]?.id ?? "")));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load audit events.");
    } finally {
      setIsLoadingAuditEvents(false);
    }
  };

  const updateAuditFilter = (patch: Partial<AuditEventFilters>) => {
    setAuditFilters((current) => ({ ...current, ...patch }));
  };

  const applyAuditFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadAuditEvents(auditFilters);
  };

  const openAuditTab = () => {
    setActiveTab("audit");
    if (auditEvents.length === 0 && !isLoadingAuditEvents) void loadAuditEvents();
  };

  const loadDeedRegistryReview = async (filters = deedReviewFilters) => {
    setIsLoadingDeedReview(true);
    setError(undefined);

    try {
      const nextReview = await fetchDeedRegistryReview(filters);
      setDeedRegistryReview(nextReview);
      setDeedReviewFilters((current) => ({ ...current, batchId: nextReview.selectedBatchId }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load deed registry evidence.");
    } finally {
      setIsLoadingDeedReview(false);
    }
  };

  const updateDeedReviewFilter = (patch: Partial<DeedRegistryReviewFilters>) => {
    setDeedReviewFilters((current) => ({ ...current, ...patch }));
  };

  const applyDeedReviewFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadDeedRegistryReview(deedReviewFilters);
  };

  const openDeedReviewTab = () => {
    setActiveTab("deeds");
    if (deedRegistryReview.batches.length === 0 && !isLoadingDeedReview) void loadDeedRegistryReview();
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
        isActive: !user.isActive,
      });
      replaceUser(saved);
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

  const updateCemeteryRecord = (id: string, patch: Partial<CemeteryTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      cemeteries: current.cemeteries.map((cemetery) => (cemetery.id === id ? { ...cemetery, ...patch } : cemetery)),
    }));
  };

  const updateSectionRecord = (id: string, patch: Partial<SectionTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === id ? { ...section, ...patch } : section)),
    }));
  };

  const updateLotRecord = (id: string, patch: Partial<LotTextRecord>) => {
    setCemeteryRecords((current) => ({
      ...current,
      lots: current.lots.map((lot) => (lot.id === id ? { ...lot, ...patch } : lot)),
    }));
  };

  const saveCemeteryRecord = async (cemetery: CemeteryTextRecord) => {
    const key = `cemetery:${cemetery.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateCemeteryText(cemetery.id, {
        name: cemetery.name,
        fullAddress: cemetery.fullAddress,
        municipality: cemetery.municipality,
        agency: cemetery.agency,
        agencyUrl: cemetery.agencyUrl,
        operationalHours: cemetery.operationalHours,
        contactName: cemetery.contactName,
        contactPhone: cemetery.contactPhone,
        contactEmail: cemetery.contactEmail,
        imageUrl: cemetery.imageUrl,
        notes: cemetery.notes,
      });
      updateCemeteryRecord(saved.id, saved);
      if (saved.id === selectedCemeteryId) setCemeteryPickerValue(cemeteryPickerLabel(saved));
      setMessage(`${saved.name} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save cemetery.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const saveSectionRecord = async (section: SectionTextRecord) => {
    const key = `section:${section.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateSectionText(section.id, { name: section.name, alternateNames: section.alternateNames, notes: section.notes });
      updateSectionRecord(saved.id, saved);
      if (saved.id === selectedSectionId) setSectionPickerValue(sectionPickerLabel(saved));
      setMessage(`Section ${saved.sectionId} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save section.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const saveLotRecord = async (lot: LotTextRecord) => {
    const key = `lot:${lot.id}`;
    setSavingRecordKey(key);
    setMessage(undefined);
    setError(undefined);

    try {
      const saved = await updateLotText(lot.id, { name: lot.name });
      updateLotRecord(saved.id, saved);
      if (saved.id === selectedLotId) setLotPickerValue(lotPickerLabel(saved));
      setMessage(`Lot ${saved.lotId} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save lot.");
    } finally {
      setSavingRecordKey(undefined);
    }
  };

  const selectCemeteryById = (id: string) => {
    const match = cemeteryRecords.cemeteries.find((cemetery) => cemetery.id === id);
    setSelectedCemeteryId(match?.id ?? "");
    setCemeteryPickerValue(match ? cemeteryPickerLabel(match) : "");
    setSelectedSectionId("");
    setSelectedLotId("");
    setSectionPickerValue("");
    setLotPickerValue("");
  };

  const selectSectionById = (id: string) => {
    const match = sectionsForSelectedCemetery.find((section) => section.id === id);
    setSelectedSectionId(match?.id ?? "");
    setSectionPickerValue(match ? sectionPickerLabel(match) : "");
    setSelectedLotId("");
    setLotPickerValue("");
  };

  const selectLotById = (id: string) => {
    const match = lotsForSelectedSection.find((lot) => lot.id === id);
    setSelectedLotId(match?.id ?? "");
    setLotPickerValue(match ? lotPickerLabel(match) : "");
  };

  return (
    <aside className="admin-panel" aria-label="Admin management">
      <div className="admin-panel-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Administration</h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close admin panel" title="Close the admin panel.">
          <X size={18} />
        </button>
      </div>

      {isLoading ? <div className="admin-message" role="status">Loading admin records...</div> : null}
      {error ? <div className="admin-message is-error" role="alert">{error}</div> : null}
      {message ? <div className="admin-message" role="status">{message}</div> : null}

      <div className="admin-tabs" role="tablist" aria-label="Admin sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "users"}
          className={activeTab === "users" ? "is-active" : undefined}
          onClick={() => setActiveTab("users")}
          title="Manage application users and role assignments."
        >
          Users
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "records"}
          className={activeTab === "records" ? "is-active" : undefined}
          onClick={() => setActiveTab("records")}
          title="Edit cemetery, section, and lot text records."
        >
          Cemetery Records
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "deeds"}
          className={activeTab === "deeds" ? "is-active" : undefined}
          onClick={openDeedReviewTab}
          title="Review staged deed registry imports before promotion."
        >
          Deed Evidence
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "audit"}
          className={activeTab === "audit" ? "is-active" : undefined}
          onClick={openAuditTab}
          title="Review create, update, delete, and restore audit events."
        >
          Audit Log
        </button>
      </div>

      {activeTab === "users" ? (
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
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as AppRoleName }))}
              title={roleDescriptions[form.role]}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role} title={roleDescriptions[role]}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>
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
      ) : activeTab === "records" ? (
        <>
          <section className="admin-section">
            <div className="section-title">
              <Landmark size={17} aria-hidden="true" />
              <h3>Cemetery Records</h3>
            </div>

            <div className="record-picker-grid">
              <label className="record-picker">
                Cemetery
                <select
                  value={selectedCemeteryId}
                  onChange={(event) => selectCemeteryById(event.target.value)}
                  title="Search for and select the cemetery record to edit."
                >
                  <option value="">Select cemetery</option>
                  {cemeteryRecords.cemeteries.map((cemetery) => (
                    <option key={cemetery.id} value={cemetery.id}>
                      {cemeteryPickerLabel(cemetery)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedCemetery ? (
                <label className="record-picker">
                  Section
                  <select
                    value={selectedSectionId}
                    onChange={(event) => selectSectionById(event.target.value)}
                    title="Search for and select a section in the selected cemetery."
                  >
                    <option value="">Select section</option>
                    {sectionsForSelectedCemetery.map((section) => (
                      <option key={section.id} value={section.id}>
                        {sectionPickerLabel(section)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedSection ? (
                <label className="record-picker">
                  Lot
                  <select
                    value={selectedLotId}
                    onChange={(event) => selectLotById(event.target.value)}
                    title="Search for and select a lot in the selected section."
                  >
                    <option value="">Select lot</option>
                    {lotsForSelectedSection.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lotPickerLabel(lot)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="record-editor-list">
              {selectedCemetery ? (
                <article className="record-editor-row record-editor-row-cemetery">
                  <h4>Cemetery</h4>
                  <label className="record-editor-name">
                    Name
                    <input
                      value={selectedCemetery.name}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { name: event.target.value })}
                      title="The cemetery name shown on the map, search results, and cemetery marker."
                    />
                  </label>
                  <label>
                    Full address
                    <input
                      value={selectedCemetery.fullAddress}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { fullAddress: event.target.value })}
                      title="The cemetery's street address or full mailing/location address."
                    />
                  </label>
                  <label>
                    Municipality
                    <input
                      value={selectedCemetery.municipality}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { municipality: event.target.value })}
                      title="The municipality where the cemetery is located."
                    />
                  </label>
                  <label>
                    Agency
                    <input
                      value={selectedCemetery.agency}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { agency: event.target.value })}
                      title="The agency or organization associated with the cemetery."
                    />
                  </label>
                  <label>
                    Agency URL
                    <input
                      value={selectedCemetery.agencyUrl}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { agencyUrl: event.target.value })}
                      title="The agency website URL associated with the cemetery."
                    />
                  </label>
                  <label>
                    Operational hours
                    <input
                      value={selectedCemetery.operationalHours}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { operationalHours: event.target.value })}
                      title="Public or operational hours for the cemetery."
                    />
                  </label>
                  <label>
                    Contact name
                    <input
                      value={selectedCemetery.contactName}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactName: event.target.value })}
                      title="Primary contact person for this cemetery record."
                    />
                  </label>
                  <label>
                    Contact phone
                    <input
                      value={selectedCemetery.contactPhone}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactPhone: event.target.value })}
                      title="Primary contact phone number for this cemetery record."
                    />
                  </label>
                  <label>
                    Contact email
                    <input
                      value={selectedCemetery.contactEmail}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { contactEmail: event.target.value })}
                      title="Primary contact email address for this cemetery record."
                    />
                  </label>
                  <label>
                    Image URL
                    <input
                      value={selectedCemetery.imageUrl}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { imageUrl: event.target.value })}
                      title="URL for an image associated with this cemetery."
                    />
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={selectedCemetery.notes}
                      onChange={(event) => updateCemeteryRecord(selectedCemetery.id, { notes: event.target.value })}
                      rows={8}
                      title="Administrative notes stored with the cemetery record."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Cemetery audit timestamps">
                    <div title="When this cemetery record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedCemetery.createdAt)}</dd>
                    </div>
                    <div title="When this cemetery record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedCemetery.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveCemeteryRecord(selectedCemetery)}
                    disabled={savingRecordKey === `cemetery:${selectedCemetery.id}` || !selectedCemetery.name.trim()}
                    title="Save this cemetery text."
                  >
                    {savingRecordKey === `cemetery:${selectedCemetery.id}` ? "Saving..." : "Save cemetery"}
                  </button>
                </article>
              ) : (
                <p className="record-editor-empty">Select a cemetery to edit its text records.</p>
              )}

              {selectedCemetery && sectionsForSelectedCemetery.length === 0 ? (
                <p className="record-editor-empty">No sections are available for this cemetery.</p>
              ) : null}

              {selectedSection ? (
                <article className="record-editor-row record-editor-row-section">
                  <h4>Section</h4>
                  <label>
                    Name
                    <input
                      value={selectedSection.name}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { name: event.target.value })}
                      title="The section display name shown on the map label."
                    />
                  </label>
                  <label>
                    Alternate names
                    <textarea
                      value={alternateNamesText(selectedSection.alternateNames)}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { alternateNames: parseAlternateNames(event.target.value) })}
                      rows={3}
                      title="Alternate section names, one per line or separated by commas. For example: OC and Original Cemetery."
                    />
                  </label>
                  <label className="record-editor-notes">
                    Notes
                    <textarea
                      value={selectedSection.notes}
                      onChange={(event) => updateSectionRecord(selectedSection.id, { notes: event.target.value })}
                      rows={6}
                      title="Administrative notes stored with the section record."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Section audit timestamps">
                    <div title="When this section record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedSection.createdAt)}</dd>
                    </div>
                    <div title="When this section record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedSection.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveSectionRecord(selectedSection)}
                    disabled={savingRecordKey === `section:${selectedSection.id}`}
                    title="Save this section name and alternate names."
                  >
                    {savingRecordKey === `section:${selectedSection.id}` ? "Saving..." : "Save section"}
                  </button>
                </article>
              ) : null}

              {selectedSection && lotsForSelectedSection.length === 0 ? (
                <p className="record-editor-empty">No lots are available for this section.</p>
              ) : null}

              {selectedLot ? (
                <article className="record-editor-row record-editor-row-lot">
                  <h4>Lot</h4>
                  <label>
                    Name
                    <input
                      value={selectedLot.name}
                      onChange={(event) => updateLotRecord(selectedLot.id, { name: event.target.value })}
                      title="The lot display name shown on the map label."
                    />
                  </label>
                  <dl className="record-audit-fields" aria-label="Lot audit timestamps">
                    <div title="When this lot record was created. This field cannot be edited here.">
                      <dt>Created</dt>
                      <dd>{formatAdminTimestamp(selectedLot.createdAt)}</dd>
                    </div>
                    <div title="When this lot record was last updated. This field cannot be edited here.">
                      <dt>Updated</dt>
                      <dd>{formatAdminTimestamp(selectedLot.updatedAt)}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    onClick={() => void saveLotRecord(selectedLot)}
                    disabled={savingRecordKey === `lot:${selectedLot.id}`}
                    title="Save this lot text."
                  >
                    {savingRecordKey === `lot:${selectedLot.id}` ? "Saving..." : "Save lot"}
                  </button>
                </article>
              ) : null}
            </div>
          </section>
        </>
      ) : activeTab === "deeds" ? (
        <>
          <section className="admin-section">
            <div className="section-title">
              <FileSearch size={17} aria-hidden="true" />
              <h3>Deed Evidence</h3>
            </div>

            <form className="deed-review-filter-form" onSubmit={applyDeedReviewFilters}>
              <label>
                Import batch
                <select
                  value={deedReviewFilters.batchId ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ batchId: event.target.value })}
                  title="Choose the staged deed registry import batch to review."
                >
                  <option value="">Latest batch</option>
                  {deedRegistryReview.batches.map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.worksheetName} - {formatAdminTimestamp(batch.createdAt)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Confidence
                <select
                  value={deedReviewFilters.confidence ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ confidence: event.target.value })}
                  title="Filter rows by parser confidence."
                >
                  <option value="">All confidence levels</option>
                  {Object.entries(confidenceLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Evidence type
                <select
                  value={deedReviewFilters.ownershipScope ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ ownershipScope: event.target.value })}
                  title="Filter rows by the staged ownership or allocation interpretation."
                >
                  <option value="">All evidence types</option>
                  {Object.entries(scopeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Search
                <input
                  value={deedReviewFilters.q ?? ""}
                  onChange={(event) => updateDeedReviewFilter({ q: event.target.value })}
                  placeholder="Owner, lot, section, or remarks"
                  title="Search staged owner names, lot text, section text, and remarks."
                />
              </label>
              <label>
                Limit
                <select
                  value={deedReviewFilters.limit ?? 100}
                  onChange={(event) => updateDeedReviewFilter({ limit: Number(event.target.value) })}
                  title="Limit the number of evidence rows returned."
                >
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                  <option value={250}>250 rows</option>
                </select>
              </label>
              <div className="admin-form-actions deed-review-filter-actions">
                <button type="submit" disabled={isLoadingDeedReview} title="Apply deed evidence filters.">
                  {isLoadingDeedReview ? "Loading..." : "Apply filters"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setDeedReviewFilters(defaultDeedReviewFilters);
                    void loadDeedRegistryReview(defaultDeedReviewFilters);
                  }}
                  title="Clear deed evidence filters and reload the latest import batch."
                >
                  Clear
                </button>
              </div>
            </form>

            {isLoadingDeedReview ? <div className="admin-message" role="status">Loading deed evidence...</div> : null}

            {selectedDeedBatch ? (
              <article className="deed-batch-summary" title="Summary of the selected staged import batch.">
                <div>
                  <strong>{selectedDeedBatch.sourceName}</strong>
                  <small>{selectedDeedBatch.cemeteryName} · {selectedDeedBatch.worksheetName}</small>
                </div>
                <dl>
                  <div>
                    <dt>Rows</dt>
                    <dd>{selectedDeedBatch.entryCount}</dd>
                  </div>
                  <div>
                    <dt>Review</dt>
                    <dd>{selectedDeedBatch.reviewCount}</dd>
                  </div>
                  <div>
                    <dt>Low</dt>
                    <dd>{selectedDeedBatch.lowConfidenceCount}</dd>
                  </div>
                  <div>
                    <dt>Imported</dt>
                    <dd>{formatAdminTimestamp(selectedDeedBatch.createdAt)}</dd>
                  </div>
                </dl>
                {selectedDeedBatch.notes ? <p>{selectedDeedBatch.notes}</p> : null}
              </article>
            ) : null}

            {deedRegistryReview.summary.length ? (
              <div className="deed-summary-grid" aria-label="Deed evidence summary">
                {deedRegistryReview.summary.map((item) => (
                  <article key={`${item.ownershipScope}:${item.parseConfidence}`} title={`${deedScopeLabel(item.ownershipScope)} rows with ${deedConfidenceLabel(item.parseConfidence)} confidence.`}>
                    <strong>{item.count}</strong>
                    <span>{deedScopeLabel(item.ownershipScope)}</span>
                    <small>{deedConfidenceLabel(item.parseConfidence)}</small>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="deed-entry-list" role="table" aria-label="Staged deed registry evidence">
              {deedRegistryReview.entries.length === 0 && !isLoadingDeedReview ? <p className="record-editor-empty">No deed evidence rows match these filters.</p> : null}
              {deedRegistryReview.entries.map((entry) => (
                <article key={entry.id} className={`deed-entry-row confidence-${entry.parseConfidence}`} title={deedEntryTitle(entry)}>
                  <header>
                    <span>
                      <strong>Row {entry.sourceRowNumber}</strong>
                      <small>{entry.rowType === "investigation_note" ? "Investigation note" : "Owner record"}</small>
                    </span>
                    <span>
                      <strong>{entry.ownerDisplayName || "No owner"}</strong>
                      <small>{deedConfidenceLabel(entry.parseConfidence)}</small>
                    </span>
                    <span>
                      <strong>{deedScopeLabel(entry.ownershipScope)}</strong>
                      <small>{entry.allocationCount} allocation{entry.allocationCount === 1 ? "" : "s"}</small>
                    </span>
                  </header>
                  <dl className="deed-entry-fields">
                    <div title="Raw lot or plot text from the worksheet.">
                      <dt>Raw lot</dt>
                      <dd>{entry.rawLotText || "None"}</dd>
                    </div>
                    <div title="Raw section text from the worksheet.">
                      <dt>Raw section</dt>
                      <dd>{entry.rawSectionText || "None"}</dd>
                    </div>
                    <div title="Parsed lot numbers staged from this row.">
                      <dt>Lots</dt>
                      <dd>{formatList(entry.parsedLotNumbers)}</dd>
                    </div>
                    <div title="Parsed gravesite numbers staged from this row.">
                      <dt>Graves</dt>
                      <dd>{formatList(entry.parsedGraveNumbers)}</dd>
                    </div>
                    <div title="Whether a deed was found in the source worksheet.">
                      <dt>Deed</dt>
                      <dd>{entry.deedOnFile || "Unknown"}</dd>
                    </div>
                    <div title="Whether a deed register entry was found in the source worksheet.">
                      <dt>Register</dt>
                      <dd>{entry.deedRegisterOnFile || "Unknown"}</dd>
                    </div>
                  </dl>
                  {entry.rawRemarks ? <p className="deed-entry-remarks">{entry.rawRemarks}</p> : null}
                  {entry.parseNotes.length ? (
                    <ul className="deed-entry-notes" aria-label="Parser notes">
                      {entry.parseNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                  {entry.relatedInvestigationNotes.length ? (
                    <section className="deed-investigation-links" aria-label="Related investigation notes">
                      <h4>Related investigation notes</h4>
                      {entry.relatedInvestigationNotes.map((note) => (
                        <p key={`${note.sourceRowNumber}:${note.rawRemarks}`}>
                          <strong>Investigated row {note.sourceRowNumber}:</strong> {note.rawRemarks}
                        </p>
                      ))}
                    </section>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="admin-section">
            <div className="section-title">
              <History size={17} aria-hidden="true" />
              <h3>Audit Log</h3>
            </div>

            <form className="audit-filter-form" onSubmit={applyAuditFilters}>
              <label>
                Date from
                <input
                  type="date"
                  value={auditFilters.dateFrom ?? ""}
                  onChange={(event) => updateAuditFilter({ dateFrom: event.target.value })}
                  title="Show audit events that occurred on or after this date."
                />
              </label>
              <label>
                Date to
                <input
                  type="date"
                  value={auditFilters.dateTo ?? ""}
                  onChange={(event) => updateAuditFilter({ dateTo: event.target.value })}
                  title="Show audit events that occurred on or before this date."
                />
              </label>
              <label>
                Operation
                <select
                  value={auditFilters.action ?? ""}
                  onChange={(event) => updateAuditFilter({ action: event.target.value })}
                  title="Filter audit events by operation type."
                >
                  <option value="">All operations</option>
                  {Object.entries(auditActionLabels).map(([action, label]) => (
                    <option key={action} value={action}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Entity
                <select
                  value={auditFilters.targetTable ?? ""}
                  onChange={(event) => updateAuditFilter({ targetTable: event.target.value })}
                  title="Filter audit events by table or entity type."
                >
                  <option value="">All entities</option>
                  {Object.entries(auditTableLabels).map(([table, label]) => (
                    <option key={table} value={table}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Actor
                <input
                  value={auditFilters.actor ?? ""}
                  onChange={(event) => updateAuditFilter({ actor: event.target.value })}
                  placeholder="Email or database user"
                  title="Filter by application user email, Auth0 subject, database user, or database session user."
                />
              </label>
              <label>
                Record ID
                <input
                  value={auditFilters.targetRecordId ?? ""}
                  onChange={(event) => updateAuditFilter({ targetRecordId: event.target.value })}
                  placeholder="Target record ID"
                  title="Filter by the audited record identifier."
                />
              </label>
              <label>
                Limit
                <select
                  value={auditFilters.limit ?? 50}
                  onChange={(event) => updateAuditFilter({ limit: Number(event.target.value) })}
                  title="Limit the number of audit events returned."
                >
                  <option value={25}>25 events</option>
                  <option value={50}>50 events</option>
                  <option value={100}>100 events</option>
                </select>
              </label>
              <div className="admin-form-actions audit-filter-actions">
                <button type="submit" disabled={isLoadingAuditEvents} title="Apply audit log filters.">
                  {isLoadingAuditEvents ? "Loading..." : "Apply filters"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setAuditFilters(defaultAuditFilters);
                    void loadAuditEvents(defaultAuditFilters);
                  }}
                  title="Clear all audit log filters and reload recent events."
                >
                  Clear
                </button>
              </div>
            </form>

            {isLoadingAuditEvents ? <div className="admin-message" role="status">Loading audit events...</div> : null}

            <div className="audit-log-layout">
              <div className="audit-event-list" role="table" aria-label="Audit events">
                {auditEvents.length === 0 && !isLoadingAuditEvents ? <p className="record-editor-empty">No audit events match these filters.</p> : null}
                {auditEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className={event.id === selectedAuditEventId ? "audit-event-row is-selected" : "audit-event-row"}
                    onClick={() => setSelectedAuditEventId(event.id)}
                    title="Show the old and new values captured for this audit event."
                  >
                    <span>
                      <strong>{formatAdminTimestamp(event.occurredAt)}</strong>
                      <small>{auditActorLabel(event)}</small>
                    </span>
                    <span>{auditActionLabel(event.action)}</span>
                    <span>
                      <strong>{auditTableLabel(event.targetTable)}</strong>
                      <small>{event.targetRecordId || "No record ID"}</small>
                    </span>
                    <span>{auditEventSummary(event)}</span>
                  </button>
                ))}
              </div>

              {selectedAuditEvent ? (
                <article className="audit-event-detail" aria-label="Selected audit event detail">
                  <h4>{auditActionLabel(selectedAuditEvent.action)} {auditTableLabel(selectedAuditEvent.targetTable)}</h4>
                  <dl className="audit-detail-grid">
                    <div title="The application user or database user responsible for this event.">
                      <dt>Actor</dt>
                      <dd>{auditActorLabel(selectedAuditEvent)}</dd>
                    </div>
                    <div title="Whether the change came from the API, an import, or direct database access.">
                      <dt>Source</dt>
                      <dd>{selectedAuditEvent.source || "Unknown"}</dd>
                    </div>
                    <div title="The PostgreSQL current_user captured by the audit trigger.">
                      <dt>Database user</dt>
                      <dd>{selectedAuditEvent.actorDatabaseUser || "Not recorded"}</dd>
                    </div>
                    <div title="The PostgreSQL session_user captured by the audit trigger.">
                      <dt>Session user</dt>
                      <dd>{selectedAuditEvent.actorSessionUser || "Not recorded"}</dd>
                    </div>
                    <div title="The changed fields reported by the audit trigger.">
                      <dt>Changed fields</dt>
                      <dd>{selectedAuditEvent.changedFields.length ? selectedAuditEvent.changedFields.join(", ") : "None recorded"}</dd>
                    </div>
                    <div title="The reason supplied by the application or database session, when available.">
                      <dt>Reason</dt>
                      <dd>{selectedAuditEvent.reason || "None recorded"}</dd>
                    </div>
                  </dl>
                  <div className="audit-value-grid">
                    <section>
                      <h5>Old values</h5>
                      <pre>{formatAuditJson(selectedAuditEvent.previousValues)}</pre>
                    </section>
                    <section>
                      <h5>New values</h5>
                      <pre>{formatAuditJson(selectedAuditEvent.newValues)}</pre>
                    </section>
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        </>
      )}
    </aside>
  );
}
