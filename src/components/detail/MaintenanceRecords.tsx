import { FormEvent, useState } from "react";
import { History, Pencil } from "lucide-react";
import type { GraveSpace, Headstone, HeadstoneLookups, MaintenanceRecord, SaveMaintenanceRecordInput } from "../../types";
import { formatDate } from "../../lib/format";

const maintenanceStatusLabels: Record<MaintenanceRecord["status"], string> = {
  open: "Open",
  scheduled: "Scheduled",
  completed: "Completed",
  deferred: "Deferred",
  not_needed: "Not needed",
};

const maintenanceSourceLabels: Record<SaveMaintenanceRecordInput["sourceType"], string> = {
  manual: "Manual",
  inspection: "Inspection",
  work_order: "Work order",
  photo: "Photo",
  import: "Import",
};

function maintenanceFormFromRecord(record: MaintenanceRecord, grave?: GraveSpace, fixedHeadstone?: Headstone): SaveMaintenanceRecordInput {
  return {
    targetType: record.headstoneUuid ? "headstone" : "gravesite",
    graveSpaceId: record.gravesiteUuid && grave ? grave.id : "",
    headstoneId: record.headstoneUuid ?? fixedHeadstone?.id ?? "",
    issueTypeId: record.issueType?.id ?? "",
    actionTypeId: record.actionType?.id ?? "",
    priorityTypeId: record.priority.id,
    status: record.status,
    observedAt: record.observedAt,
    completedAt: record.completedAt ?? "",
    performedBy: record.performedBy ?? "",
    sourceType: record.sourceType,
    notes: record.notes ?? "",
    reason: "Update maintenance record",
  };
}

export function MaintenanceRecordList({
  records,
  canUpdate = false,
  grave,
  fixedHeadstone,
  lookups,
  onUpdate,
}: {
  records: MaintenanceRecord[];
  canUpdate?: boolean;
  grave?: GraveSpace;
  fixedHeadstone?: Headstone;
  lookups?: HeadstoneLookups;
  onUpdate?: (id: string, record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
}) {
  const [editingId, setEditingId] = useState<string>();
  if (!records.length) return <p className="muted">No maintenance records are recorded.</p>;

  return (
    <div className="maintenance-list">
      {records.map((record) => {
        const title = [record.issueType?.label, record.actionType?.label].filter(Boolean).join(" / ");
        const dateParts = [`Observed ${formatDate(record.observedAt)}`];
        if (record.completedAt) dateParts.push(`Completed ${formatDate(record.completedAt)}`);
        if (editingId === record.id && lookups && onUpdate) {
          return (
            <article key={record.id} className={`maintenance-row maintenance-row-${record.status}`}>
              <MaintenanceRecordForm
                grave={grave}
                fixedHeadstone={fixedHeadstone}
                lookups={lookups}
                initialRecord={record}
                onSave={(input) => onUpdate(record.id, input)}
                onCancel={() => setEditingId(undefined)}
                submitLabel="Save maintenance"
              />
            </article>
          );
        }
        return (
          <article key={record.id} className={`maintenance-row maintenance-row-${record.status}`}>
            <div>
              <div className="record-heading">
                <strong>{title || "Maintenance record"}</strong>
                {canUpdate && lookups && onUpdate ? (
                  <button type="button" className="secondary-button compact-button" onClick={() => setEditingId(record.id)}>
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </button>
                ) : null}
              </div>
              <span>{dateParts.join(" | ")}</span>
            </div>
            <div className="maintenance-row-meta">
              <span>{maintenanceStatusLabels[record.status]}</span>
              <span>{record.priority.label}</span>
            </div>
            {record.performedBy ? <p>By {record.performedBy}</p> : null}
            {record.notes ? <p>{record.notes}</p> : null}
          </article>
        );
      })}
    </div>
  );
}

export function MaintenanceRecordForm({
  grave,
  fixedHeadstone,
  lookups,
  initialRecord,
  submitLabel = "Add maintenance",
  onCancel,
  onSave,
}: {
  grave?: GraveSpace;
  fixedHeadstone?: Headstone;
  lookups: HeadstoneLookups;
  initialRecord?: MaintenanceRecord;
  submitLabel?: string;
  onCancel?: () => void;
  onSave: (record: SaveMaintenanceRecordInput) => Promise<MaintenanceRecord>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultPriorityId = lookups.maintenancePriorities.find((option) => option.code === "normal")?.id ?? lookups.maintenancePriorities[0]?.id ?? "";
  const [form, setForm] = useState<SaveMaintenanceRecordInput>(() =>
    initialRecord
      ? maintenanceFormFromRecord(initialRecord, grave, fixedHeadstone)
      : {
          targetType: fixedHeadstone ? "headstone" : "gravesite",
          graveSpaceId: fixedHeadstone ? "" : (grave?.id ?? ""),
          headstoneId: fixedHeadstone?.id ?? "",
          issueTypeId: lookups.maintenanceIssueTypes[0]?.id ?? "",
          actionTypeId: "",
          priorityTypeId: defaultPriorityId,
          status: "open",
          observedAt: today,
          completedAt: "",
          performedBy: "",
          sourceType: "manual",
          notes: "",
          reason: "Record maintenance",
        },
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await onSave(form);
      if (initialRecord) {
        onCancel?.();
      } else {
        setMessage("Maintenance recorded.");
        setForm((current) => ({
          ...current,
          issueTypeId: lookups.maintenanceIssueTypes[0]?.id ?? "",
          actionTypeId: "",
          status: "open",
          completedAt: "",
          notes: "",
        }));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save maintenance record.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!lookups.maintenancePriorities.length || (!lookups.maintenanceIssueTypes.length && !lookups.maintenanceActionTypes.length)) return null;

  return (
    <form className="headstone-record headstone-form maintenance-form" onSubmit={(event) => void save(event)}>
      <label>
        Issue
        <select value={form.issueTypeId} onChange={(event) => setForm((current) => ({ ...current, issueTypeId: event.target.value }))}>
          <option value="">No issue</option>
          {lookups.maintenanceIssueTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Action
        <select value={form.actionTypeId} onChange={(event) => setForm((current) => ({ ...current, actionTypeId: event.target.value }))}>
          <option value="">No action</option>
          {lookups.maintenanceActionTypes.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Status
        <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as SaveMaintenanceRecordInput["status"] }))}>
          {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Priority
        <select value={form.priorityTypeId} onChange={(event) => setForm((current) => ({ ...current, priorityTypeId: event.target.value }))}>
          {lookups.maintenancePriorities.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Observed
        <input type="date" value={form.observedAt} onChange={(event) => setForm((current) => ({ ...current, observedAt: event.target.value }))} />
      </label>
      <label>
        Completed
        <input type="date" value={form.completedAt} onChange={(event) => setForm((current) => ({ ...current, completedAt: event.target.value }))} />
      </label>
      <label>
        Source
        <select value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value as SaveMaintenanceRecordInput["sourceType"] }))}>
          {Object.entries(maintenanceSourceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Performed by
        <input value={form.performedBy} onChange={(event) => setForm((current) => ({ ...current, performedBy: event.target.value }))} />
      </label>
      <label className="headstone-wide-field">
        Notes
        <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} />
      </label>
      {message ? <p className="detail-message is-success">{message}</p> : null}
      {error ? <p className="detail-message is-error">{error}</p> : null}
      <div className="headstone-form-actions">
        {onCancel ? (
          <button type="button" className="secondary-button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        ) : null}
        <button type="submit" disabled={isSaving || !form.priorityTypeId || (!form.issueTypeId && !form.actionTypeId)}>
          <History size={15} aria-hidden="true" />
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
