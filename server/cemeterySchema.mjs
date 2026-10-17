export function sectionAlternateNamesSelect() {
  return "alternate_names";
}

/** Selects review fields guaranteed by the current schema contract. */
export function recordReviewColumnsSql(tableAlias) {
  return `
    ${tableAlias}.data_confidence,
    ${tableAlias}.review_status,
    ${tableAlias}.review_notes,
    ${tableAlias}.source_conflict,
    ${tableAlias}.reviewed_by,
    ${tableAlias}.reviewed_at
  `;
}
