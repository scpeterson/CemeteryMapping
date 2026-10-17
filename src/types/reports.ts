import type { AppRoleName } from "./common";

export type ReportParameterDefinition = {
  name: string;
  label: string;
  type: "text";
  required: boolean;
};

export type ReportDefinition = {
  id: string;
  title: string;
  description: string;
  category: string;
  requiredRole: AppRoleName;
  parameters: ReportParameterDefinition[];
  examples: string[];
};

export type ReportResult = {
  report: ReportDefinition;
  summary: string;
  subtitle?: string;
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  notes: string[];
  generatedAt: string;
  layout?: "marker-burial-pages";
};

export type ReportQueryResponse = {
  matched: boolean;
  message: string;
  report?: ReportDefinition;
  parameters?: Record<string, string>;
  missingParameters?: ReportParameterDefinition[];
  availableReports?: ReportDefinition[];
  result?: ReportResult;
};
