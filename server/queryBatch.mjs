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
