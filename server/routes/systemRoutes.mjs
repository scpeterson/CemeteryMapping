export function registerSystemRoutes(app, context) {
  const { assignedEditableCemeteryIds, canManageUsers, config, pool, requireReader, safelyRecordSystemEvent, versionMetadata } = context;
      app.get("/api/health", async (_request, response, next) => {
        try {
          const result = await pool.query("SELECT now() AS server_time");
          response.json({
            status: "ok",
            environment: config.appEnv.toUpperCase(),
            version: versionMetadata,
            database: config.database.database,
            serverTime: result.rows[0].server_time,
          });
        } catch (error) {
          await safelyRecordSystemEvent(pool, {
            eventType: "health_check",
            severity: "error",
            source: "api-health",
            status: "failed",
            message: error instanceof Error ? error.message : "Health check failed.",
            detail: error instanceof Error ? error.stack : String(error),
            requestMethod: "GET",
            requestPath: "/api/health",
            responseStatus: 500,
            environment: config.appEnv,
            appVersion: versionMetadata.version,
            metadata: {
              gitSha: versionMetadata.gitSha,
            },
          });
          next(error);
        }
      });
    
      app.get("/api/version", (_request, response) => {
        response.json(versionMetadata);
      });
    
      app.get("/api/me", requireReader, async (request, response) => {
        const role = request.user.role;
        const assignedCemeteryIds = assignedEditableCemeteryIds(request.user);
        const hasScopedEditAccess = (role === "power-user" || role === "cemetery-admin") && assignedCemeteryIds.length > 0;
        response.json({
          subject: request.user.subject,
          email: request.user.email,
          displayName: request.user.displayName,
          role,
          assignedCemeteryIds,
          permissions: {
            canViewOwnership: role === "admin" || hasScopedEditAccess,
            canManageUsers: canManageUsers(role),
            canOpenAdminPanel: role === "admin" || role === "power-user" || role === "cemetery-admin",
            canCreateCemeteryRecords: role === "admin",
            canUpdateCemeteryRecords: role === "admin" || hasScopedEditAccess,
            canUpdateHeadstones: role === "admin" || hasScopedEditAccess,
            canUpdateGravesites: role === "admin" || hasScopedEditAccess,
            canUpdateBurials: role === "admin" || hasScopedEditAccess,
            canDeleteCemeteryRecords: role === "admin",
            canDeleteGraveFeatures: role === "admin" || (role === "cemetery-admin" && assignedCemeteryIds.length > 0),
            canDeletePhotos: role === "admin" || (role === "cemetery-admin" && assignedCemeteryIds.length > 0),
          },
        });
      });
    
}
