import { LookupTextFields } from "./LookupTextFields";
import { GraveFeatureTypeField } from "./GraveFeatureTypeField";
import { MilitaryRankFields } from "./MilitaryRankFields";
import { History, ListChecks } from "lucide-react";
import { lookupRowTitle, lookupUsageText } from "../admin/adminWorkflowConfig";
import { useLookupAdministration } from "../admin/useLookupAdministration";

type Props = Pick<ReturnType<typeof useLookupAdministration>, "selectedLookupTable" | "setSelectedLookupTable" | "lookupRecords" | "loadLookupRecords" | "isLoadingLookups" | "showInactiveLookups" | "setShowInactiveLookups" | "selectedLookupDefinition" | "selectedLookupRows" | "savingLookupKey" | "updateLocalLookupRecord" | "viewLookupAudit" | "saveLookupRecord" | "newLookupRecord" | "setNewLookupRecord" | "addLookupRecord">;

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
  savingLookupKey,
  updateLocalLookupRecord,
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
              title="Choose a lookup list."
            >
              {lookupRecords.tables.map((table) => (
                <option key={table.table} value={table.table}>
                  {table.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="secondary-button" onClick={() => void loadLookupRecords()} disabled={isLoadingLookups} title="Refresh lookup values.">
            {isLoadingLookups ? "Loading..." : "Refresh"}
          </button>
          <label className="checkbox-row lookup-show-inactive" title="Include inactive values.">
            <input type="checkbox" checked={showInactiveLookups} onChange={(event) => setShowInactiveLookups(event.target.checked)} />
            Show inactive
          </label>
        </div>

        <p>Lookup values are shared across all cemeteries. System admins only.</p>
        <p>Values are listed alphabetically. Name related items with the shared term first, such as “Granite, gray”.</p>

        {isLoadingLookups ? <div className="admin-message" role="status">Loading lookup records...</div> : null}

        {selectedLookupDefinition ? (
          <>
            <div className="lookup-row-list" role="table" aria-label={`${selectedLookupDefinition.label} lookup values`}>
              {selectedLookupRows.map((row) => {
                const isSavingRow = savingLookupKey === `${selectedLookupTable}:${row.id}`;

                return (
                  <article
                    key={row.id}
                    className={`${row.isActive ? "lookup-row" : "lookup-row is-inactive"} ${selectedLookupDefinition.hasSourceFields ? "has-source-fields" : ""} ${selectedLookupDefinition.hasRankFields ? "has-rank-fields" : ""} ${selectedLookupDefinition.hasGraveFeatureType ? "has-feature-type" : ""}`}
                    title={lookupRowTitle(row)}
                  >
                    <LookupTextFields record={row} hasSourceFields={selectedLookupDefinition.hasSourceFields} onChange={patch => updateLocalLookupRecord(selectedLookupTable, row.id, patch)} />
                    {selectedLookupDefinition.hasRankFields ? <MilitaryRankFields record={row} branches={lookupRecords.lookups.military_branch_types ?? []} onChange={patch => updateLocalLookupRecord(selectedLookupTable, row.id, patch)} /> : null}
                    {selectedLookupDefinition.hasGraveFeatureType ? <GraveFeatureTypeField record={row} types={lookupRecords.lookups.grave_feature_types ?? []} onChange={patch => updateLocalLookupRecord(selectedLookupTable, row.id, patch)} /> : null}
                    <div className="lookup-usage" title={lookupUsageText(row)}>
                      {lookupUsageText(row)}
                    </div>
                    <label className="checkbox-row lookup-active" title="Inactive values retain history but are hidden from pickers.">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(event) => updateLocalLookupRecord(selectedLookupTable, row.id, { isActive: event.target.checked })}
                      />
                      Active
                    </label>
                    <div className="lookup-actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => viewLookupAudit(selectedLookupTable, row)}
                        title={`View audit log for ${row.label}`}
                        aria-label={`View audit log for ${row.label}`}
                      >
                        <History size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveLookupRecord(selectedLookupTable, row)}
                        disabled={isSavingRow || !row.label.trim() || !row.description.trim() || (selectedLookupDefinition.hasRankFields && (!row.militaryBranchId || !row.abbreviation?.trim()))}
                        title="Save lookup value."
                      >
                        {savingLookupKey === `${selectedLookupTable}:${row.id}` ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <article
              className={`lookup-row lookup-row-new ${selectedLookupDefinition.hasSourceFields ? "has-source-fields" : ""} ${selectedLookupDefinition.hasRankFields ? "has-rank-fields" : ""} ${selectedLookupDefinition.hasGraveFeatureType ? "has-feature-type" : ""}`}
              title={`Add a new value to ${selectedLookupDefinition.label}.`}
            >
              <h4>Add lookup value</h4>
              <LookupTextFields record={newLookupRecord} hasSourceFields={selectedLookupDefinition.hasSourceFields} onChange={patch => setNewLookupRecord(current => ({ ...current, ...patch }))} />
              {selectedLookupDefinition.hasRankFields ? <MilitaryRankFields record={newLookupRecord} branches={lookupRecords.lookups.military_branch_types ?? []} onChange={patch => setNewLookupRecord(current => ({ ...current, ...patch }))} /> : null}
              {selectedLookupDefinition.hasGraveFeatureType ? <GraveFeatureTypeField record={newLookupRecord} types={lookupRecords.lookups.grave_feature_types ?? []} onChange={patch => setNewLookupRecord(current => ({ ...current, ...patch }))} /> : null}
              <label className="checkbox-row lookup-active">
                <input
                  type="checkbox"
                  checked={newLookupRecord.isActive}
                  onChange={(event) => setNewLookupRecord((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Active
              </label>
              <button
                type="button"
                onClick={() => void addLookupRecord()}
                disabled={
                  savingLookupKey === `${selectedLookupTable}:new` ||
                  !newLookupRecord.label.trim() ||
                  !newLookupRecord.description.trim() ||
                  (selectedLookupDefinition.hasRankFields && (!newLookupRecord.militaryBranchId || !newLookupRecord.abbreviation?.trim()))
                }
                title="Add lookup value."
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
