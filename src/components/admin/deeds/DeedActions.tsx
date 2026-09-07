import type {
DeedInvestigationActionType,
DeedInvestigationAffidavitStatus,
DeedInvestigationCouncilStatus,
DeedInvestigationDeedStatus
} from "../../../types";
import {
affidavitStatusLabels,
councilStatusLabels,
deedActionTypeLabels,
deedStatusLabels
} from "../../AdminPanelDeedConfig";
import { DeedsAdminTabProps } from "./shared";

export function DeedActions({ selectedDeedCaseId, selectedDeedCase, startNewDeedAction, selectedDeedActionId, selectDeedAction, deedActionForm, setDeedActionForm, savingDeedActionKey, saveDeedAction }: Pick<DeedsAdminTabProps, "selectedDeedCaseId" | "selectedDeedCase" | "startNewDeedAction" | "selectedDeedActionId" | "selectDeedAction" | "deedActionForm" | "setDeedActionForm" | "savingDeedActionKey" | "saveDeedAction">) {
  return (<section className="deed-action-workbench" aria-label="Recommended actions">
                <div className="deed-action-heading">
                  <strong>Recommended actions</strong>
                  <button type="button" className="secondary-button" onClick={startNewDeedAction} disabled={!selectedDeedCaseId} title="Add another recommended action to this investigation.">
                    New action
                  </button>
                </div>
                {selectedDeedCase?.recommendedActions.length ? (
                  <div className="deed-action-list">
                    {selectedDeedCase.recommendedActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        className={`deed-action-card ${selectedDeedActionId === action.id ? "is-selected" : ""}`}
                        data-discard-draft onClick={() => selectDeedAction(action)}
                        title={`${action.subjectName}. ${deedActionTypeLabels[action.actionType]}. Council: ${councilStatusLabels[action.councilStatus]}.`}
                      >
                        <strong>{action.subjectName}</strong>
                        <span>{deedActionTypeLabels[action.actionType]} · {action.plotReference || "No plot"}</span>
                        <small>
                          Council {councilStatusLabels[action.councilStatus]}
                          {action.councilDecisionDate ? ` ${action.councilDecisionDate}` : ""} · Affidavit {affidavitStatusLabels[action.affidavitStatus]} · Deed {deedStatusLabels[action.deedStatus]}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="record-editor-empty">No recommended actions have been added to this case yet.</p>
                )}

                <form className="deed-action-form" onSubmit={saveDeedAction}>
                  <label>
                    Person
                    <input
                      value={deedActionForm.subjectName}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, subjectName: event.target.value }))}
                      required
                      placeholder="Elaine Krepps Wasko"
                      title="Person or party this recommended action is for."
                    />
                  </label>
                  <label>
                    Action
                    <select
                      value={deedActionForm.actionType}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, actionType: event.target.value as DeedInvestigationActionType }))}
                      title="Recommended action type."
                    >
                      {Object.entries(deedActionTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Plot / gravesite
                    <input
                      value={deedActionForm.plotReference}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, plotReference: event.target.value }))}
                      placeholder="61 OC grave 4"
                      title="Plot, gravesite, or location this action concerns."
                    />
                  </label>
                  <label>
                    Council
                    <select
                      value={deedActionForm.councilStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilStatus: event.target.value as DeedInvestigationCouncilStatus }))}
                      title="Council approval status for this action."
                    >
                      {Object.entries(councilStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Decision date
                    <input
                      type="date"
                      value={deedActionForm.councilDecisionDate}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilDecisionDate: event.target.value }))}
                      title="Date Council made or recorded its decision for this action."
                    />
                  </label>
                  <label>
                    Minutes / reference
                    <input
                      value={deedActionForm.councilDocumentReference}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, councilDocumentReference: event.target.value }))}
                      placeholder="Council minutes 2026-03-17"
                      title="Council minutes, agenda item, email approval, or other decision reference."
                    />
                  </label>
                  <label>
                    Affidavit
                    <select
                      value={deedActionForm.affidavitStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, affidavitStatus: event.target.value as DeedInvestigationAffidavitStatus }))}
                      title="Lost deed affidavit status for this action."
                    >
                      {Object.entries(affidavitStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Deed / outcome
                    <select
                      value={deedActionForm.deedStatus}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, deedStatus: event.target.value as DeedInvestigationDeedStatus }))}
                      title="Deed or action outcome status."
                    >
                      {Object.entries(deedStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="deed-action-wide">
                    Notes
                    <textarea
                      value={deedActionForm.notes}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={2}
                      title="Recommendation notes, restrictions, or conditions for this action."
                    />
                  </label>
                  <label className="deed-action-wide">
                    Final outcome
                    <textarea
                      value={deedActionForm.outcome}
                      onChange={(event) => setDeedActionForm((current) => ({ ...current, outcome: event.target.value }))}
                      rows={2}
                      title="Final result once the recommended action is resolved."
                    />
                  </label>
                  <div className="admin-form-actions deed-action-save-actions">
                    <button
                      type="submit"
                      disabled={!selectedDeedCaseId || Boolean(savingDeedActionKey) || !deedActionForm.subjectName.trim()}
                      title="Save this recommended action."
                    >
                      {savingDeedActionKey === (selectedDeedActionId || "new") ? "Saving..." : selectedDeedActionId ? "Save action" : "Add action"}
                    </button>
                  </div>
                </form>
              </section>);
}
