import { apiBaseUrl } from "../config/environment";
import type { ReportDefinition, ReportQueryResponse, ReportResult } from "../types";
import { authorizedFetch, jsonRequest, jsonResponse, normalizeBaseUrl } from "./apiClient";

export async function fetchReports(): Promise<ReportDefinition[]> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports`);
  return jsonResponse<ReportDefinition[]>(response, "Reports API");
}

export async function runReport(reportId: string, parameters: Record<string, string> = {}): Promise<ReportResult> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports/run`, jsonRequest("POST", { reportId, parameters }));
  return jsonResponse<ReportResult>(response, "Run report API");
}

export async function queryReports(query: string, parameters: Record<string, string> = {}): Promise<ReportQueryResponse> {
  const response = await authorizedFetch(`${normalizeBaseUrl(apiBaseUrl)}/reports/query`, jsonRequest("POST", { query, parameters }));
  return jsonResponse<ReportQueryResponse>(response, "Report query API");
}

