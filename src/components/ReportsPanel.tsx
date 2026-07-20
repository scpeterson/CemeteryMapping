import { useEffect, useMemo, useState } from "react";
import { Play, Printer, Search, X } from "lucide-react";
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

function reportText(row: Record<string, unknown>, key: string) {
  return formatReportValue(row[key]);
}

function DetailItem({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="marker-burial-detail">
      <dt>{label}</dt>
      <dd>{formatReportValue(value)}</dd>
    </div>
  );
}

function MarkerBurialPages({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="report-empty">No linked marker burials matched these filters.</div>;
  return (
    <div className="marker-burial-pages">
      {rows.map((row, index) => (
        <article className="marker-burial-page" key={`${String(row.marker_uuid)}:${String(row.burial_uuid)}`}>
          <header className="marker-burial-marker-header">
            <div>
              <p className="marker-burial-kicker">Marker burial record</p>
              <h1>{reportText(row, "marker_id")}</h1>
              <p>{[row.cemetery, row.section ? `Section ${row.section}` : "", row.grave].filter(Boolean).join(" · ")}</p>
            </div>
            <span>Page {index + 1} of {rows.length}</span>
          </header>
          {row.photo_url ? <img className="marker-burial-photo" src={String(row.photo_url)} alt={`Marker ${String(row.marker_id)}`} /> : <div className="marker-burial-photo-placeholder">No marker photo available</div>}
          <section>
            <h2>Marker information</h2>
            <dl className="marker-burial-details">
              <DetailItem label="Marker ID" value={row.marker_id} />
              <DetailItem label="Type" value={row.marker_type} />
              <DetailItem label="Material" value={row.marker_material} />
              <DetailItem label="Condition" value={row.marker_condition} />
              <DetailItem label="Gravesite" value={row.gravesite_id} />
              <DetailItem label="Inscription" value={row.inscription} />
              <DetailItem label="Design" value={row.design_notes} />
              <DetailItem label="Back" value={row.back_description} />
              <DetailItem label="Condition notes" value={row.condition_notes} />
            </dl>
          </section>
          <section>
            <h2>Burial information</h2>
            <h3>{reportText(row, "person")}</h3>
            <dl className="marker-burial-details">
              <DetailItem label="Birth" value={row.birth_date} />
              <DetailItem label="Death" value={row.death_date} />
              <DetailItem label="Burial" value={row.burial_date} />
              <DetailItem label="Interment" value={row.interment_type} />
              <DetailItem label="Record status" value={row.record_status} />
              <DetailItem label="Funeral home" value={row.funeral_home} />
              <DetailItem label="Veteran" value={row.veteran === true ? "Yes" : row.veteran ? row.veteran : undefined} />
              <DetailItem label="Branch" value={row.military_branch} />
              <DetailItem label="Rank" value={row.military_rank} />
              <DetailItem label="War/service" value={row.military_war_service} />
              <DetailItem label="Notes" value={row.burial_notes} />
            </dl>
          </section>
          <section className="marker-burial-nhg">
            <h2>North Hills Genealogists text</h2>
            <p>{row.nhg_text ? String(row.nhg_text) : "No linked NHG text."}</p>
          </section>
        </article>
      ))}
    </div>
  );
}

export function ReportsPanel({ currentUser, data, onClose }: ReportsPanelProps) {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [selectedCemeteryId, setSelectedCemeteryId] = useState("__all");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ReportResult>();
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

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
    setMessageTone("info");
    setError("");
  };

  const executeReport = async (report = selectedReport, reportParameters = parameters) => {
    if (!report) return;
    setIsLoading(true);
    setError("");
    setMessage("");
    setMessageTone("info");
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
    const selectedExampleReport = selectedReport?.examples.includes(cleanedQuestion) ? selectedReport : undefined;
    setIsLoading(true);
    setError("");
    setMessage("");
    setMessageTone("info");
    try {
      const response = await queryReports(cleanedQuestion, scopedParameters({}));
      if (!response.matched || !response.report) {
        if (selectedExampleReport) {
          const missingParameters = selectedExampleReport.parameters.filter((parameter) => parameter.required && !parameters[parameter.name]);
          setSelectedReportId(selectedExampleReport.id);
          if (missingParameters.length) {
            setMessage(`More information is needed before this report can run. ${missingParameters.map((parameter) => parameter.label).join(", ")}`);
            setMessageTone("info");
            setResult(undefined);
            return;
          }

          const nextResult = await runReport(selectedExampleReport.id, scopedParameters(parameters));
          setResult(nextResult);
          setMessage("Ran the selected report example.");
          setMessageTone("info");
          return;
        }
        setMessage(response.message);
        setMessageTone("error");
        setResult(undefined);
        return;
      }
      setSelectedReportId(response.report.id);
      setParameters({ ...initialParameters(response.report), ...(response.parameters ?? {}) });
      if (response.result) {
        setResult(response.result);
        setMessage(response.message);
        setMessageTone("info");
        return;
      }
      setResult(undefined);
      setMessage(response.missingParameters?.length ? `${response.message} ${response.missingParameters.map((parameter) => parameter.label).join(", ")}` : response.message);
      setMessageTone("info");
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

      {message ? <div className={`report-message ${messageTone === "error" ? "is-error" : ""}`} role={messageTone === "error" ? "alert" : "status"}>{message}</div> : null}
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
                <div>
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
    </div>
  );
}
