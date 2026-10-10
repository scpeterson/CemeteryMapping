import express from "express";
import { accessRequestIp, verifyAccessRequestToken } from "../accessRequestProtection.mjs";
import { validateUuid } from "../inputValidation.mjs";
import { listAccessRequests, rejectAccessRequest, submitBoundedAccessRequest, accessRequestStats, validateAccessRequest } from "../accessRequestRepository.mjs";

// Bounded per-process limits protect verification and the database before doing work.
export function accessRequestLimiter({ now = Date.now, limit = 20, windowMs = 600_000, globalLimit = 100, trustProxy = false } = {}) {
  const buckets = new Map();
  let global = { count: 0, until: 0 };
  return (request, response, next) => {
    response.set("Cache-Control", "no-store");
    const time = now();
    for (const [key, value] of buckets) if (value.until <= time) buckets.delete(key);
    const key = accessRequestIp(request, trustProxy);
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
    if (global.until <= time) global = { count: 0, until: time + windowMs };
    if (++global.count > globalLimit) {
      response.set("Retry-After", String(Math.ceil((global.until - time) / 1000))).status(429).json({ error: "Please try again later." }); return;
    }
    next();
  };
}

export function registerAccessRequestRoutes(app, { pool, requireAdmin, protection, verifyToken = verifyAccessRequestToken }) {
  app.post("/api/access-requests", accessRequestLimiter({ trustProxy: protection?.trustProxy }), express.json({ limit: "16kb", inflate: false }), async (request, response, next) => {
    response.set("Cache-Control", "no-store");
    try {
      const input = validateAccessRequest(request.body);
      if (!request.body?.website) {
        if (!await verifyToken(request.body?.turnstileToken, accessRequestIp(request, protection?.trustProxy), protection)) {
          response.status(403).json({ error: "Verification failed. Please complete the verification and try again." }); return;
        }
        const submission = await submitBoundedAccessRequest(pool, input);
        if (!submission.accepted) {
          response.set("Retry-After", String(submission.retryAfter)).status(429).json({ error: "Requests are temporarily at capacity. Please try again later." }); return;
        }
      }
      response.status(202).json({ message: "Your request has been received. An administrator will review it. Submitting a request does not grant access." });
    } catch (error) { next(error); }
  });
  app.get("/api/admin/access-request-stats", requireAdmin, async (_request, response, next) => {
    response.set("Cache-Control", "no-store");
    try { response.json(await accessRequestStats(pool)); } catch (error) { next(error); }
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
