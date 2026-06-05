import { withAuditContext } from "./auditContext.mjs";

const validStatuses = new Set(["open", "researching", "awaiting_family", "awaiting_council", "approved", "denied", "closed"]);
const validAffidavitStatuses = new Set(["not_needed", "needed", "sent", "received", "waived"]);
const validActionTypes = new Set(["issue_deed", "replacement_deed", "inter_ashes", "approve_marker", "deny_request", "document_only", "other"]);
const validCouncilStatuses = new Set(["not_submitted", "recommended", "submitted", "approved", "denied", "not_required"]);
const validDeedStatuses = new Set(["not_started", "pending", "issued", "not_issued", "not_applicable"]);

function compact(value) {
  const text = String(value ?? "").trim();
  return text || "";
}

function normalizeLimit(value) {
  const limit = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(limit, 10), 100);
}

function optionalDate(value) {
  const text = compact(value);
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : null;
}

function toCase(row) {
  return {
    id: row.id,
    cemeteryId: row.cemetery_id ?? "",
    cemeteryName: row.cemetery_name ?? "",
    caseNumber: row.case_number,
    status: row.status,
    subjectName: row.subject_name ?? "",
    requesterName: row.requester_name ?? "",
    requesterContact: row.requester_contact ?? "",
    plotReference: row.plot_reference ?? "",
    requestSummary: row.request_summary ?? "",
    familySummary: row.family_summary ?? "",
    findings: row.findings ?? "",
    councilDecision: row.council_decision ?? "",
    affidavitStatus: row.affidavit_status,
    outcome: row.outcome ?? "",
    openedAt: row.opened_at,
    closedAt: row.closed_at ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    linkedEntryCount: Number(row.linked_entry_count ?? 0),
    linkedEntries: row.linked_entries ?? [],
    recommendedActions: row.recommended_actions ?? [],
  };
}

function toAction(row) {
  return {
    id: row.id,
    caseId: row.case_id,
    subjectName: row.subject_name ?? "",
    actionType: row.action_type,
    plotReference: row.plot_reference ?? "",
    councilStatus: row.council_status,
    councilDecisionDate: row.council_decision_date ?? "",
    councilDocumentReference: row.council_document_reference ?? "",
    affidavitStatus: row.affidavit_status,
    deedStatus: row.deed_status,
    outcome: row.outcome ?? "",
    notes: row.notes ?? "",
    sortOrder: Number(row.sort_order ?? 100),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeCaseInput(input = {}) {
  const status = compact(input.status) || "open";
  const affidavitStatus = compact(input.affidavitStatus) || "not_needed";
  if (!validStatuses.has(status)) throw new Error(`Unsupported deed investigation status: ${status}`);
  if (!validAffidavitStatuses.has(affidavitStatus)) throw new Error(`Unsupported affidavit status: ${affidavitStatus}`);

  return {
    cemeteryId: compact(input.cemeteryId) || null,
    caseNumber: compact(input.caseNumber),
    status,
    subjectName: compact(input.subjectName),
    requesterName: compact(input.requesterName),
    requesterContact: compact(input.requesterContact),
    plotReference: compact(input.plotReference),
    requestSummary: compact(input.requestSummary),
    familySummary: compact(input.familySummary),
    findings: compact(input.findings),
    councilDecision: compact(input.councilDecision),
    affidavitStatus,
    outcome: compact(input.outcome),
    openedAt: optionalDate(input.openedAt) ?? new Date().toISOString().slice(0, 10),
    closedAt: optionalDate(input.closedAt),
  };
}

function normalizeActionInput(input = {}) {
  const actionType = compact(input.actionType) || "other";
  const councilStatus = compact(input.councilStatus) || "not_submitted";
  const affidavitStatus = compact(input.affidavitStatus) || "not_needed";
  const deedStatus = compact(input.deedStatus) || "not_started";
  if (!validActionTypes.has(actionType)) throw new Error(`Unsupported recommended action type: ${actionType}`);
  if (!validCouncilStatuses.has(councilStatus)) throw new Error(`Unsupported council status: ${councilStatus}`);
  if (!validAffidavitStatuses.has(affidavitStatus)) throw new Error(`Unsupported affidavit status: ${affidavitStatus}`);
  if (!validDeedStatuses.has(deedStatus)) throw new Error(`Unsupported deed status: ${deedStatus}`);

  return {
    subjectName: compact(input.subjectName),
    actionType,
    plotReference: compact(input.plotReference),
    councilStatus,
    councilDecisionDate: optionalDate(input.councilDecisionDate),
    councilDocumentReference: compact(input.councilDocumentReference),
    affidavitStatus,
    deedStatus,
    outcome: compact(input.outcome),
    notes: compact(input.notes),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
  };
}

async function selectCaseById(client, id) {
  const result = await client.query(
    `
      SELECT
        investigation.id::text,
        investigation.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        investigation.case_number,
        investigation.status,
        investigation.subject_name,
        investigation.requester_name,
        investigation.requester_contact,
        investigation.plot_reference,
        investigation.request_summary,
        investigation.family_summary,
        investigation.findings,
        investigation.council_decision,
        investigation.affidavit_status,
        investigation.outcome,
        investigation.opened_at::text,
        investigation.closed_at::text,
        investigation.created_at,
        investigation.updated_at,
        count(link.deed_registry_entry_id) AS linked_entry_count,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', entry.id::text,
              'sourceRowNumber', entry.source_row_number,
              'ownerDisplayName', entry.owner_display_name,
              'rawLotText', entry.raw_lot_text,
              'rawSectionText', entry.raw_section_text,
              'rawRemarks', entry.raw_remarks,
              'note', link.note
            )
            ORDER BY entry.source_row_number
          ) FILTER (WHERE entry.id IS NOT NULL),
          '[]'::jsonb
        ) AS linked_entries,
        COALESCE(actions.recommended_actions, '[]'::jsonb) AS recommended_actions
      FROM deed_investigation_cases investigation
      LEFT JOIN cemeteries
        ON cemeteries.id = investigation.cemetery_id
      LEFT JOIN deed_investigation_case_entries link
        ON link.case_id = investigation.id
      LEFT JOIN deed_registry_entries entry
        ON entry.id = link.deed_registry_entry_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', action.id::text,
            'caseId', action.case_id::text,
            'subjectName', action.subject_name,
            'actionType', action.action_type,
            'plotReference', action.plot_reference,
            'councilStatus', action.council_status,
            'councilDecisionDate', action.council_decision_date,
            'councilDocumentReference', action.council_document_reference,
            'affidavitStatus', action.affidavit_status,
            'deedStatus', action.deed_status,
            'outcome', action.outcome,
            'notes', action.notes,
            'sortOrder', action.sort_order,
            'createdAt', action.created_at,
            'updatedAt', action.updated_at
          )
          ORDER BY action.sort_order, action.created_at, action.id
        ) AS recommended_actions
        FROM deed_investigation_case_actions action
        WHERE action.case_id = investigation.id
      ) actions ON true
      WHERE investigation.id = $1
      GROUP BY investigation.id, cemeteries.name, actions.recommended_actions
    `,
    [id],
  );
  return result.rows[0] ? toCase(result.rows[0]) : undefined;
}

export async function listDeedInvestigationCases(pool, filters = {}) {
  const q = compact(filters.q).toLowerCase();
  const status = compact(filters.status);
  const conditions = [];
  const values = [];

  if (status && validStatuses.has(status)) {
    values.push(status);
    conditions.push(`investigation.status = $${values.length}`);
  }

  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(
      lower(investigation.case_number) LIKE $${values.length}
      OR lower(investigation.subject_name) LIKE $${values.length}
      OR lower(coalesce(investigation.requester_name, '')) LIKE $${values.length}
      OR lower(coalesce(investigation.plot_reference, '')) LIKE $${values.length}
      OR lower(coalesce(investigation.family_summary, '')) LIKE $${values.length}
      OR lower(coalesce(investigation.findings, '')) LIKE $${values.length}
    )`);
  }

  values.push(normalizeLimit(filters.limit));
  const result = await pool.query(
    `
      SELECT
        investigation.id::text,
        investigation.cemetery_id::text,
        cemeteries.name AS cemetery_name,
        investigation.case_number,
        investigation.status,
        investigation.subject_name,
        investigation.requester_name,
        investigation.requester_contact,
        investigation.plot_reference,
        investigation.request_summary,
        investigation.family_summary,
        investigation.findings,
        investigation.council_decision,
        investigation.affidavit_status,
        investigation.outcome,
        investigation.opened_at::text,
        investigation.closed_at::text,
        investigation.created_at,
        investigation.updated_at,
        count(link.deed_registry_entry_id) AS linked_entry_count,
        '[]'::jsonb AS linked_entries,
        COALESCE(actions.recommended_actions, '[]'::jsonb) AS recommended_actions
      FROM deed_investigation_cases investigation
      LEFT JOIN cemeteries
        ON cemeteries.id = investigation.cemetery_id
      LEFT JOIN deed_investigation_case_entries link
        ON link.case_id = investigation.id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', action.id::text,
            'caseId', action.case_id::text,
            'subjectName', action.subject_name,
            'actionType', action.action_type,
            'plotReference', action.plot_reference,
            'councilStatus', action.council_status,
            'councilDecisionDate', action.council_decision_date,
            'councilDocumentReference', action.council_document_reference,
            'affidavitStatus', action.affidavit_status,
            'deedStatus', action.deed_status,
            'outcome', action.outcome,
            'notes', action.notes,
            'sortOrder', action.sort_order,
            'createdAt', action.created_at,
            'updatedAt', action.updated_at
          )
          ORDER BY action.sort_order, action.created_at, action.id
        ) AS recommended_actions
        FROM deed_investigation_case_actions action
        WHERE action.case_id = investigation.id
      ) actions ON true
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      GROUP BY investigation.id, cemeteries.name, actions.recommended_actions
      ORDER BY investigation.opened_at DESC, investigation.created_at DESC, investigation.id
      LIMIT $${values.length}
    `,
    values,
  );
  return result.rows.map(toCase);
}

export async function createDeedInvestigationCase(pool, input, audit = {}) {
  const investigation = normalizeCaseInput(input);
  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        INSERT INTO deed_investigation_cases (
          cemetery_id, case_number, status, subject_name, requester_name, requester_contact,
          plot_reference, request_summary, family_summary, findings, council_decision,
          affidavit_status, outcome, opened_at, closed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id::text
      `,
      [
        investigation.cemeteryId,
        investigation.caseNumber,
        investigation.status,
        investigation.subjectName,
        investigation.requesterName || null,
        investigation.requesterContact || null,
        investigation.plotReference || null,
        investigation.requestSummary || null,
        investigation.familySummary || null,
        investigation.findings || null,
        investigation.councilDecision || null,
        investigation.affidavitStatus,
        investigation.outcome || null,
        investigation.openedAt,
        investigation.closedAt,
      ],
    );
    return selectCaseById(client, result.rows[0].id);
  });
}

export async function updateDeedInvestigationCase(pool, id, input, audit = {}) {
  const investigation = normalizeCaseInput(input);
  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        UPDATE deed_investigation_cases
        SET cemetery_id = $2,
            case_number = $3,
            status = $4,
            subject_name = $5,
            requester_name = $6,
            requester_contact = $7,
            plot_reference = $8,
            request_summary = $9,
            family_summary = $10,
            findings = $11,
            council_decision = $12,
            affidavit_status = $13,
            outcome = $14,
            opened_at = $15,
            closed_at = $16
        WHERE id = $1
        RETURNING id::text
      `,
      [
        id,
        investigation.cemeteryId,
        investigation.caseNumber,
        investigation.status,
        investigation.subjectName,
        investigation.requesterName || null,
        investigation.requesterContact || null,
        investigation.plotReference || null,
        investigation.requestSummary || null,
        investigation.familySummary || null,
        investigation.findings || null,
        investigation.councilDecision || null,
        investigation.affidavitStatus,
        investigation.outcome || null,
        investigation.openedAt,
        investigation.closedAt,
      ],
    );
    return result.rows[0] ? selectCaseById(client, id) : undefined;
  });
}

export async function linkDeedInvestigationCaseEntry(pool, caseId, entryId, note = "", audit = {}) {
  return withAuditContext(pool, audit, async (client) => {
    await client.query(
      `
        INSERT INTO deed_investigation_case_entries (case_id, deed_registry_entry_id, note)
        VALUES ($1, $2, $3)
        ON CONFLICT (case_id, deed_registry_entry_id) DO UPDATE
        SET note = EXCLUDED.note
      `,
      [caseId, entryId, compact(note) || null],
    );
    return selectCaseById(client, caseId);
  });
}

export async function createDeedInvestigationCaseAction(pool, caseId, input, audit = {}) {
  const action = normalizeActionInput(input);
  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        INSERT INTO deed_investigation_case_actions (
          case_id, subject_name, action_type, plot_reference, council_status,
          council_decision_date, council_document_reference, affidavit_status,
          deed_status, outcome, notes, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING
          id::text,
          case_id::text,
          subject_name,
          action_type,
          plot_reference,
          council_status,
          council_decision_date::text,
          council_document_reference,
          affidavit_status,
          deed_status,
          outcome,
          notes,
          sort_order,
          created_at,
          updated_at
      `,
      [
        caseId,
        action.subjectName,
        action.actionType,
        action.plotReference || null,
        action.councilStatus,
        action.councilDecisionDate,
        action.councilDocumentReference || null,
        action.affidavitStatus,
        action.deedStatus,
        action.outcome || null,
        action.notes || null,
        action.sortOrder,
      ],
    );
    return toAction(result.rows[0]);
  });
}

export async function updateDeedInvestigationCaseAction(pool, caseId, actionId, input, audit = {}) {
  const action = normalizeActionInput(input);
  return withAuditContext(pool, audit, async (client) => {
    const result = await client.query(
      `
        UPDATE deed_investigation_case_actions
        SET subject_name = $3,
            action_type = $4,
            plot_reference = $5,
            council_status = $6,
            council_decision_date = $7,
            council_document_reference = $8,
            affidavit_status = $9,
            deed_status = $10,
            outcome = $11,
            notes = $12,
            sort_order = $13
        WHERE case_id = $1
          AND id = $2
        RETURNING
          id::text,
          case_id::text,
          subject_name,
          action_type,
          plot_reference,
          council_status,
          council_decision_date::text,
          council_document_reference,
          affidavit_status,
          deed_status,
          outcome,
          notes,
          sort_order,
          created_at,
          updated_at
      `,
      [
        caseId,
        actionId,
        action.subjectName,
        action.actionType,
        action.plotReference || null,
        action.councilStatus,
        action.councilDecisionDate,
        action.councilDocumentReference || null,
        action.affidavitStatus,
        action.deedStatus,
        action.outcome || null,
        action.notes || null,
        action.sortOrder,
      ],
    );
    return result.rows[0] ? toAction(result.rows[0]) : undefined;
  });
}
