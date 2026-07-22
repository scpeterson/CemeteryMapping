export function registerGraveRoutes(app, context) {
  const {
    assignedEditableCemeteryIds, canEditCemetery, canViewOwnershipForCemetery, createGraveFeature,
    createMaintenanceRecord, createOwnershipEvent, getCemeteryData, getGraveSpace, pool,
    config, importGeoNamesPlace, PlaceSearchUnavailableError, searchGeoNames,
    requireCemeteryAdmin, requirePowerUser, requireReader, softDeleteGraveFeature, updateBurial,
    updateGraveFeature, updateGraveSpace, updateMaintenanceRecord, validateBurialPayload,
    validateCemeteryId, validateGraveFeaturePayload, validateGraveSpaceId, validateGraveSpacePayload,
    validateMaintenanceRecordPayload, validateMutationReason, validateOwnershipEventPayload, validateUuid,
  } = context;
      app.get("/api/places/search", requirePowerUser, async (request, response, next) => {
        try {
          const query = String(request.query.q ?? "").trim();
          if (query.length < 2 || query.length > 120) {
            response.status(400).json({ error: "Place search must be between 2 and 120 characters." });
            return;
          }
          const results = await searchGeoNames(config.placeSearch, query);
          response.json({ available: true, results });
        } catch (error) {
          if (error instanceof PlaceSearchUnavailableError) {
            response.json({ available: false, results: [], message: error.message });
            return;
          }
          next(error);
        }
      });

      app.post("/api/places/import", requirePowerUser, async (request, response, next) => {
        try {
          const providerId = String(request.body?.providerId ?? "").trim();
          if (!/^\d+$/u.test(providerId)) {
            response.status(400).json({ error: "GeoNames place identifier is invalid." });
            return;
          }
          const place = await importGeoNamesPlace(pool, providerId, config.placeSearch, { actorUser: request.user });
          response.status(201).json(place);
        } catch (error) {
          if (error instanceof PlaceSearchUnavailableError) {
            response.status(503).json({ error: error.message, code: "place_search_unavailable" });
            return;
          }
          next(error);
        }
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
    
}
