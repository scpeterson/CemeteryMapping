import { useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { fetchReports, queryReports, runReport } from "../api/reportsApi";
import type { CemeteryData, CurrentUser, ReportDefinition, ReportResult } from "../types";

function initialParameters(report?: ReportDefinition) {
  return Object.fromEntries((report?.parameters ?? []).map((parameter) => [parameter.name, ""]));
}

export function useReportWorkflow(currentUser: CurrentUser, data: CemeteryData) {
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [staleResult, setStaleResult] = useState(false);
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [parameterState, setParameterState] = useState({ reportId: "", values: {} as Record<string, string> });
  const [selectedCemeteryId, updateSelectedCemeteryId] = useState("__all");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ReportResult>();
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const isLoading = isRunning || catalogLoading;
  const activeRequest = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => activeRequest.current?.abort(), []);
  const beginRequest = () => {
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    return request;
  };


  useEffect(() => {
    const request = new AbortController();
    setCatalogLoading(true);
    setCatalogError(false);
    setError("");
    fetchReports(request.signal)
      .then((nextReports) => {
        if (request.signal.aborted) return;
        setReports(nextReports);
        setSelectedReportId((current) => current || nextReports[0]?.id || "");
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!request.signal.aborted) { setCatalogError(true); setError(loadError instanceof Error ? loadError.message : "Unable to load reports."); }
      })
      .finally(() => {
        if (!request.signal.aborted) setCatalogLoading(false);
      });

    return () => {
      request.abort();
    };
  }, [catalogAttempt]);

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

  const parameters = parameterState.reportId === selectedReportId ? parameterState.values : initialParameters(selectedReport);
  const setParameters = (update: SetStateAction<Record<string, string>>) => {
    setParameterState((current) => {
      const values = current.reportId === selectedReportId ? current.values : initialParameters(selectedReport);
      return { reportId: selectedReportId, values: typeof update === "function" ? update(values) : update };
    });
  };

  const selectReport = (report: ReportDefinition) => {
    activeRequest.current?.abort();
    setIsRunning(false);
    setSelectedReportId(report.id);
    setParameterState({ reportId: report.id, values: initialParameters(report) });
    setMessage("");
    setMessageTone("info");
    setError("");
  };

  const executeReport = async (report = selectedReport, reportParameters = parameters) => {
    if (!report) return;
    const request = beginRequest();
    setIsRunning(true);
    setError("");
    setMessage("");
    setMessageTone("info");
    try {
      const nextResult = await runReport(report.id, scopedParameters(reportParameters), request.signal);
      if (request.signal.aborted) return;
      setResult(nextResult);
      setStaleResult(false);
      setSelectedReportId(report.id);
    } catch (runError) {
      if (request.signal.aborted) return;
      setStaleResult(true);
      setError(runError instanceof Error ? runError.message : "Unable to run report.");
    } finally {
      if (!request.signal.aborted) setIsRunning(false);
    }
  };

  const askQuestion = async () => {
    const cleanedQuestion = question.trim();
    if (!cleanedQuestion) return;
    const selectedExampleReport = selectedReport?.examples.includes(cleanedQuestion) ? selectedReport : undefined;
    const request = beginRequest();
    setIsRunning(true);
    setError("");
    setMessage("");
    setMessageTone("info");
    try {
      const response = await queryReports(cleanedQuestion, scopedParameters({}), request.signal);
      if (request.signal.aborted) return;
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

          const nextResult = await runReport(selectedExampleReport.id, scopedParameters(parameters), request.signal);
          if (request.signal.aborted) return;
          setResult(nextResult);
          setStaleResult(false);
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
      setParameterState({ reportId: response.report.id, values: { ...initialParameters(response.report), ...(response.parameters ?? {}) } });
      if (response.result) {
        setResult(response.result);
        setStaleResult(false);
        setMessage(response.message);
        setMessageTone("info");
        return;
      }
      setResult(undefined);
      setMessage(response.missingParameters?.length ? `${response.message} ${response.missingParameters.map((parameter) => parameter.label).join(", ")}` : response.message);
      setMessageTone("info");
    } catch (queryError) {
      if (request.signal.aborted) return;
      setStaleResult(true);
      setError(queryError instanceof Error ? queryError.message : "Unable to query reports.");
    } finally {
      if (!request.signal.aborted) setIsRunning(false);
    }
  };

  const setSelectedCemeteryId = (id: string) => {
    activeRequest.current?.abort();
    setIsRunning(false);
    setStaleResult(true);
    updateSelectedCemeteryId(id);
  };
  const retryCatalog = () => setCatalogAttempt((value) => value + 1);
  return { catalogError, staleResult, reports, selectedReportId, parameters, setParameters, selectedCemeteryId, setSelectedCemeteryId, question, setQuestion, result, message, messageTone, error, isLoading, selectedReport, cemeteryOptions, groupedReports, selectReport, executeReport, askQuestion, retryCatalog };
}
