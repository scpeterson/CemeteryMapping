export function registerHeadstoneRoutes(app, context) {
  const {
    assignedEditableCemeteryIds, createHeadstoneForGrave, createHeadstoneRelationship, getHeadstone,
    listHeadstoneLookupOptions, pool, requireAdmin, requirePowerUser, requireReader, restoreGraveSpace,
    softDeleteGraveSpace, softDeleteHeadstoneRelationship, updateHeadstone, updateHeadstoneRelationship,
    validateCemeteryId, validateCreateHeadstonePayload, validateGraveSpaceId,
    validateHeadstoneBusinessRules, validateHeadstonePayload, validateHeadstoneRelationshipPayload,
    validateMutationReason, validateUuid,
  } = context;
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
