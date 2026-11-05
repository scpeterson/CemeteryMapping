// Use only with a pool: a single pg client still serializes its queries.
export async function runBoundedQueries(queries, concurrency = 3) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError("Query concurrency must be a positive integer.");
  const results = new Array(queries.length);
  let next = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(concurrency, queries.length) }, async () => {
    while (!failed && next < queries.length) {
      const index = next++;
      try { results[index] = await queries[index](); }
      catch (error) { failed = true; throw error; }
    }
  });
  // Drain already-started queries on failure; do not abandon pool work.
  const completed = await Promise.allSettled(workers);
  const failure = completed.find((worker) => worker.status === "rejected");
  if (failure) throw failure.reason;
  return results;
}

// Reference lists only: statements are application-owned SQL without parameters.
// Keep rows in their original SELECT order and return ordinary pg-style holders.
export function batchedReadQueries(client) {
  const statements = [];
  const holders = [];
  return {
    read(sql) {
      if (!/^\s*SELECT\b/iu.test(sql)) throw new TypeError("Only reference SELECTs can be batched.");
      if (statements.length >= 50) throw new RangeError("Too many reference SELECTs.");
      statements.push(sql.trim().replace(/;$/u, ""));
      const result = { rows: [] };
      holders.push(result);
      return result;
    },
    async execute() {
      if (!statements.length) return;
      const ctes = statements.map((sql, i) => `q${i} AS MATERIALIZED (${sql})`).join(",\n");
      const lists = statements.map((_, i) => `'q${i}', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM q${i} r)`).join(",\n");
      const { rows } = await client.query(`WITH ${ctes} SELECT jsonb_build_object(${lists}) AS reference_lists`);
      for (let i = 0; i < holders.length; i++) holders[i].rows = rows[0].reference_lists[`q${i}`];
    },
  };
}
