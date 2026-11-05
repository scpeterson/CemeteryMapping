// SQL prefix/expressions/suffix are application-owned; imported values stay bound.
// Caller owns the transaction, so any failed chunk rolls back the complete import.
export async function insertValueRows(client, prefix, rows, { valueSql = p => `(${p.join(",")})`, suffix = "", maxRows = 250, maxBytes = 1024 * 1024 } = {}) {
  let pending = [], bytes = 0, columns;
  const flush = async () => {
    if (!pending.length) return;
    const values = pending.flat();
    const tuples = pending.map((row, index) => valueSql(row.map((_, column) => `$${index * columns + column + 1}`)));
    await client.query(`${prefix} VALUES ${tuples.join(",")} ${suffix}`, values);
    pending = []; bytes = 0;
  };
  for (const row of rows) {
    columns ??= row.length;
    if (!columns || row.length !== columns || columns > 65535) throw new Error("Import rows must have a consistent supported column count.");
    const size = Buffer.byteLength(JSON.stringify(row));
    if (pending.length && (pending.length >= maxRows || bytes + size > maxBytes || (pending.length + 1) * columns > 65535)) await flush();
    pending.push(row); bytes += size;
  }
  await flush();
}
