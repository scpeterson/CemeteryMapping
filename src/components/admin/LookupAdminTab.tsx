import { ArrowDown, ArrowUp, History, ListChecks } from "lucide-react";
import { lookupRowTitle, lookupUsageText } from "../admin/adminWorkflowConfig";
import { useLookupAdministration } from "../admin/useLookupAdministration";

type Props = Pick<ReturnType<typeof useLookupAdministration>, "selectedLookupTable" | "setSelectedLookupTable" | "lookupRecords" | "loadLookupRecords" | "isLoadingLookups" | "showInactiveLookups" | "setShowInactiveLookups" | "selectedLookupDefinition" | "selectedLookupRows" | "duplicateLookupSortOrders" | "savingLookupKey" | "recentlyMovedLookupIds" | "updateLocalLookupRecord" | "moveLookupRecord" | "viewLookupAudit" | "saveLookupRecord" | "newLookupRecord" | "setNewLookupRecord" | "addLookupRecord">;

export function LookupAdminTab({
  selectedLookupTable,
  setSelectedLookupTable,
  lookupRecords,
  loadLookupRecords,
  isLoadingLookups,
  showInactiveLookups,
  setShowInactiveLookups,
  selectedLookupDefinition,
  selectedLookupRows,
  duplicateLookupSortOrders,
  savingLookupKey,
  recentlyMovedLookupIds,
  updateLocalLookupRecord,
  moveLookupRecord,
  viewLookupAudit,
  saveLookupRecord,
  newLookupRecord,
  setNewLookupRecord,
  addLookupRecord
}: Props) {
  return (
    <>
      <section className="admin-section">
        <div className="section-title">
          <ListChecks size={17} aria-hidden="true" />
          <h3>Lookups</h3>
        </div>

        <div className="lookup-toolbar">
          <label>
            Lookup table
            <select
              value={selectedLookupTable}
              onChange={(event) => setSelectedLookupTable(event.target.value)}
              title="Choose which controlled lookup list to maintain."
            >
              {lookupRecords.tables.map((table) => (
                <option key={table.table} value={table.table}>
                  {table.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={() => void loadLookupRecords()} disabled={isLoadingLookups} title="Reload lookup values from the database.">
            {isLoadingLookups ? "Loading..." : "Refresh"}
          </button>
          <label className="checkbox-row lookup-show-inactive" title="Show inactive lookup values in this maintenance list.">
            <input type="checkbox" checked={showInactiveLookups} onChange={(event) => setShowInactiveLookups(event.target.checked)} />
            Show inactive
          </label>
        </div>

        {isLoadingLookups ? <div className="admin-message" role="status">Loading lookup records...</div> : null}

        {selectedLookupDefinition ? (
          <>
            <div className="lookup-row-list" role="table" aria-label={`${selectedLookupDefinition.label} lookup values`}>
              {selectedLookupRows.map((row, rowIndex) => {
                const hasDuplicateSortOrder = duplicateLookupSortOrders.has(row.sortOrder);
                const moveKey = `${selectedLookupTable}:move:${row.id}`;
                const isSavingRow = savingLookupKey === `${selectedLookupTable}:${row.id}` || savingLookupKey === moveKey;
                const sortWasRecentlyMoved = recentlyMovedLookupIds.has(row.id);

                return (
                  <article
                    key={row.id}
                    className={`${row.isActive ? "lookup-row" : "lookup-row is-inactive"} ${selectedLookupDefinition.hasSourceFields ? "has-source-fields" : ""}`}
                    title={lookupRowTitle(row)}
                  >
                    <label className="lookup-label">
                      Label
                      <input
                        value={row.label}
                        onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { label: event.target.value })}
                        title="Human-readable label shown in admin screens and future form controls."
                      />
                    </label>
                    <div className={`lookup-sort lookup-field ${sortWasRecentlyMoved ? "was-reordered" : ""}`}>
                      <span>Sort</span>
                      <div className="lookup-sort-control">
                        <input
                          type="number"
                          value={row.sortOrder}
                          onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { sortOrder: Number(event.target.value) })}
                          title="Display order for this lookup value."
                        />
                        <span className="lookup-sort-buttons" aria-label={`Change sort order for ${row.label}`}>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => void moveLookupRecord(selectedLookupTable, row, -1)}
                            disabled={rowIndex === 0 || isSavingRow}
                            title="Move this lookup value up by swapping sort order with the previous visible value."
                            aria-label={`Move ${row.label} up`}
                          >
                            <ArrowUp size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => void moveLookupRecord(selectedLookupTable, row, 1)}
                            disabled={rowIndex === selectedLookupRows.length - 1 || isSavingRow}
                            title="Move this lookup value down by swapping sort order with the next visible value."
                            aria-label={`Move ${row.label} down`}
                          >
                            <ArrowDown size={16} aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                      {hasDuplicateSortOrder ? <small className="lookup-warning">Duplicate sort order</small> : null}
                    </div>
                    <label className="lookup-description">
                      Description
                      <textarea
                        value={row.description}
                        onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { description: event.target.value })}
                        rows={selectedLookupDefinition.hasSourceFields ? 3 : 2}
                        title="Admin-facing explanation of when this value should be used."
                      />
                    </label>
                    {selectedLookupDefinition.hasSourceFields ? (
                      <>
                        <label className="lookup-source-notes">
                          Source notes
                          <textarea
                            value={row.sourceNotes ?? ""}
                            onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { sourceNotes: event.target.value })}
                            rows={3}
                            title="Optional note describing where this lookup value came from."
                          />
                        </label>
                        <label className="lookup-source-url">
                          Source URL
                          <input
                            value={row.sourceUrl ?? ""}
                            onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { sourceUrl: event.target.value })}
                            title="Optional source URL for this lookup value."
                          />
                        </label>
                      </>
                    ) : null}
                    <div className="lookup-usage" title={lookupUsageText(row)}>
                      {lookupUsageText(row)}
                    </div>
                    <label className="checkbox-row lookup-active" title="Inactive lookup values stay in the database for history but are hidden from active-only pickers.">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { isActive: event.target.checked })}
                        title="Controls whether this lookup value is active."
                      />
                      Active
                    </label>
                    <div className="lookup-actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => viewLookupAudit(selectedLookupTable, row)}
                        title="Open audit log entries for this lookup value."
                        aria-label={`View audit log for ${row.label}`}
                      >
                        <History size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveLookupRecord(selectedLookupTable, row)}
                        disabled={isSavingRow || !row.label.trim() || !row.description.trim()}
                        title="Save changes to this lookup value."
                      >
                        {savingLookupKey === `${selectedLookupTable}:${row.id}` ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <article
              className={`lookup-row lookup-row-new ${selectedLookupDefinition.hasSourceFields ? "has-source-fields" : ""}`}
              title={`Add a new value to ${selectedLookupDefinition.label}.`}
            >
              <h4>Add lookup value</h4>
              <label className="lookup-label">
                Label
                <input
                  value={newLookupRecord.label}
                  onChange={(event) => setNewLookupRecord((current) => ({ ...current, label: event.target.value }))}
                  title="Human-readable label for the new lookup value."
                />
              </label>
              <label className="lookup-sort">
                Sort
                <input
                  type="number"
                  value={newLookupRecord.sortOrder}
                  onChange={(event) => setNewLookupRecord((current) => ({ ...current, sortOrder: Number(event.target.value) }))}
                  title="Display order for the new lookup value."
                />
              </label>
              <label className="lookup-description">
                Description
                <textarea
                  value={newLookupRecord.description}
                  onChange={(event) => setNewLookupRecord((current) => ({ ...current, description: event.target.value }))}
                  rows={selectedLookupDefinition.hasSourceFields ? 3 : 2}
                  title="Admin-facing explanation of when this value should be used."
                />
              </label>
              {selectedLookupDefinition.hasSourceFields ? (
                <>
                  <label className="lookup-source-notes">
                    Source notes
                    <textarea
                      value={newLookupRecord.sourceNotes ?? ""}
                      onChange={(event) => setNewLookupRecord((current) => ({ ...current, sourceNotes: event.target.value }))}
                      rows={3}
                      title="Optional note describing where this lookup value came from."
                    />
                  </label>
                  <label className="lookup-source-url">
                    Source URL
                    <input
                      value={newLookupRecord.sourceUrl ?? ""}
                      onChange={(event) => setNewLookupRecord((current) => ({ ...current, sourceUrl: event.target.value }))}
                      title="Optional source URL for this lookup value."
                    />
                  </label>
                </>
              ) : null}
              <label className="checkbox-row lookup-active" title="New lookup values are active by default.">
                <input
                  type="checkbox"
                  checked={newLookupRecord.isActive}
                  onChange={(event) => setNewLookupRecord((current) => ({ ...current, isActive: event.target.checked }))}
                  title="Controls whether this new lookup value is active."
                />
                Active
              </label>
              <button
                type="button"
                onClick={() => void addLookupRecord()}
                disabled={
                  savingLookupKey === `${selectedLookupTable}:new` ||
                  !newLookupRecord.label.trim() ||
                  !newLookupRecord.description.trim()
                }
                title="Add this lookup value."
              >
                {savingLookupKey === `${selectedLookupTable}:new` ? "Adding..." : "Add value"}
              </button>
            </article>
          </>
        ) : (
          <p className="record-editor-empty">Lookup records have not been loaded yet.</p>
        )}
      </section>
    </>
  );
}
