function displayName(value) {
  return String(value ?? "")
    .replace(/^[\s"“”]+|[\s"“”]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function mergeEvidenceLinks(left = [], right = []) {
  const linksByKey = new Map();
  for (const link of [...left, ...right]) {
    const key = link?.id ? `id:${link.id}` : `${link?.status ?? ""}:${link?.reviewedAt ?? ""}:${link?.notes ?? ""}`;
    if (key) linksByKey.set(key, link);
  }
  return [...linksByKey.values()];
}

function dedupeHeadstoneCandidates(candidates = []) {
  const candidatesById = new Map();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!candidate?.id) continue;
    const existing = candidatesById.get(candidate.id);
    if (existing) {
      candidatesById.set(candidate.id, {
        ...existing,
        evidence: mergeEvidenceLinks(existing.evidence, candidate.evidence),
      });
    } else {
      candidatesById.set(candidate.id, {
        ...candidate,
        evidence: Array.isArray(candidate.evidence) ? candidate.evidence : [],
      });
    }
  }
  return [...candidatesById.values()].sort((left, right) => String(left.headstoneId ?? "").localeCompare(String(right.headstoneId ?? "")) || String(left.id).localeCompare(String(right.id)));
}

function toCandidateMatch(candidate) {
  return {
    ...candidate,
    fullName: displayName(candidate.fullName),
    gravesiteEvidence: Array.isArray(candidate.gravesiteEvidence) ? candidate.gravesiteEvidence : [],
    headstoneCandidates: dedupeHeadstoneCandidates(candidate.headstoneCandidates),
  };
}

function buildProcessingSummary({ candidateMatches, sourceFacts, observations }) {
  const pendingSourceFacts = sourceFacts.filter((fact) => fact.status === "staged").length;
  const pendingObservations = observations.filter((observation) => observation.status === "staged").length;
  const pendingGravesites = candidateMatches.filter((match) => match.gravesiteEvidence.length === 0).length;
  const headstoneCandidates = candidateMatches.flatMap((match) => match.headstoneCandidates);
  const pendingHeadstones = headstoneCandidates.filter((headstone) => headstone.evidence.length === 0).length;
  const totalCount = sourceFacts.length + observations.length + candidateMatches.length + headstoneCandidates.length;
  const pendingCount = pendingSourceFacts + pendingObservations + pendingGravesites + pendingHeadstones;
  if (!totalCount) {
    return {
      isProcessed: false,
      pendingCount: 0,
      totalCount: 0,
      label: "No review items",
      detail: "No candidate matches, source facts, or observations are available for this reading yet.",
    };
  }
  if (pendingCount === 0) {
    return {
      isProcessed: true,
      pendingCount,
      totalCount,
      label: "Processed",
      detail: "All matches, source facts, and observations returned by the review service have been linked, rejected, reviewed, promoted, or flagged.",
    };
  }
  return {
    isProcessed: false,
    pendingCount,
    totalCount,
    label: `${pendingCount} pending`,
    detail: `${pendingCount} of ${totalCount} review item${totalCount === 1 ? "" : "s"} still need a link, rejection, review, promotion, or field-check decision.`,
  };
}

export function toBatch(row) {
  return {
    id: row.id,
    cemeteryName: row.cemetery_name ?? "",
    sourceName: row.source_name,
    importedBy: row.imported_by ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    entryCount: Number(row.entry_count ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    lowConfidenceCount: Number(row.low_confidence_count ?? 0),
    matchedCount: Number(row.matched_count ?? 0),
  };
}

export function toSummary(row) {
  return {
    parseConfidence: row.parse_confidence,
    status: row.status,
    count: Number(row.count ?? 0),
  };
}

export function toEntry(row) {
  const candidateMatches = (row.candidate_matches ?? []).map(toCandidateMatch);
  const sourceFacts = row.source_facts ?? [];
  const observations = row.observations ?? [];
  return {
    id: row.id,
    batchId: row.batch_id,
    sourcePageNumber: row.source_page_number,
    sourcePageIndex: row.source_page_index,
    sourceLineStart: row.source_line_start,
    sourceLineEnd: row.source_line_end,
    nameText: row.name_text ?? "",
    surnames: row.surnames ?? [],
    rawText: row.raw_text ?? "",
    parsedSectionName: row.parsed_section_name ?? "",
    parsedRowNumber: row.parsed_row_number,
    parsedPositionNumber: row.parsed_position_number,
    parsedMarkerScope: row.parsed_marker_scope ?? "",
    markerTypeText: row.marker_type_text ?? "",
    materialText: row.material_text ?? "",
    conditionText: row.condition_text ?? "",
    inscriptionText: row.inscription_text ?? "",
    parsedYears: row.parsed_years ?? [],
    parseConfidence: row.parse_confidence,
    parseNotes: row.parse_notes ?? [],
    status: row.status,
    candidateMatchCount: Number(row.candidate_match_count ?? 0),
    candidateMatches,
    sourceFacts,
    observations,
    processingSummary: buildProcessingSummary({ candidateMatches, sourceFacts, observations }),
  };
}

export function toEvidenceLink(row) {
  return {
    id: row.id,
    entryId: row.entry_id,
    targetType: row.target_type,
    targetId: row.target_id,
    status: row.status,
    confidence: row.confidence,
    notes: row.notes ?? "",
    reviewedByEmail: row.reviewed_by_email ?? "",
    reviewedAt: row.reviewed_at,
  };
}

