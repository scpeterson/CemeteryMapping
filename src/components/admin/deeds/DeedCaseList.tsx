import {
investigationStatusLabels
} from "../../AdminPanelDeedConfig";
import { DeedsAdminTabProps } from "./shared";

export function DeedCaseList({ deedCases, selectedDeedCaseId, selectDeedCase }: Pick<DeedsAdminTabProps, "deedCases" | "selectedDeedCaseId" | "selectDeedCase">) {
  return (<div className="deed-case-list" aria-label="Recent deed investigation cases">
                  {deedCases.slice(0, 6).map((investigation) => (
                    <button
                      key={investigation.id}
                      type="button"
                      className={`deed-case-card ${selectedDeedCaseId === investigation.id ? "is-selected" : ""}`}
                      data-discard-draft onClick={() => selectDeedCase(investigation)}
                      title={`${investigation.caseNumber}: ${investigation.subjectName}. ${investigationStatusLabels[investigation.status]}.`}
                    >
                      <strong>{investigation.caseNumber}</strong>
                      <span>{investigation.subjectName}</span>
                      <small>{investigation.plotReference || investigationStatusLabels[investigation.status]} · {investigation.linkedEntryCount} evidence row{investigation.linkedEntryCount === 1 ? "" : "s"}</small>
                    </button>
                  ))}
                </div>);
}
