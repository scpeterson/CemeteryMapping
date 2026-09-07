import {
investigationStatusLabels
} from "../../AdminPanelDeedConfig";
import { DeedsAdminTabProps } from "./shared";

export function DeedCaseFilters({ deedCaseFilters, setDeedCaseFilters, isLoadingDeedCases, loadDeedCases, startNewDeedCase }: Pick<DeedsAdminTabProps, "deedCaseFilters" | "setDeedCaseFilters" | "isLoadingDeedCases" | "loadDeedCases" | "startNewDeedCase">) {
  return (<div className="deed-case-toolbar">
                <label>
                  Case search
                  <input
                    value={deedCaseFilters.q}
                    onChange={(event) => setDeedCaseFilters((current) => ({ ...current, q: event.target.value }))}
                    placeholder="Case, family, plot, findings"
                    title="Search deed investigation cases by case number, subject, requester, plot, family summary, or findings."
                  />
                </label>
                <label>
                  Case status
                  <select
                    value={deedCaseFilters.status}
                    onChange={(event) => setDeedCaseFilters((current) => ({ ...current, status: event.target.value }))}
                    title="Filter deed investigation cases by status."
                  >
                    <option value="">All statuses</option>
                    {Object.entries(investigationStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="admin-form-actions deed-case-actions">
                  <button type="button" onClick={() => void loadDeedCases()} disabled={isLoadingDeedCases} title="Load matching deed investigation cases.">
                    {isLoadingDeedCases ? "Loading..." : "Find cases"}
                  </button>
                  <button type="button" className="secondary-button" onClick={startNewDeedCase} title="Start a new deed investigation case.">
                    New case
                  </button>
                </div>
              </div>);
}
