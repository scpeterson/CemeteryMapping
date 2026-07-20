export function registerReportRoutes(app, context) {
  const {
    assignedEditableCemeteryIds, listReportsForUser, matchReportQuery, pool, requireReader, runReport,
    searchCemetery, validateReportParameters, validateReportQueryPayload, validateReportRunPayload,
    validateSearchQuery, validateStatuses,
  } = context;
      app.get("/api/search", requireReader, async (request, response, next) => {
        try {
          const query = validateSearchQuery(request.query.q);
          const statuses = validateStatuses(request.query.status);
          const assignedCemeteryIds = assignedEditableCemeteryIds(request.user);
          const hasScopedOwnershipSearch = (request.user.role === "power-user" || request.user.role === "cemetery-admin") && assignedCemeteryIds.length > 0;
          response.json(
            await searchCemetery(pool, {
              query,
              statuses,
              includeOwnership: request.user.role === "admin" || hasScopedOwnershipSearch,
              ownershipCemeteryIds: request.user.role === "admin" ? undefined : assignedCemeteryIds,
            }),
          );
        } catch (error) {
          next(error);
        }
      });
    
      app.get("/api/reports", requireReader, async (request, response) => {
        response.json(listReportsForUser(request.user));
      });
    
      app.post("/api/reports/run", requireReader, async (request, response, next) => {
        try {
          const { reportId, parameters } = validateReportRunPayload(request.body);
          response.json(await runReport(pool, reportId, parameters, request.user));
        } catch (error) {
          if (error.code === "REPORT_NOT_FOUND") {
            response.status(404).json({ error: error.message });
            return;
          }
          if (error.code === "REPORT_FORBIDDEN") {
            response.status(403).json({ error: "Forbidden" });
            return;
          }
          if (error.code === "REPORT_PARAMETER_REQUIRED") {
            response.status(400).json({ error: error.message });
            return;
          }
          if (error.code === "REPORT_PARAMETER_INVALID") {
            response.status(400).json({ error: error.message });
            return;
          }
          next(error);
        }
      });
    
      app.post("/api/reports/query", requireReader, async (request, response, next) => {
        try {
          const { query } = validateReportQueryPayload(request.body);
          const requestedParameters = validateReportParameters(request.body?.parameters);
          const match = matchReportQuery(query);
          const parameters = { ...(match.parameters ?? {}), ...requestedParameters };
          const missingParameters = match.report?.parameters.filter((parameter) => parameter.required && !parameters[parameter.name]) ?? match.missingParameters;
          if (!match.matched || missingParameters?.length) {
            response.json({ ...match, parameters, missingParameters });
            return;
          }
          response.json({
            ...match,
            parameters,
            missingParameters,
            result: await runReport(pool, match.report.id, parameters, request.user),
          });
        } catch (error) {
          if (error.code === "REPORT_FORBIDDEN") {
            response.status(403).json({ error: "Forbidden" });
            return;
          }
          if (error.code === "REPORT_PARAMETER_INVALID") {
            response.status(400).json({ error: error.message });
            return;
          }
          next(error);
        }
      });
    
}
