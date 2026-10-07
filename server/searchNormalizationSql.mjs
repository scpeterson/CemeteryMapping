import { veteranValues } from "../shared/recordNormalization.mjs";

// Expressions are trusted SQL fragments, never request values.
export function veteranSql(expression) {
  return `lower(btrim(coalesce(${expression}, ''))) IN (${veteranValues.map((value) => `'${value}'`).join(", ")})`;
}
export function normalizedSearchSql(expression) {
  return `lower(regexp_replace(normalize(coalesce(${expression}, ''), NFD), '[\u0300-\u036f]', '', 'g'))`;
}
