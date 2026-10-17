# ADR 0075: Defer Protected Gallery Downloads

Status: Accepted

Gallery images begin authenticated downloads only within 200 pixels of the viewport, including scrollable panels. Preview existing thumbnail URLs when supplied; download originals only when the viewer opens. Legacy assets without thumbnails continue to use their original. Overview previews also prefer thumbnails. Report images remain eager so print output is complete.

Keep protected responses uncached (`no-store`). A session cache was considered but deferred because deletion, permission changes, and sign-out must immediately revoke access. Each mounted preview/viewer aborts stale downloads and revokes object URLs on cleanup. No new image-processing dependency or thumbnail generation is introduced.

Validation: `tests/photo-loading.spec.ts`, protected-photo cases in `tests/improvements.spec.ts`, and `npm run build:test`.
