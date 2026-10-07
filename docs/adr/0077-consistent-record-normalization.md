# ADR 0077: Consistent Record Normalization

Status: Accepted

Search input and stored text use lowercase Unicode NFD decomposition with combining marks U+0300–U+036F removed. Local map fallback uses the same JavaScript normalizer as the server. PostgreSQL uses its built-in normalize/regexp_replace functions, so no extension or migration is required. Stored spellings and displayed reasons remain unchanged.

One shared set defines affirmative veteran values: yes, y, true, 1, veteran, case-insensitively and with surrounding whitespace ignored. Map flags, search, burial mapping, reports, and data quality SQL consume that set. Unknown values remain false.

Validation: record normalization unit tests, real SQL/JavaScript parity tests, transactionally rolled-back accented-name/veteran searches against TEST, server tests, and TEST build. Expression indexes should follow measured query plans rather than be added speculatively.
