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

function isVeteranReportValue(value: unknown) {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["yes", "y", "true", "1", "veteran"].includes(value.trim().toLowerCase());
}

function reportDecorations(value: unknown): Array<{ code: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { code: string; label: string } => (
    typeof item === "object" && item !== null && typeof (item as { code?: unknown }).code === "string" && typeof (item as { label?: unknown }).label === "string"
  ));
}

function DetailItem({
  label,
  value,
  className = "",
  showEmpty = false,
  emptyValue = "—",
}: {
  label: string;
  value: unknown;
  className?: string;
  showEmpty?: boolean;
  emptyValue?: string;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  if (isEmpty && !showEmpty) return null;
  return (
    <div className={`marker-burial-detail ${className}`.trim()}>
      <dt>{label}</dt>
      <dd>{isEmpty ? emptyValue : formatReportValue(value)}</dd>
    </div>
  );
}

function groupMarkerBurials(rows: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();
  rows.forEach((row) => {
    const markerKey = String(row.marker_uuid ?? row.marker_id);
    groups.set(markerKey, [...(groups.get(markerKey) ?? []), row]);
  });
  return [...groups.values()];
}

type ReportMarkerFeature = {
  id?: string;
  type?: string;
  subtype?: string;
  placement?: string;
  material?: string;
  symbolText?: string;
  notes?: string;
  status?: string;
};

function reportMarkerFeatures(value: unknown): ReportMarkerFeature[] {
  return Array.isArray(value) ? value.filter((feature): feature is ReportMarkerFeature => typeof feature === "object" && feature !== null) : [];
}

function MarkerBurialPages({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <div className="report-empty">No linked marker burials matched these filters.</div>;
  const markerGroups = groupMarkerBurials(rows);

  return (
    <div className="marker-burial-pages">
      {markerGroups.map((burials, markerIndex) => {
        const marker = burials[0];
        const locations = [...new Set(burials.map((burial) =>
          [burial.section ? `Section ${String(burial.section)}` : "", burial.grave].filter(Boolean).join(" · "),
        ).filter(Boolean))];
        const markerFeatures = reportMarkerFeatures(marker.marker_features);

        return (
        <article className="marker-burial-page" key={String(marker.marker_uuid ?? marker.marker_id)}>
          <header className="marker-burial-marker-header">
            <div>
              <p className="marker-burial-kicker">Marker burial records</p>
              <h1>{reportText(marker, "marker_id")}</h1>
              <p>{[marker.cemetery, ...locations].filter(Boolean).join(" · ")}</p>
            </div>
            <span>Marker {markerIndex + 1} of {markerGroups.length}</span>
          </header>
          {marker.photo_url ? <img className="marker-burial-photo" src={String(marker.photo_url)} alt={`Marker ${String(marker.marker_id)}`} /> : <div className="marker-burial-photo-placeholder">No marker photo available</div>}
          <section>
            <h2>Marker information</h2>
            <dl className="marker-burial-details">
              <DetailItem label="Marker ID" value={marker.marker_id} />
              <DetailItem label="Type" value={marker.marker_type} />
              <DetailItem label="Scope" value={marker.marker_scope} />
              <DetailItem label="Material" value={marker.marker_material} />
              <DetailItem label="Condition" value={marker.marker_condition} />
              <DetailItem label="Inscription" value={marker.inscription} className="marker-burial-detail--inscription" />
              <DetailItem label="Design" value={marker.design_notes} />
              <DetailItem label="Back" value={marker.back_description} />
              <DetailItem label="Condition notes" value={marker.condition_notes} />
            </dl>
            {markerFeatures.length ? (
              <div className="marker-burial-features">
                <h3>Associated features</h3>
                <ul>
                  {markerFeatures.map((feature) => {
                    const attributes = [feature.subtype, feature.placement, feature.material, feature.symbolText].filter(Boolean);
                    return (
                      <li key={feature.id ?? `${feature.type}:${attributes.join(":")}`}>
                        <strong>{feature.type ?? "Feature"}</strong>
                        {attributes.length ? <span>{attributes.join(" · ")}</span> : null}
                        {feature.notes ? <span>{feature.notes}</span> : null}
                        {feature.status && feature.status !== "active" ? <span>Status: {feature.status.replaceAll("_", " ")}</span> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </section>
          {burials.map((burial, burialIndex) => (
            <section className="marker-burial-person" key={String(burial.burial_uuid)}>
              <h2>Burial {burialIndex + 1} of {burials.length}</h2>
              <h3 className="marker-burial-person-name">
                <span>{reportText(burial, "person")}</span>
                {isVeteranReportValue(burial.veteran) ? <span className="burial-veteran-badge">Veteran</span> : null}
                {reportDecorations(burial.military_decorations).map((decoration) => (
                  <span key={decoration.code} className={decoration.code === "purple_heart" ? "burial-decoration-badge is-purple-heart" : "burial-decoration-badge"}>
                    {decoration.label}
                  </span>
                ))}
              </h3>
              <dl className="marker-burial-details">
                <DetailItem label="Gravesite" value={burial.grave} showEmpty />
                <DetailItem label="Record ID" value={burial.gravesite_id} showEmpty />
                <DetailItem label="Birth" value={burial.birth_date} showEmpty />
                <DetailItem label="Death" value={burial.death_date} showEmpty emptyValue="Still living" />
                <DetailItem label="Burial" value={burial.burial_date} showEmpty />
                <DetailItem label="Interment" value={burial.interment_type} showEmpty />
                <DetailItem label="Record status" value={burial.record_status} showEmpty />
                <DetailItem label="Funeral home" value={burial.funeral_home} showEmpty />
                <DetailItem label="Branch" value={burial.military_branch} showEmpty />
                <DetailItem label="Rank" value={burial.military_rank} showEmpty />
                <DetailItem label="War/service" value={burial.military_war_service} showEmpty />
                <DetailItem label="Notes" value={burial.burial_notes} className="marker-burial-detail--notes" showEmpty />
              </dl>
              <div className="marker-burial-nhg">
                <h3>North Hills Genealogists text</h3>
                <p>{burial.nhg_text ? String(burial.nhg_text) : "No linked NHG text."}</p>
              </div>
            </section>
          ))}
        </article>
        );
      })}
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
    </div>
  );
}
