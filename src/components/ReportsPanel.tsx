import { formatReportValue } from "./reports/reportFormatting";
import { Notice, EmptyState } from "./ui/Feedback";
import { Modal } from "./ui/Modal";
import { Play, Printer, Search, X } from "lucide-react";
import type { CemeteryData, CurrentUser } from "../types";
import { useReportWorkflow } from "../hooks/useReportWorkflow";
import { MarkerBurialPages } from "./reports/MarkerBurialPages";

type ReportsPanelProps = {
  currentUser: CurrentUser;
  data: CemeteryData;
  onClose: () => void;
};

export function ReportsPanel({ currentUser, data, onClose }: ReportsPanelProps) {
  const { catalogError, staleResult, selectedReportId, parameters, setParameters, selectedCemeteryId, setSelectedCemeteryId, question, setQuestion, result, message, messageTone, error, isLoading, selectedReport, cemeteryOptions, groupedReports, selectReport, executeReport, askQuestion, retryCatalog } = useReportWorkflow(currentUser, data);

  return (
    <Modal className="reports-panel" label="Reports" onClose={onClose}>
      <header className="reports-header">
        <div>
          <h2>Reports</h2>
          <p>{result?.summary ?? "Run approved cemetery reports."}</p>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close reports" title="Close reports">
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="report-question">
        <Search size={16} aria-hidden="true" />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void askQuestion();
          }}
          placeholder="Ask a cemetery question"
        />
        <button type="button" onClick={() => void askQuestion()} disabled={isLoading || !question.trim()} title="Find a matching report">
          Ask
        </button>
      </div>

      {currentUser.role === "admin" ? (
        <label className="report-scope">
          <span>Cemetery</span>
          <select value={selectedCemeteryId} onChange={(event) => setSelectedCemeteryId(event.target.value)}>
            <option value="__all">All cemeteries</option>
            {cemeteryOptions.map((cemetery) => (
              <option key={cemetery.id} value={cemetery.id}>
                {cemetery.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {message ? <div className={`report-message ${messageTone === "error" ? "is-error" : ""}`} role={messageTone === "error" ? "alert" : "status"}>{message}</div> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="reports-layout">
        <aside className="report-list" aria-label="Available reports">
          {groupedReports.map(([category, categoryReports]) => (
            <section key={category}>
              <h3>{category}</h3>
              {categoryReports.map((report) => (
                <button
                  type="button"
                  key={report.id}
                  className={report.id === selectedReportId ? "is-active" : ""}
                  onClick={() => selectReport(report)}
                  title={report.description}
                >
                  <strong>{report.title}</strong>
                  <span>{report.requiredRole}</span>
                </button>
              ))}
            </section>
          ))}
        </aside>

        <section className="report-runner">
          {selectedReport ? (
            <>
              <div className="report-runner-header">
                <div>
                  <h3>{selectedReport.title}</h3>
                  <p>{selectedReport.description}</p>
                </div>
                <button type="button" onClick={() => void executeReport()} disabled={isLoading} title="Run selected report">
                  <Play size={15} aria-hidden="true" />
                  Run
                </button>
              </div>

              {selectedReport.parameters.length ? (
                <div className="report-parameters">
                  {selectedReport.parameters.map((parameter) => (
                    <label key={parameter.name}>
                      <span>{parameter.label}</span>
                      <input
                        value={parameters[parameter.name] ?? ""}
                        onChange={(event) => setParameters((current) => ({ ...current, [parameter.name]: event.target.value }))}
                        required={parameter.required}
                      />
                    </label>
                  ))}
                </div>
              ) : null}

              {selectedReport.examples.length ? (
                <div className="report-examples">
                  {selectedReport.examples.map((example) => (
                    <button type="button" key={example} onClick={() => setQuestion(example)}>
                      {example}
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : isLoading ? (
            <div className="report-empty" role="status">Loading reports...</div>
          ) : catalogError ? (
            <div role="alert"><p>Reports couldn't be loaded.</p><button type="button" onClick={() => retryCatalog()}>Retry loading reports</button></div>
          ) : (
            <EmptyState title="No reports available" />
          )}

          {result ? (
            <div className="report-result">
              {staleResult ? <p role="status">Previous results—latest request failed. Run the report again to refresh them.</p> : null}
              <div className="report-result-meta">
                <div className="report-result-heading">
                  <strong>{result.report.title}</strong>
                  {result.subtitle ? <span>{result.subtitle}</span> : null}
                </div>
                <div className="report-result-actions">
                  <span>{new Date(result.generatedAt).toLocaleString()}</span>
                  {result.layout === "marker-burial-pages" ? (
                    <button type="button" className="report-print-button" onClick={() => window.print()}>
                      <Printer size={15} aria-hidden="true" />
                      Print
                    </button>
                  ) : null}
                </div>
              </div>
              {result.layout === "marker-burial-pages" ? <MarkerBurialPages rows={result.rows} /> : <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      {result.columns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.length ? (
                      result.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {result.columns.map((column) => (
                            <td key={column.key}>{formatReportValue(row[column.key])}</td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={result.columns.length}>No rows returned.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>}
              {result.notes.length ? (
                <ul className="report-notes">
                  {result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}
