import type {
  DeedInvestigationActionType,
  DeedInvestigationAffidavitStatus,
  DeedInvestigationCouncilStatus,
  DeedInvestigationDeedStatus,
  DeedInvestigationStatus,
  DeedRegistryReviewFilters,
  SaveDeedInvestigationActionInput,
  SaveDeedInvestigationCaseInput,
} from "../types";

export const defaultDeedReviewFilters: DeedRegistryReviewFilters = {
  batchId: "", confidence: "", ownershipScope: "", q: "", limit: 100,
};

export const defaultDeedCaseFilters = { q: "", status: "", limit: 25 };

export const investigationStatusLabels: Record<DeedInvestigationStatus, string> = {
  open: "Open", researching: "Researching", awaiting_family: "Awaiting family", awaiting_council: "Awaiting council", approved: "Approved", denied: "Denied", closed: "Closed",
};

export const affidavitStatusLabels: Record<DeedInvestigationAffidavitStatus, string> = {
  not_needed: "Not needed", needed: "Needed", sent: "Sent", received: "Received", waived: "Waived",
};

export const councilStatusLabels: Record<DeedInvestigationCouncilStatus, string> = {
  not_submitted: "Not submitted", recommended: "Recommended", submitted: "Submitted", approved: "Approved", denied: "Denied", not_required: "Not required",
};

export const deedStatusLabels: Record<DeedInvestigationDeedStatus, string> = {
  not_started: "Not started", pending: "Pending", issued: "Issued", not_issued: "Not issued", not_applicable: "Not applicable",
};

export const deedActionTypeLabels: Record<DeedInvestigationActionType, string> = {
  issue_deed: "Issue deed", replacement_deed: "Replacement deed", inter_ashes: "Inter ashes", approve_marker: "Approve marker", deny_request: "Deny request", document_only: "Document only", other: "Other",
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

export const blankDeedCaseForm = (): SaveDeedInvestigationCaseInput => ({
  cemeteryId: "", caseNumber: `DI-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
  status: "open", subjectName: "", requesterName: "", requesterContact: "", plotReference: "", requestSummary: "", familySummary: "", findings: "", councilDecision: "", affidavitStatus: "not_needed", outcome: "", openedAt: todayIsoDate(), closedAt: "", reason: "Updated deed investigation case.",
});

export const blankDeedActionForm = (): SaveDeedInvestigationActionInput => ({
  subjectName: "", actionType: "issue_deed", plotReference: "", councilStatus: "recommended", councilDecisionDate: "", councilDocumentReference: "", affidavitStatus: "needed", deedStatus: "pending", outcome: "", notes: "", sortOrder: 100, reason: "Updated deed investigation recommended action.",
});
