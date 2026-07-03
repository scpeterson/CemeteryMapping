import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, History } from "lucide-react";
import {
  fetchAdminAuditEvents,
  fetchAuditRetentionPolicy,
  fetchSystemEventRetentionPolicy,
  fetchSystemEvents,
  runAuditRetentionPurge,
  runSystemEventRetentionPurge,
  type SaveAuditRetentionPolicyInput,
  type SaveSystemEventRetentionPolicyInput,
  updateAuditRetentionPolicy,
  updateSystemEventRetentionPolicy,
} from "../api/cemeteryApi";
import { defaultAuditFilters } from "./AdminEventDefaults";
import type {
  AuditEvent,
  AuditEventFilters,
  AuditRetentionPolicy,
  AuditRetentionPurgeResult,
  SystemEvent,
  SystemEventFilters,
  SystemEventRetentionPolicy,
  SystemEventRetentionPurgeResult,
} from "../types";

type AdminEventTabProps = {
  onError: (message: string | undefined) => void;
  onMessage: (message: string | undefined) => void;
};

type AuditAdminTabProps = AdminEventTabProps & {
  seedFilters?: AuditEventFilters;
};

const defaultSystemEventFilters: SystemEventFilters = {
  eventType: "",
  severity: "",
  source: "",
  status: "",
  q: "",
  dateFrom: "",
  dateTo: "",
  limit: 50,
};

const defaultAuditRetentionPolicy: AuditRetentionPolicy = {
  retentionDays: 2555,
  minimumProtectedDays: 365,
  batchSize: 5000,
  isEnabled: true,
  createdAt: "",
  updatedAt: "",
};

const defaultSystemEventRetentionPolicy: SystemEventRetentionPolicy = {
  retentionDays: 365,
  minimumProtectedDays: 30,
  batchSize: 5000,
  isEnabled: true,
  createdAt: "",
  updatedAt: "",
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
  app_user_cemetery_access: "User cemetery assignments",
  audit_retention_policies: "Audit retention policies",
  blocks: "Blocks",
  burials: "Burials",
  burial_interment_types: "Burial interment types",
  burial_record_status_types: "Burial record statuses",
  cemeteries: "Cemeteries",
  deed_registry_entries: "Deed registry entries",
  deed_registry_entry_allocations: "Deed registry allocations",
  deed_registry_import_batches: "Deed registry imports",
  deed_investigation_case_entries: "Deed investigation evidence",
  deed_investigation_case_actions: "Deed investigation actions",
  deed_investigation_cases: "Deed investigation cases",
  grave_feature_material_types: "Grave feature materials",
  grave_feature_placement_types: "Grave feature placements",
  grave_feature_subtypes: "Grave feature subtypes",
  grave_feature_types: "Grave feature types",
  grave_features: "Grave features",
  gravesites: "Gravesites",
  gravesite_status_types: "Gravesite statuses",
  headstone_burials: "Headstone burials",
  headstone_condition_types: "Headstone conditions",
  headstone_gravesites: "Headstone gravesites",
  headstone_relationships: "Headstone relationships",
  headstones: "Headstones",
  lot_owner_parties: "Lot owners",
  lot_ownership_event_types: "Lot ownership events",
  lots: "Lots",
  marker_material_types: "Marker materials",
  marker_types: "Marker types",
  maintenance_action_types: "Maintenance action types",
  maintenance_issue_types: "Maintenance issue types",
  maintenance_priority_types: "Maintenance priorities",
  maintenance_records: "Maintenance records",
  military_branch_types: "Military branches",
  military_rank_types: "Military ranks",
  military_war_service_types: "Military war service",
  memorials: "Memorials",
  north_hills_ocr_source_facts: "North Hills source facts",
  north_hills_ocr_entries: "North Hills OCR readings",
  north_hills_ocr_entry_gravesite_links: "North Hills gravesite evidence links",
  north_hills_ocr_entry_headstone_links: "North Hills headstone evidence links",
  north_hills_ocr_import_batches: "North Hills OCR imports",
  owners: "Owners",
  sections: "Sections",
  system_event_retention_policies: "System event retention policies",
};

const systemEventTypeLabels: Record<string, string> = {
  error: "Error",
  warning: "Warning",
  job_run: "Job run",
  health_check: "Health check",
  integration_failure: "Integration failure",
};

const systemEventSeverityLabels: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
};

const systemEventStatusLabels: Record<string, string> = {
  started: "Started",
  succeeded: "Succeeded",
  failed: "Failed",
  degraded: "Degraded",
  reported: "Reported",
  resolved: "Resolved",
};

const formatAdminTimestamp = (value: string) => (value ? new Date(value).toLocaleString() : "Not recorded");
const auditActorLabel = (event: AuditEvent) => event.actorEmail || event.actorDatabaseUser || event.actorSessionUser || "Unknown actor";
const auditActionLabel = (action: string) => auditActionLabels[action] ?? action;
const auditTableLabel = (targetTable: string) => auditTableLabels[targetTable] ?? targetTable;
const formatAuditJson = (value: Record<string, unknown>) => (Object.keys(value).length ? JSON.stringify(value, null, 2) : "None recorded");
const systemEventTypeLabel = (eventType: string) => systemEventTypeLabels[eventType] ?? eventType;
const systemEventSeverityLabel = (severity: string) => systemEventSeverityLabels[severity] ?? severity;
const systemEventStatusLabel = (status: string) => systemEventStatusLabels[status] ?? (status || "No status");

const auditEventSummary = (event: AuditEvent) => {
  if (event.changedFields.length === 0) return event.reason || "No field-level changes recorded";
  const fields = event.changedFields.slice(0, 3).join(", ");
  const suffix = event.changedFields.length > 3 ? ` +${event.changedFields.length - 3} more` : "";
  return `${fields}${suffix}`;
};

const systemEventSummary = (event: SystemEvent) => {
  const parts = [event.source, event.status ? systemEventStatusLabel(event.status) : "", event.requestPath].filter(Boolean);
  return parts.length ? parts.join(" - ") : "No operational context recorded";
};

function retentionResultText(result: AuditRetentionPurgeResult | SystemEventRetentionPurgeResult) {
  return `Cutoff ${formatAdminTimestamp(result.cutoffAt)} - deleted ${result.deletedCount.toLocaleString()}`;
}

export function SystemEventsAdminTab({ onError, onMessage }: AdminEventTabProps) {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [filters, setFilters] = useState<SystemEventFilters>(defaultSystemEventFilters);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [retentionPolicy, setRetentionPolicy] = useState<SystemEventRetentionPolicy>(defaultSystemEventRetentionPolicy);
  const [retentionForm, setRetentionForm] = useState<SaveSystemEventRetentionPolicyInput>({
    retentionDays: defaultSystemEventRetentionPolicy.retentionDays,
    minimumProtectedDays: defaultSystemEventRetentionPolicy.minimumProtectedDays,
    batchSize: defaultSystemEventRetentionPolicy.batchSize,
    isEnabled: defaultSystemEventRetentionPolicy.isEnabled,
    reason: "",
  });
  const [purgeResult, setPurgeResult] = useState<SystemEventRetentionPurgeResult>();
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [isPurgingEvents, setIsPurgingEvents] = useState(false);
  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);

  const updateFilter = (patch: Partial<SystemEventFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const updateRetentionForm = (patch: Partial<SaveSystemEventRetentionPolicyInput>) => setRetentionForm((current) => ({ ...current, ...patch }));

  const loadEvents = async (nextFilters = filters) => {
    setIsLoadingEvents(true);
    onError(undefined);
    try {
      const nextEvents = await fetchSystemEvents(nextFilters);
      setEvents(nextEvents);
      setSelectedEventId((current) => (nextEvents.some((event) => event.id === current) ? current : (nextEvents[0]?.id ?? "")));
    } catch (loadError) {
      onError(loadError instanceof Error ? loadError.message : "Unable to load system events.");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const loadPolicy = async () => {
    setIsLoadingPolicy(true);
    onError(undefined);
    try {
      const nextPolicy = await fetchSystemEventRetentionPolicy();
      setRetentionPolicy(nextPolicy);
      setRetentionForm({
        retentionDays: nextPolicy.retentionDays,
        minimumProtectedDays: nextPolicy.minimumProtectedDays,
        batchSize: nextPolicy.batchSize,
        isEnabled: nextPolicy.isEnabled,
        reason: "",
      });
    } catch (loadError) {
      onError(loadError instanceof Error ? loadError.message : "Unable to load system event retention policy.");
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  useEffect(() => {
    void loadEvents(defaultSystemEventFilters);
    void loadPolicy();
    // The system event tab performs an initial load when it is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadEvents(filters);
  };

  const savePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingPolicy(true);
    onError(undefined);
    onMessage(undefined);
    try {
      const updated = await updateSystemEventRetentionPolicy(retentionForm);
      setRetentionPolicy(updated);
      setRetentionForm({
        retentionDays: updated.retentionDays,
        minimumProtectedDays: updated.minimumProtectedDays,
        batchSize: updated.batchSize,
        isEnabled: updated.isEnabled,
        reason: "",
      });
      onMessage("System event retention policy saved.");
      void loadEvents(filters);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "Unable to save system event retention policy.");
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const purgeEventsNow = async () => {
    setIsPurgingEvents(true);
    onError(undefined);
    onMessage(undefined);
    try {
      const result = await runSystemEventRetentionPurge();
      setPurgeResult(result);
      onMessage(`System event purge completed. Deleted ${result.deletedCount.toLocaleString()} event${result.deletedCount === 1 ? "" : "s"}.`);
      void loadEvents(filters);
    } catch (purgeError) {
      onError(purgeError instanceof Error ? purgeError.message : "Unable to purge system events.");
    } finally {
      setIsPurgingEvents(false);
    }
  };

  return (
    <section className="admin-section">
      <div className="section-title">
        <Activity size={17} aria-hidden="true" />
        <h3>System Events</h3>
      </div>

      <form className="audit-retention-panel" onSubmit={savePolicy}>
        <div className="audit-retention-heading">
          <div>
            <h4>System Event Retention</h4>
            <span>Updated {retentionPolicy.updatedAt ? formatAdminTimestamp(retentionPolicy.updatedAt) : "Not recorded"}</span>
          </div>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={retentionForm.isEnabled}
              onChange={(event) => updateRetentionForm({ isEnabled: event.target.checked })}
              title="Enable or disable scheduled system event cleanup."
            />
            Enabled
          </label>
        </div>

        <div className="audit-retention-grid">
          <label>
            Retention days
            <input
              type="number"
              min={retentionForm.minimumProtectedDays}
              max={36500}
              value={retentionForm.retentionDays}
              onChange={(event) => updateRetentionForm({ retentionDays: Number(event.target.value) })}
              title="System events older than this window are eligible for cleanup."
            />
          </label>
          <label>
            Protected days
            <input
              type="number"
              min={30}
              max={36500}
              value={retentionForm.minimumProtectedDays}
              onChange={(event) => updateRetentionForm({ minimumProtectedDays: Number(event.target.value) })}
              title="Minimum retention window allowed by the policy."
            />
          </label>
          <label>
            Batch size
            <input
              type="number"
              min={1}
              max={50000}
              value={retentionForm.batchSize}
              onChange={(event) => updateRetentionForm({ batchSize: Number(event.target.value) })}
              title="Maximum number of system events deleted per purge run."
            />
          </label>
          <label>
            Reason
            <input
              value={retentionForm.reason ?? ""}
              onChange={(event) => updateRetentionForm({ reason: event.target.value })}
              placeholder="Policy update reason"
              title="Reason recorded in the audit log when this policy changes."
            />
          </label>
        </div>

        <div className="admin-form-actions audit-retention-actions">
          <button type="submit" disabled={isSavingPolicy || isLoadingPolicy} title="Save system event retention policy.">
            {isSavingPolicy ? "Saving..." : "Save policy"}
          </button>
          <button type="button" className="secondary-button" onClick={() => void loadPolicy()} disabled={isLoadingPolicy} title="Reload system event retention policy.">
            {isLoadingPolicy ? "Loading..." : "Refresh"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void purgeEventsNow()}
            disabled={isPurgingEvents || !retentionForm.isEnabled}
            title="Run one system event retention purge batch now."
          >
            {isPurgingEvents ? "Purging..." : "Run purge"}
          </button>
          {purgeResult ? <span className="audit-retention-result">{retentionResultText(purgeResult)}</span> : null}
        </div>
      </form>

      <form className="system-event-filter-form" onSubmit={applyFilters}>
        <label>
          Date from
          <input type="date" value={filters.dateFrom ?? ""} onChange={(event) => updateFilter({ dateFrom: event.target.value })} title="Show system events that occurred on or after this date." />
        </label>
        <label>
          Date to
          <input type="date" value={filters.dateTo ?? ""} onChange={(event) => updateFilter({ dateTo: event.target.value })} title="Show system events that occurred on or before this date." />
        </label>
        <label>
          Type
          <select value={filters.eventType ?? ""} onChange={(event) => updateFilter({ eventType: event.target.value })} title="Filter by operational event type.">
            <option value="">All types</option>
            {Object.entries(systemEventTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select value={filters.severity ?? ""} onChange={(event) => updateFilter({ severity: event.target.value })} title="Filter by severity.">
            <option value="">All severities</option>
            {Object.entries(systemEventSeverityLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={filters.status ?? ""} onChange={(event) => updateFilter({ status: event.target.value })} title="Filter job and operational events by status.">
            <option value="">All statuses</option>
            {Object.entries(systemEventStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Source
          <input value={filters.source ?? ""} onChange={(event) => updateFilter({ source: event.target.value })} placeholder="api, api-health, db:purge:audit" title="Filter by event source." />
        </label>
        <label>
          Search
          <input value={filters.q ?? ""} onChange={(event) => updateFilter({ q: event.target.value })} placeholder="Message, detail, path, or actor" title="Search system event message, detail, request path, or actor email." />
        </label>
        <label>
          Limit
          <select value={filters.limit ?? 50} onChange={(event) => updateFilter({ limit: Number(event.target.value) })} title="Limit the number of system events returned.">
            <option value={25}>25 events</option>
            <option value={50}>50 events</option>
            <option value={100}>100 events</option>
          </select>
        </label>
        <div className="admin-form-actions system-event-filter-actions">
          <button type="submit" disabled={isLoadingEvents} title="Apply system event filters.">{isLoadingEvents ? "Loading..." : "Apply filters"}</button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setFilters(defaultSystemEventFilters);
              void loadEvents(defaultSystemEventFilters);
            }}
            title="Clear system event filters and reload recent events."
          >
            Clear
          </button>
        </div>
      </form>

      {isLoadingEvents ? <div className="admin-message" role="status">Loading system events...</div> : null}

      <div className="system-event-layout">
        <div className="system-event-list" role="table" aria-label="System events">
          {events.length === 0 && !isLoadingEvents ? <p className="record-editor-empty">No system events match these filters.</p> : null}
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={event.id === selectedEventId ? `system-event-row is-selected severity-${event.severity}` : `system-event-row severity-${event.severity}`}
              onClick={() => setSelectedEventId(event.id)}
              title="Show details for this system event."
            >
              <span>
                <strong>{formatAdminTimestamp(event.occurredAt)}</strong>
                <small>{systemEventSummary(event)}</small>
              </span>
              <span>{systemEventTypeLabel(event.eventType)}</span>
              <span>{systemEventSeverityLabel(event.severity)}</span>
              <span>{event.message}</span>
            </button>
          ))}
        </div>

        {selectedEvent ? (
          <article className="system-event-detail" aria-label="Selected system event detail">
            <h4>{systemEventTypeLabel(selectedEvent.eventType)} - {selectedEvent.message}</h4>
            <dl className="system-detail-grid">
              <div title="The component or job that emitted the event.">
                <dt>Source</dt>
                <dd>{selectedEvent.source}</dd>
              </div>
              <div title="Operational severity for this event.">
                <dt>Severity</dt>
                <dd>{systemEventSeverityLabel(selectedEvent.severity)}</dd>
              </div>
              <div title="Job or operational status, when available.">
                <dt>Status</dt>
                <dd>{systemEventStatusLabel(selectedEvent.status)}</dd>
              </div>
              <div title="The application environment that emitted the event.">
                <dt>Environment</dt>
                <dd>{selectedEvent.environment || "Not recorded"}</dd>
              </div>
              <div title="HTTP request path, when this event came from the API.">
                <dt>Request</dt>
                <dd>{selectedEvent.requestPath ? `${selectedEvent.requestMethod} ${selectedEvent.requestPath}` : "Not recorded"}</dd>
              </div>
              <div title="HTTP response status, when this event came from the API.">
                <dt>Response</dt>
                <dd>{selectedEvent.responseStatus ?? "Not recorded"}</dd>
              </div>
              <div title="Application user recorded with the event, when available.">
                <dt>Actor</dt>
                <dd>{selectedEvent.actorEmail || selectedEvent.actorRole || "Not recorded"}</dd>
              </div>
              <div title="Elapsed runtime for job events, when available.">
                <dt>Duration</dt>
                <dd>{selectedEvent.durationMs === undefined ? "Not recorded" : `${selectedEvent.durationMs.toLocaleString()} ms`}</dd>
              </div>
            </dl>
            <div className="system-value-grid">
              <section>
                <h5>Detail</h5>
                <pre>{selectedEvent.detail || "None recorded"}</pre>
              </section>
              <section>
                <h5>Metadata</h5>
                <pre>{formatAuditJson(selectedEvent.metadata)}</pre>
              </section>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}

export function AuditAdminTab({ seedFilters, onError, onMessage }: AuditAdminTabProps) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filters, setFilters] = useState<AuditEventFilters>(seedFilters ?? defaultAuditFilters);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [retentionPolicy, setRetentionPolicy] = useState<AuditRetentionPolicy>(defaultAuditRetentionPolicy);
  const [retentionForm, setRetentionForm] = useState<SaveAuditRetentionPolicyInput>({
    retentionDays: defaultAuditRetentionPolicy.retentionDays,
    minimumProtectedDays: defaultAuditRetentionPolicy.minimumProtectedDays,
    batchSize: defaultAuditRetentionPolicy.batchSize,
    isEnabled: defaultAuditRetentionPolicy.isEnabled,
    reason: "",
  });
  const [purgeResult, setPurgeResult] = useState<AuditRetentionPurgeResult>();
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [isPurgingEvents, setIsPurgingEvents] = useState(false);
  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);

  const updateFilter = (patch: Partial<AuditEventFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const updateRetentionForm = (patch: Partial<SaveAuditRetentionPolicyInput>) => setRetentionForm((current) => ({ ...current, ...patch }));

  const loadEvents = async (nextFilters = filters) => {
    setIsLoadingEvents(true);
    onError(undefined);
    try {
      const nextEvents = await fetchAdminAuditEvents(nextFilters);
      setEvents(nextEvents);
      setSelectedEventId((current) => (nextEvents.some((event) => event.id === current) ? current : (nextEvents[0]?.id ?? "")));
    } catch (loadError) {
      onError(loadError instanceof Error ? loadError.message : "Unable to load audit events.");
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const loadPolicy = async () => {
    setIsLoadingPolicy(true);
    onError(undefined);
    try {
      const nextPolicy = await fetchAuditRetentionPolicy();
      setRetentionPolicy(nextPolicy);
      setRetentionForm({
        retentionDays: nextPolicy.retentionDays,
        minimumProtectedDays: nextPolicy.minimumProtectedDays,
        batchSize: nextPolicy.batchSize,
        isEnabled: nextPolicy.isEnabled,
        reason: "",
      });
    } catch (loadError) {
      onError(loadError instanceof Error ? loadError.message : "Unable to load audit retention policy.");
    } finally {
      setIsLoadingPolicy(false);
    }
  };

  useEffect(() => {
    const initialFilters = seedFilters ?? defaultAuditFilters;
    setFilters(initialFilters);
    void loadEvents(initialFilters);
    void loadPolicy();
    // Seed filters intentionally reload audit data only when the parent asks for a new audit view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedFilters]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadEvents(filters);
  };

  const savePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingPolicy(true);
    onError(undefined);
    onMessage(undefined);
    try {
      const updated = await updateAuditRetentionPolicy(retentionForm);
      setRetentionPolicy(updated);
      setRetentionForm({
        retentionDays: updated.retentionDays,
        minimumProtectedDays: updated.minimumProtectedDays,
        batchSize: updated.batchSize,
        isEnabled: updated.isEnabled,
        reason: "",
      });
      onMessage("Audit retention policy saved.");
      void loadEvents(filters);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "Unable to save audit retention policy.");
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const purgeEventsNow = async () => {
    setIsPurgingEvents(true);
    onError(undefined);
    onMessage(undefined);
    try {
      const result = await runAuditRetentionPurge();
      setPurgeResult(result);
      onMessage(`Audit purge completed. Deleted ${result.deletedCount.toLocaleString()} event${result.deletedCount === 1 ? "" : "s"}.`);
      void loadEvents(filters);
    } catch (purgeError) {
      onError(purgeError instanceof Error ? purgeError.message : "Unable to purge audit events.");
    } finally {
      setIsPurgingEvents(false);
    }
  };

  return (
    <section className="admin-section">
      <div className="section-title">
        <History size={17} aria-hidden="true" />
        <h3>Audit Log</h3>
      </div>

      <form className="audit-retention-panel" onSubmit={savePolicy}>
        <div className="audit-retention-heading">
          <div>
            <h4>Audit Retention</h4>
            <span>Updated {retentionPolicy.updatedAt ? formatAdminTimestamp(retentionPolicy.updatedAt) : "Not recorded"}</span>
          </div>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={retentionForm.isEnabled}
              onChange={(event) => updateRetentionForm({ isEnabled: event.target.checked })}
              title="Enable or disable scheduled audit cleanup."
            />
            Enabled
          </label>
        </div>

        <div className="audit-retention-grid">
          <label>
            Retention days
            <input
              type="number"
              min={retentionForm.minimumProtectedDays}
              max={36500}
              value={retentionForm.retentionDays}
              onChange={(event) => updateRetentionForm({ retentionDays: Number(event.target.value) })}
              title="Audit events older than this window are eligible for cleanup."
            />
          </label>
          <label>
            Protected days
            <input
              type="number"
              min={365}
              max={36500}
              value={retentionForm.minimumProtectedDays}
              onChange={(event) => updateRetentionForm({ minimumProtectedDays: Number(event.target.value) })}
              title="Minimum retention window allowed by the policy."
            />
          </label>
          <label>
            Batch size
            <input
              type="number"
              min={1}
              max={50000}
              value={retentionForm.batchSize}
              onChange={(event) => updateRetentionForm({ batchSize: Number(event.target.value) })}
              title="Maximum number of audit events deleted per purge run."
            />
          </label>
          <label>
            Reason
            <input
              value={retentionForm.reason ?? ""}
              onChange={(event) => updateRetentionForm({ reason: event.target.value })}
              placeholder="Policy update reason"
              title="Reason recorded in the audit log when this policy changes."
            />
          </label>
        </div>

        <div className="admin-form-actions audit-retention-actions">
          <button type="submit" disabled={isSavingPolicy || isLoadingPolicy} title="Save audit retention policy.">
            {isSavingPolicy ? "Saving..." : "Save policy"}
          </button>
          <button type="button" className="secondary-button" onClick={() => void loadPolicy()} disabled={isLoadingPolicy} title="Reload audit retention policy.">
            {isLoadingPolicy ? "Loading..." : "Refresh"}
          </button>
          <button type="button" className="secondary-button" onClick={() => void purgeEventsNow()} disabled={isPurgingEvents || !retentionForm.isEnabled} title="Run one audit retention purge batch now.">
            {isPurgingEvents ? "Purging..." : "Run purge"}
          </button>
          {purgeResult ? <span className="audit-retention-result">{retentionResultText(purgeResult)}</span> : null}
        </div>
      </form>

      <form className="audit-filter-form" onSubmit={applyFilters}>
        <label>
          Date from
          <input type="date" value={filters.dateFrom ?? ""} onChange={(event) => updateFilter({ dateFrom: event.target.value })} title="Show audit events that occurred on or after this date." />
        </label>
        <label>
          Date to
          <input type="date" value={filters.dateTo ?? ""} onChange={(event) => updateFilter({ dateTo: event.target.value })} title="Show audit events that occurred on or before this date." />
        </label>
        <label>
          Operation
          <select value={filters.action ?? ""} onChange={(event) => updateFilter({ action: event.target.value })} title="Filter audit events by operation type.">
            <option value="">All operations</option>
            {Object.entries(auditActionLabels).map(([action, label]) => (
              <option key={action} value={action}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Entity
          <select value={filters.targetTable ?? ""} onChange={(event) => updateFilter({ targetTable: event.target.value })} title="Filter audit events by table or entity type.">
            <option value="">All entities</option>
            {Object.entries(auditTableLabels).map(([table, label]) => (
              <option key={table} value={table}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Actor
          <input value={filters.actor ?? ""} onChange={(event) => updateFilter({ actor: event.target.value })} placeholder="Email or database user" title="Filter by application user email, Auth0 subject, database user, or database session user." />
        </label>
        <label>
          Record ID
          <input value={filters.targetRecordId ?? ""} onChange={(event) => updateFilter({ targetRecordId: event.target.value })} placeholder="Target record ID" title="Filter by the audited record identifier." />
        </label>
        <label>
          Limit
          <select value={filters.limit ?? 50} onChange={(event) => updateFilter({ limit: Number(event.target.value) })} title="Limit the number of audit events returned.">
            <option value={25}>25 events</option>
            <option value={50}>50 events</option>
            <option value={100}>100 events</option>
          </select>
        </label>
        <div className="admin-form-actions audit-filter-actions">
          <button type="submit" disabled={isLoadingEvents} title="Apply audit log filters.">{isLoadingEvents ? "Loading..." : "Apply filters"}</button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setFilters(defaultAuditFilters);
              void loadEvents(defaultAuditFilters);
            }}
            title="Clear all audit log filters and reload recent events."
          >
            Clear
          </button>
        </div>
      </form>

      {isLoadingEvents ? <div className="admin-message" role="status">Loading audit events...</div> : null}

      <div className="audit-log-layout">
        <div className="audit-event-list" role="table" aria-label="Audit events">
          {events.length === 0 && !isLoadingEvents ? <p className="record-editor-empty">No audit events match these filters.</p> : null}
          {events.map((event) => (
            <button key={event.id} type="button" className={event.id === selectedEventId ? "audit-event-row is-selected" : "audit-event-row"} onClick={() => setSelectedEventId(event.id)} title="Show the old and new values captured for this audit event.">
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

        {selectedEvent ? (
          <article className="audit-event-detail" aria-label="Selected audit event detail">
            <h4>{auditActionLabel(selectedEvent.action)} {auditTableLabel(selectedEvent.targetTable)}</h4>
            <dl className="audit-detail-grid">
              <div title="The application user or database user responsible for this event.">
                <dt>Actor</dt>
                <dd>{auditActorLabel(selectedEvent)}</dd>
              </div>
              <div title="Whether the change came from the API, an import, or direct database access.">
                <dt>Source</dt>
                <dd>{selectedEvent.source || "Unknown"}</dd>
              </div>
              <div title="The PostgreSQL current_user captured by the audit trigger.">
                <dt>Database user</dt>
                <dd>{selectedEvent.actorDatabaseUser || "Not recorded"}</dd>
              </div>
              <div title="The PostgreSQL session_user captured by the audit trigger.">
                <dt>Session user</dt>
                <dd>{selectedEvent.actorSessionUser || "Not recorded"}</dd>
              </div>
              <div title="The changed fields reported by the audit trigger.">
                <dt>Changed fields</dt>
                <dd>{selectedEvent.changedFields.length ? selectedEvent.changedFields.join(", ") : "None recorded"}</dd>
              </div>
              <div title="The reason supplied by the application or database session, when available.">
                <dt>Reason</dt>
                <dd>{selectedEvent.reason || "None recorded"}</dd>
              </div>
            </dl>
            <div className="audit-value-grid">
              <section>
                <h5>Old values</h5>
                <pre>{formatAuditJson(selectedEvent.previousValues)}</pre>
              </section>
              <section>
                <h5>New values</h5>
                <pre>{formatAuditJson(selectedEvent.newValues)}</pre>
              </section>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
