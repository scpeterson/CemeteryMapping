export function registerAdminOperationsRoutes(app, context) {
  const {
    config, getAuditRetentionPolicy, getSystemEventRetentionPolicy, listAuditEvents, listSystemEvents,
    pool, requireAdmin, runAuditRetentionPurgeJob, runSystemEventRetentionPurgeJob,
    updateAuditRetentionPolicy, updateSystemEventRetentionPolicy, validateMutationReason, versionMetadata,
  } = context;
      app.get("/api/admin/audit-events", requireAdmin, async (request, response, next) => {
        try {
          response.json(await listAuditEvents(pool, request.query));
        } catch (error) {
          next(error);
        }
      });
    
      app.get("/api/admin/audit-retention-policy", requireAdmin, async (_request, response, next) => {
        try {
          response.json(await getAuditRetentionPolicy(pool));
        } catch (error) {
          next(error);
        }
      });
    
      app.put("/api/admin/audit-retention-policy", requireAdmin, async (request, response, next) => {
        try {
          const reason = validateMutationReason(request.body?.reason);
          response.json(await updateAuditRetentionPolicy(pool, request.body, { actorUser: request.user, reason }));
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/audit-retention-purge", requireAdmin, async (request, response, next) => {
        try {
          response.json(
            await runAuditRetentionPurgeJob(pool, {
              actorUser: request.user,
              trigger: "admin-api",
              environment: config.appEnv,
              appVersion: versionMetadata.version,
              gitSha: versionMetadata.gitSha,
            }),
          );
        } catch (error) {
          next(error);
        }
      });
    
      app.get("/api/admin/system-event-retention-policy", requireAdmin, async (_request, response, next) => {
        try {
          response.json(await getSystemEventRetentionPolicy(pool));
        } catch (error) {
          next(error);
        }
      });
    
      app.put("/api/admin/system-event-retention-policy", requireAdmin, async (request, response, next) => {
        try {
          const reason = validateMutationReason(request.body?.reason);
          response.json(await updateSystemEventRetentionPolicy(pool, request.body, { actorUser: request.user, reason }));
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/system-event-retention-purge", requireAdmin, async (request, response, next) => {
        try {
          response.json(
            await runSystemEventRetentionPurgeJob(pool, {
              actorUser: request.user,
              trigger: "admin-api",
              environment: config.appEnv,
              appVersion: versionMetadata.version,
              gitSha: versionMetadata.gitSha,
            }),
          );
        } catch (error) {
          next(error);
        }
      });
    
      app.get("/api/admin/system-events", requireAdmin, async (request, response, next) => {
        try {
          response.json(await listSystemEvents(pool, request.query));
        } catch (error) {
          next(error);
        }
      });
    
}
