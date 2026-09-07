// Media bytes follow the same reader access policy as cemetery records. Retain
// files for recovery, but never serve soft-deleted assets or arbitrary disk paths.
export function registerMediaDownloadRoutes(app, { pool, requireReader, uploadRoot }) {
  app.get("/media/:storageKey", requireReader, async (request, response, next) => {
    const { storageKey } = request.params;
    if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic|heif)$/iu.test(storageKey)) {
      response.status(404).json({ error: "Photo not found" });
      return;
    }
    try {
      const result = await pool.query(
        "SELECT id FROM media_assets WHERE storage_key = $1 AND deleted_at IS NULL LIMIT 1",
        [storageKey],
      );
      if (!result.rows[0]) {
        response.status(404).json({ error: "Photo not found" });
        return;
      }
      response.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      response.sendFile(storageKey, { root: uploadRoot, cacheControl: false }, (error) => {
        if (!error) return;
        if (!response.headersSent && error.status === 404) response.status(404).json({ error: "Photo not found" });
        else next(error);
      });
    } catch (error) {
      next(error);
    }
  });
}
