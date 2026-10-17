import type {
DeedInvestigationAffidavitStatus,
DeedInvestigationStatus
} from "../../../types";
import {
affidavitStatusLabels,
investigationStatusLabels
} from "../../AdminPanelDeedConfig";
import { DeedsAdminTabProps } from "./shared";

export function DeedCaseEditor({ selectedDeedCaseId, deedCaseForm, setDeedCaseForm, selectedDeedCase, savingDeedCaseKey, saveDeedCase }: Pick<DeedsAdminTabProps, "selectedDeedCaseId" | "deedCaseForm" | "setDeedCaseForm" | "selectedDeedCase" | "savingDeedCaseKey" | "saveDeedCase">) {
  return (<form className="deed-case-form" onSubmit={saveDeedCase}>
                <label>
                  Case number
                  <input
                    value={deedCaseForm.caseNumber}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, caseNumber: event.target.value }))}
                    required
                    title="Short unique identifier for this investigation."
                  />
                </label>
                <label>
                  Subject
                  <input
                    value={deedCaseForm.subjectName}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, subjectName: event.target.value }))}
                    required
                    placeholder="Elaine Krepps Wasko"
                    title="Person or family at the center of this deed investigation."
                  />
                </label>
                <label>
                  Plot
                  <input
                    value={deedCaseForm.plotReference}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, plotReference: event.target.value }))}
                    placeholder="61 OC"
                    title="Best-known plot, lot, section, or gravesite reference."
                  />
                </label>
                <label>
                  Status
                  <select
                    value={deedCaseForm.status}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, status: event.target.value as DeedInvestigationStatus }))}
                    title="Current investigation status."
                  >
                    {Object.entries(investigationStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Affidavit
                  <select
                    value={deedCaseForm.affidavitStatus}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, affidavitStatus: event.target.value as DeedInvestigationAffidavitStatus }))}
                    title="Lost deed affidavit state, if one is needed."
                  >
                    {Object.entries(affidavitStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Requester
                  <input
                    value={deedCaseForm.requesterName}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, requesterName: event.target.value }))}
                    placeholder="Barb Porti"
                    title="Person asking for the deed investigation."
                  />
                </label>
                <label className="deed-case-wide">
                  Request summary
                  <textarea
                    value={deedCaseForm.requestSummary}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, requestSummary: event.target.value }))}
                    rows={3}
                    title="What the family or pastor asked the cemetery to determine."
                  />
                </label>
                <label className="deed-case-wide">
                  Family / claimant notes
                  <textarea
                    value={deedCaseForm.familySummary}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, familySummary: event.target.value }))}
                    rows={3}
                    title="Living relatives, deceased relatives, possible deed holders, obituary notes, and claimant context."
                  />
                </label>
                <label className="deed-case-wide">
                  Findings and outcome
                  <textarea
                    value={deedCaseForm.findings}
                    onChange={(event) => setDeedCaseForm((current) => ({ ...current, findings: event.target.value }))}
                    rows={3}
                    title="Evidence summary, recommendation, council decision, and final outcome."
                  />
                </label>
                {selectedDeedCase?.linkedEntries.length ? (
                  <div className="deed-case-linked deed-case-wide" aria-label="Linked deed evidence">
                    <strong>Linked evidence</strong>
                    {selectedDeedCase.linkedEntries.map((entry) => (
                      <span key={entry.id}>Row {entry.sourceRowNumber}: {entry.ownerDisplayName || "No owner"} {entry.rawLotText ? `(${entry.rawLotText})` : ""}</span>
                    ))}
                  </div>
                ) : null}
                <div className="admin-form-actions deed-case-save-actions">
                  <button type="submit" disabled={Boolean(savingDeedCaseKey) || !deedCaseForm.caseNumber.trim() || !deedCaseForm.subjectName.trim()} title="Save this deed investigation case.">
                    {savingDeedCaseKey === (selectedDeedCaseId || "new") ? "Saving..." : selectedDeedCaseId ? "Save case" : "Create case"}
                  </button>
                </div>
              </form>);
}
