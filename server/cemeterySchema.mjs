export async function tableColumnExists(client, tableName, columnName) {
  void client;
  const currentColumns = {
    sections: new Set(["alternate_names"]),
    burials: new Set(["data_confidence"]),
    headstones: new Set(["data_confidence"]),
  };
  return currentColumns[tableName]?.has(columnName) ?? false;
}

export async function sectionAlternateNamesSelect(client) {
  return (await tableColumnExists(client, "sections", "alternate_names")) ? "alternate_names" : "'{}'::text[] AS alternate_names";
}

/** Selects review fields guaranteed by the current schema contract. */
export async function recordReviewColumnsSql(client, tableAlias) {
  const tableName = tableAlias === "headstones" ? "headstones" : "burials";
  if (!(await tableColumnExists(client, tableName, "data_confidence"))) {
    return `
      'unknown'::text AS data_confidence,
      'unreviewed'::text AS review_status,
      NULL::text AS review_notes,
      false AS source_conflict,
      NULL::text AS reviewed_by,
      NULL::timestamptz AS reviewed_at
    `;
  }
  return `
    ${tableAlias}.data_confidence,
    ${tableAlias}.review_status,
    ${tableAlias}.review_notes,
    ${tableAlias}.source_conflict,
    ${tableAlias}.reviewed_by,
    ${tableAlias}.reviewed_at
  `;
}
