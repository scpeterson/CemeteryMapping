import { validateUuid } from "../inputValidation.mjs";
import {
  validateCemeteryId, validateGraveSpaceId, validateMutationReason, validateSearchQuery, validateStatuses,
} from "../requestValidation.mjs";
import {
  validateBurialPayload, validateCreateHeadstonePayload, validateGraveFeaturePayload,
  validateGraveSpacePayload, validateHeadstonePayload, validateHeadstoneRelationshipPayload,
  validateMaintenanceRecordPayload, validateOwnershipEventPayload, validateReportParameters,
  validateReportQueryPayload, validateReportRunPayload,
} from "./cemeteryRouteValidation.mjs";

export function registerCemeteryRoutes(app, context) {
  const {
    assignedEditableCemeteryIds, canEditCemetery, canManageUsers, canViewOwnershipForCemetery, config,
    createGraveFeature, createHeadstoneForGrave, createHeadstoneRelationship, createMaintenanceRecord,
    createOwnershipEvent, getCemeteryData, getGraveSpace, getHeadstone, listHeadstoneLookupOptions,
    listReportsForUser, matchReportQuery, pool, requireAdmin, requireCemeteryAdmin, requirePowerUser,
    requireReader, restoreGraveSpace, runReport,
    safelyRecordSystemEvent, searchCemetery, softDeleteGraveFeature, softDeleteGraveSpace,
    softDeleteHeadstoneRelationship, updateBurial, updateGraveFeature, updateGraveSpace, updateHeadstone,
    updateHeadstoneRelationship, updateMaintenanceRecord, validateHeadstoneBusinessRules,
    versionMetadata,
  } = context;
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
  
    app.get("/api/cemetery-map", requireReader, async (_request, response, next) => {
      try {
        response.json(await getCemeteryData(pool));
      } catch (error) {
        if (error.message?.startsWith("Unsupported interment type:")) {
          response.status(400).json({ error: error.message });
          return;
        }
        next(error);
      }
    });
  
    app.get("/api/cemeteries/:cemeteryId/grave-spaces/:id", requireReader, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        const id = validateGraveSpaceId(request.params.id);
        const grave = await getGraveSpace(pool, cemeteryId, id, { includeOwnership: canViewOwnershipForCemetery(request.user, cemeteryId) });
        if (!grave) {
          response.status(404).json({ error: "Grave space not found" });
          return;
        }
  
        response.json(grave);
      } catch (error) {
        next(error);
      }
    });
  
    app.patch("/api/cemeteries/:cemeteryId/grave-spaces/:id", requirePowerUser, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        const id = validateGraveSpaceId(request.params.id);
        const graveSpace = validateGraveSpacePayload(request.body);
        const updated = await updateGraveSpace(pool, cemeteryId, id, graveSpace, {
          actorUser: request.user,
          reason: graveSpace.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!updated) {
          response.status(404).json({ error: "Grave space not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.patch("/api/burials/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Burial id");
        const burial = validateBurialPayload(request.body);
        const updated = await updateBurial(pool, id, burial, {
          actorUser: request.user,
          reason: burial.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!updated) {
          response.status(404).json({ error: "Burial not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/cemeteries/:cemeteryId/grave-features", requirePowerUser, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        if (!canEditCemetery(request.user, cemeteryId)) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        const feature = validateGraveFeaturePayload(request.body);
        const created = await createGraveFeature(pool, cemeteryId, feature, {
          actorUser: request.user,
          reason: feature.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!created) {
          response.status(404).json({ error: "Feature target not found" });
          return;
        }
        response.status(201).json(created);
      } catch (error) {
        next(error);
      }
    });
  
    app.patch("/api/grave-features/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Feature");
        const feature = validateGraveFeaturePayload(request.body, { requireTarget: false });
        const updated = await updateGraveFeature(pool, id, feature, {
          actorUser: request.user,
          reason: feature.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!updated) {
          response.status(404).json({ error: "Feature not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.delete("/api/grave-features/:id", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Feature");
        const deleted = await softDeleteGraveFeature(pool, id, {
          actorUser: request.user,
          reason: validateMutationReason(request.body?.reason),
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!deleted) {
          response.status(404).json({ error: "Feature not found" });
          return;
        }
        if (deleted.forbidden) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        response.json(deleted);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/cemeteries/:cemeteryId/maintenance-records", requirePowerUser, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        if (!canEditCemetery(request.user, cemeteryId)) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        const record = validateMaintenanceRecordPayload(request.body);
        const created = await createMaintenanceRecord(pool, cemeteryId, record, {
          actorUser: request.user,
          reason: record.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!created) {
          response.status(404).json({ error: "Maintenance target not found" });
          return;
        }
        response.status(201).json(created);
      } catch (error) {
        next(error);
      }
    });
  
    app.patch("/api/maintenance-records/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Maintenance record");
        const record = validateMaintenanceRecordPayload(request.body, { requireTarget: false });
        const updated = await updateMaintenanceRecord(pool, id, record, {
          actorUser: request.user,
          reason: record.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!updated) {
          response.status(404).json({ error: "Maintenance record not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/cemeteries/:cemeteryId/grave-spaces/:id/ownership-events", requirePowerUser, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        if (!canEditCemetery(request.user, cemeteryId)) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        const id = validateGraveSpaceId(request.params.id);
        const event = validateOwnershipEventPayload(request.body);
        const created = await createOwnershipEvent(pool, cemeteryId, id, event, {
          actorUser: request.user,
          reason: event.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!created) {
          response.status(404).json({ error: "Grave space not found" });
          return;
        }
        response.status(201).json(created);
      } catch (error) {
        if (error.message?.startsWith("Selected gravesite is not linked to a lot.") || error.message?.startsWith("Unknown gravesite ID:")) {
          response.status(400).json({ error: error.message });
          return;
        }
        next(error);
      }
    });
  
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
  
    app.get("/api/headstone-lookups", requireReader, async (request, response, next) => {
      try {
        response.json(
          await listHeadstoneLookupOptions(pool, {
            allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  
    app.get("/api/headstones/:id", requireReader, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Headstone id");
        const headstone = await getHeadstone(pool, id);
        if (!headstone) {
          response.status(404).json({ error: "Headstone not found" });
          return;
        }
        response.json(headstone);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/cemeteries/:cemeteryId/gravesites/:graveSpaceId/headstones", requirePowerUser, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        const graveSpaceId = validateGraveSpaceId(request.params.graveSpaceId);
        const headstone = validateCreateHeadstonePayload(request.body, graveSpaceId);
        const created = await createHeadstoneForGrave(pool, cemeteryId, graveSpaceId, headstone, {
          actorUser: request.user,
          reason: headstone.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!created) {
          response.status(404).json({ error: "Gravesite not found" });
          return;
        }
        if (created.forbidden) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        if (created.invalid === "duplicate_headstone_id") {
          response.status(400).json({ error: "Marker ID already exists." });
          return;
        }
        response.status(201).json(created);
      } catch (error) {
        next(error);
      }
    });
  
    app.patch("/api/headstones/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Headstone id");
        const headstone = validateHeadstonePayload(request.body);
        await validateHeadstoneBusinessRules(pool, id, headstone);
        const updated = await updateHeadstone(pool, id, headstone, {
          actorUser: request.user,
          reason: headstone.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!updated) {
          response.status(404).json({ error: "Headstone not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/headstones/:id/relationships", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Headstone id");
        const relationship = validateHeadstoneRelationshipPayload(request.body);
        const created = await createHeadstoneRelationship(pool, id, relationship, {
          actorUser: request.user,
          reason: relationship.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!created) {
          response.status(404).json({ error: "Marker relationship target not found" });
          return;
        }
        if (created.forbidden) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        if (created.invalid === "same_marker") {
          response.status(400).json({ error: "A marker cannot be related to itself." });
          return;
        }
        if (created.invalid === "different_cemetery") {
          response.status(400).json({ error: "Related markers must belong to the same cemetery." });
          return;
        }
        response.status(201).json(created);
      } catch (error) {
        next(error);
      }
    });
  
    app.patch("/api/headstone-relationships/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Marker relationship");
        const relationship = validateHeadstoneRelationshipPayload(request.body);
        const updated = await updateHeadstoneRelationship(pool, id, relationship, {
          actorUser: request.user,
          reason: relationship.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!updated) {
          response.status(404).json({ error: "Marker relationship not found" });
          return;
        }
        if (updated.forbidden) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        if (updated.invalid === "same_marker") {
          response.status(400).json({ error: "A marker cannot be related to itself." });
          return;
        }
        if (updated.invalid === "different_cemetery") {
          response.status(400).json({ error: "Related markers must belong to the same cemetery." });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.delete("/api/headstone-relationships/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Marker relationship");
        const deleted = await softDeleteHeadstoneRelationship(pool, id, {
          actorUser: request.user,
          reason: validateMutationReason(request.body?.reason),
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!deleted) {
          response.status(404).json({ error: "Marker relationship not found" });
          return;
        }
        if (deleted.forbidden) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        response.json(deleted);
      } catch (error) {
        next(error);
      }
    });
  
    app.delete("/api/cemeteries/:cemeteryId/grave-spaces/:id", requireAdmin, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        const id = validateGraveSpaceId(request.params.id);
        const reason = validateMutationReason(request.body?.reason);
        const result = await softDeleteGraveSpace(pool, cemeteryId, id, { actorUser: request.user, reason });
        if (!result) {
          response.status(404).json({ error: "Grave space not found" });
          return;
        }
  
        response.json(result);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/cemeteries/:cemeteryId/grave-spaces/:id/restore", requireAdmin, async (request, response, next) => {
      try {
        const cemeteryId = validateCemeteryId(request.params.cemeteryId);
        const id = validateGraveSpaceId(request.params.id);
        const reason = validateMutationReason(request.body?.reason);
        const result = await restoreGraveSpace(pool, cemeteryId, id, { actorUser: request.user, reason });
        if (!result) {
          response.status(404).json({ error: "Grave space not found" });
          return;
        }
  
        response.json(result);
      } catch (error) {
        next(error);
      }
    });
  
}
