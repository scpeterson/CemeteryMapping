import { validateUuid } from "../inputValidation.mjs";
import { listAccessRequests, rejectAccessRequest, submitAccessRequest, validateAccessRequest } from "../accessRequestRepository.mjs";

// A bounded per-process limit supplements edge rate limiting. Do not trust client
// supplied forwarding headers: behind a proxy this deliberately shares a bucket.
export function accessRequestLimiter({ now = Date.now, limit = 20, windowMs = 600_000 } = {}) {
  const buckets = new Map();
  return (request, response, next) => {
    const time = now();
    for (const [key, value] of buckets) if (value.until <= time) buckets.delete(key);
    const key = request.ip ?? "unknown";
    if (!buckets.has(key) && buckets.size >= 1000) {
      response.set("Retry-After", "600").status(429).json({ error: "Please try again later." });
      return;
    }
    const bucket = buckets.get(key) ?? { count: 0, until: time + windowMs };
    bucket.count++;
    buckets.set(key, bucket);
    if (bucket.count > limit) {
      response.set("Retry-After", String(Math.ceil((bucket.until - time) / 1000))).status(429).json({ error: "Please try again later." });
      return;
    }
    next();
  };
}

export function registerAccessRequestRoutes(app, { pool, requireAdmin }) {
  app.post("/api/access-requests", accessRequestLimiter(), async (request, response, next) => {
    response.set("Cache-Control", "no-store");
    try {
      const input = validateAccessRequest(request.body);
      if (!request.body?.website) await submitAccessRequest(pool, input);
      response.status(202).json({ message: "Your request has been received. An administrator will review it. Submitting a request does not grant access." });
    } catch (error) { next(error); }
  });
  app.get("/api/admin/access-requests", requireAdmin, async (_request, response, next) => {
    response.set("Cache-Control", "no-store");
    try { response.json(await listAccessRequests(pool)); } catch (error) { next(error); }
  });
  app.post("/api/admin/access-requests/:id/reject", requireAdmin, async (request, response, next) => {
    try {
      await rejectAccessRequest(pool, validateUuid(request.params.id, "Request id"), request.user);
      response.json({ status: "rejected" });
    } catch (error) { next(error); }
  });
}
