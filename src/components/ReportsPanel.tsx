import { useEffect, useMemo, useState } from "react";
import { Play, Search, X } from "lucide-react";
import { fetchReports, queryReports, runReport } from "../api/cemeteryApi";
import type { CemeteryData, CurrentUser, ReportDefinition, ReportResult } from "../types";

type ReportsPanelProps = {
  currentUser: CurrentUser;
  data: CemeteryData;
  onClose: () => void;
};

function formatReportValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/u.test(value)) return value.slice(0, 10);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  return String(value);
}

function initialParameters(report?: ReportDefinition) {
  return Object.fromEntries((report?.parameters ?? []).map((parameter) => [parameter.name, ""]));
}

export function ReportsPanel({ currentUser, data, onClose }: ReportsPanelProps) {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [selectedCemeteryId, setSelectedCemeteryId] = useState("__all");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ReportResult>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    fetchReports()
      .then((nextReports) => {
        if (!isCurrent) return;
        setReports(nextReports);
        setSelectedReportId((current) => current || nextReports[0]?.id || "");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const selectedReport = useMemo(() => reports.find((report) => report.id === selectedReportId), [reports, selectedReportId]);
  const cemeteryOptions = useMemo(() => {
    const options = new Map<string, string>();
    data.graves.forEach((grave) => options.set(grave.cemeteryId, grave.cemeteryName));
    return [...options.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.graves]);
  const scopedParameters = (reportParameters: Record<string, string>) => ({
    ...reportParameters,
    ...(currentUser.role === "admin" ? { cemeteryId: selectedCemeteryId } : {}),
  });
  const groupedReports = useMemo(() => {
    const groups = new Map<string, ReportDefinition[]>();
    reports.forEach((report) => {
      groups.set(report.category, [...(groups.get(report.category) ?? []), report]);
    });
    return [...groups.entries()];
  }, [reports]);

  useEffect(() => {
    setParameters(initialParameters(selectedReport));
  }, [selectedReport]);

  const selectReport = (report: ReportDefinition) => {
    setSelectedReportId(report.id);
    setMessage("");
    setError("");
  };

  const executeReport = async (report = selectedReport, reportParameters = parameters) => {
    if (!report) return;
    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      const nextResult = await runReport(report.id, scopedParameters(reportParameters));
      setResult(nextResult);
      setSelectedReportId(report.id);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run report.");
    } finally {
      setIsLoading(false);
    }
  };

  const askQuestion = async () => {
    const cleanedQuestion = question.trim();
    if (!cleanedQuestion) return;
    setIsLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await queryReports(cleanedQuestion, scopedParameters({}));
      if (!response.matched || !response.report) {
        setMessage(response.message);
        setResult(undefined);
        return;
      }
      setSelectedReportId(response.report.id);
      setParameters({ ...initialParameters(response.report), ...(response.parameters ?? {}) });
      if (response.result) {
        setResult(response.result);
        setMessage(response.message);
        return;
      }
      setResult(undefined);
      setMessage(response.missingParameters?.length ? `${response.message} ${response.missingParameters.map((parameter) => parameter.label).join(", ")}` : response.message);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Unable to query reports.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reports-panel" role="dialog" aria-modal="true" aria-label="Reports">
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

      {message ? <div className="report-message" role="status">{message}</div> : null}
      {error ? <div className="report-message is-error" role="alert">{error}</div> : null}

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
          ) : (
            <div className="report-empty">No reports available.</div>
          )}

          {result ? (
            <div className="report-result">
              <div className="report-result-meta">
                <strong>{result.report.title}</strong>
                <span>{new Date(result.generatedAt).toLocaleString()}</span>
              </div>
              <div className="report-table-wrap">
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
              </div>
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
    </div>
  );
}
