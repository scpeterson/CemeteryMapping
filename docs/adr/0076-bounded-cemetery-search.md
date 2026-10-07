# ADR 0076: Bound Cemetery Search Responses and Rendering

Status: Accepted

`GET /api/search` accepts a cemetery UUID, limit (1–100, default 50), and offset (0–100000). It retains its array response and returns `X-Search-Has-More`. Pagination selects complete gravesite groups, preserving all reasons and stable ordering. Ownership scope remains independently enforced by the API.

The browser requests 50 graves at a time within the selected cemetery. Search results, including loaded map fallback and lots, render at most 50 cards per page. Next fetches another server page when needed. Query/status/scope changes discard old requests and pages. Map highlighting covers loaded results; the count explicitly says when more results remain.

Cemetery scoping bounds irrelevant database work. Matching still scans substring branches within that scope; offset pagination does not promise constant database latency. Capture representative `EXPLAIN (ANALYZE, BUFFERS)` plans before adding trigram/expression indexes. This change bounds transfer and DOM work without speculative indexes.

Validation: search pagination/validation unit tests, `tests/search-pagination.spec.ts`, existing search recovery and map highlighting tests, and TEST build.

A local TEST comparison of the same largest-cemetery name query measured 473.6 ms/775 rows for the original and 107.1 ms/51 rows (including lookahead) after pagination and materializing base summaries. This is a single local warm-cache observation, not a production service-level guarantee. Materializing base summaries avoids repeated derived-status evaluation and the expensive plan seen in the first pagination prototype.
