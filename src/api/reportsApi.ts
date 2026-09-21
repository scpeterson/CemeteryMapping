import { apiBaseUrl } from "../config/environment";
import type { ReportDefinition, ReportQueryResponse, ReportResult } from "../types";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

export async function fetchReports(signal?: AbortSignal): Promise<ReportDefinition[]> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports`, { signal });
  return jsonResponse<ReportDefinition[]>(response, "Reports API");
}

export async function runReport(reportId: string, parameters: Record<string, string> = {}, signal?: AbortSignal): Promise<ReportResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports/run`, { ...jsonRequest("POST", { reportId, parameters }), signal });
  return jsonResponse<ReportResult>(response, "Run report API");
}

export async function queryReports(query: string, parameters: Record<string, string> = {}, signal?: AbortSignal): Promise<ReportQueryResponse> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports/query`, { ...jsonRequest("POST", { query, parameters }), signal });
  return jsonResponse<ReportQueryResponse>(response, "Report query API");
}

