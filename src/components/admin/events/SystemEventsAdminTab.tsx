import { type FormEvent, useEffect, useMemo, useState } from "react";
import { formatAdminTimestamp } from "../../../lib/format";
import { type AdminEventTabProps, formatEventJson, retentionResultText } from "./shared";
import { Activity } from "lucide-react";
import {
  fetchSystemEventRetentionPolicy,
  fetchSystemEvents,
  runSystemEventRetentionPurge,
  type SaveSystemEventRetentionPolicyInput,
  updateSystemEventRetentionPolicy,
} from "../../../api/cemeteryApi";
import { defaultSystemEventFilters, defaultSystemEventRetentionPolicy } from "../../AdminEventDefaults";
import { systemEventSeverityLabels, systemEventStatusLabels, systemEventTypeLabels } from "../../AdminEventLabels";
import type { SystemEvent, SystemEventFilters, SystemEventRetentionPolicy, SystemEventRetentionPurgeResult } from "../../../types";

const systemEventTypeLabel = (eventType: string) => systemEventTypeLabels[eventType] ?? eventType;
const systemEventSeverityLabel = (severity: string) => systemEventSeverityLabels[severity] ?? severity;
const systemEventStatusLabel = (status: string) => systemEventStatusLabels[status] ?? (status || "No status");

const systemEventSummary = (event: SystemEvent) => {
  const parts = [event.source, event.status ? systemEventStatusLabel(event.status) : "", event.requestPath].filter(Boolean);
  return parts.length ? parts.join(" - ") : "No operational context recorded";
};

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
                <pre>{formatEventJson(selectedEvent.metadata)}</pre>
              </section>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}

