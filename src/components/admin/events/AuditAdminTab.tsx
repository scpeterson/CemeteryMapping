import { type FormEvent, useEffect, useMemo, useState } from "react";
import { formatAdminTimestamp } from "../../../lib/format";
import { type AdminEventTabProps, formatEventJson, retentionResultText } from "./shared";
import { History } from "lucide-react";
import {
  fetchAdminAuditEvents,
  fetchAuditRetentionPolicy,
  runAuditRetentionPurge,
  type SaveAuditRetentionPolicyInput,
  updateAuditRetentionPolicy,
} from "../../../api/cemeteryApi";
import { defaultAuditFilters, defaultAuditRetentionPolicy } from "../../AdminEventDefaults";
import { auditActionLabels, auditTableLabels } from "../../AdminEventLabels";
import type { AuditEvent, AuditEventFilters, AuditRetentionPolicy, AuditRetentionPurgeResult } from "../../../types";

type AuditAdminTabProps = AdminEventTabProps & {
  seedFilters?: AuditEventFilters;
};

const auditActorLabel = (event: AuditEvent) => event.actorEmail || event.actorDatabaseUser || event.actorSessionUser || "Unknown actor";
const auditActionLabel = (action: string) => auditActionLabels[action] ?? action;
const auditTableLabel = (targetTable: string) => auditTableLabels[targetTable] ?? targetTable;

const auditEventSummary = (event: AuditEvent) => {
  if (event.changedFields.length === 0) return event.reason || "No field-level changes recorded";
  const fields = event.changedFields.slice(0, 3).join(", ");
  const suffix = event.changedFields.length > 3 ? ` +${event.changedFields.length - 3} more` : "";
  return `${fields}${suffix}`;
};


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
                <pre>{formatEventJson(selectedEvent.previousValues)}</pre>
              </section>
              <section>
                <h5>New values</h5>
                <pre>{formatEventJson(selectedEvent.newValues)}</pre>
              </section>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
