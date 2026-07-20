export async function tableColumnExists(client, tableName, columnName) {
  const result = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName],
  );
  return Boolean(result.rows[0]?.exists);
}

export async function sectionAlternateNamesSelect(client) {
  return (await tableColumnExists(client, "sections", "alternate_names")) ? "alternate_names" : "'{}'::text[] AS alternate_names";
}

/** Supplies neutral review fields while supporting databases before the review-columns migration. */
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
