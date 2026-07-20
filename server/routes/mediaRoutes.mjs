export function registerMediaRoutes(app, context) {
  const {
    BadRequestError, assignedEditableCemeteryIds, canEditCemetery, createGraveSpacePhoto,
    createHeadstonePhoto, express, moveMediaAssetLink, optionalText, pool, requireCemeteryAdmin,
    requirePowerUser, softDeleteMediaAsset, validateCemeteryId, validateGraveSpaceId,
    validateMediaUploadMetadata, validateMutationReason, validateUuid,
  } = context;
    app.post(
      "/api/headstones/:id/media-assets",
      requirePowerUser,
      express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"], limit: "25mb" }),
      async (request, response, next) => {
        try {
          const id = validateUuid(request.params.id, "Headstone id");
          const metadata = validateMediaUploadMetadata(request.query);
          const created = await createHeadstonePhoto(
            pool,
            id,
            {
              bytes: request.body,
              contentType: request.headers["content-type"],
              originalFilename: metadata.originalFilename,
            },
            metadata,
            {
              actorUser: request.user,
              allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
            },
          );
          if (!created) {
            response.status(404).json({ error: "Headstone not found" });
            return;
          }
          response.status(201).json(created);
        } catch (error) {
          if (error.message === "Unsupported photo type." || error.message === "Photo file is required.") {
            response.status(400).json({ error: error.message });
            return;
          }
          next(error);
        }
      },
    );
  
    app.post(
      "/api/cemeteries/:cemeteryId/grave-spaces/:id/media-assets",
      requirePowerUser,
      express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"], limit: "25mb" }),
      async (request, response, next) => {
        try {
          const cemeteryId = validateCemeteryId(request.params.cemeteryId);
          if (!canEditCemetery(request.user, cemeteryId)) {
            response.status(403).json({ error: "Forbidden" });
            return;
          }
          const id = validateGraveSpaceId(request.params.id);
          const metadata = validateMediaUploadMetadata(request.query);
          const created = await createGraveSpacePhoto(
            pool,
            cemeteryId,
            id,
            {
              bytes: request.body,
              contentType: request.headers["content-type"],
              originalFilename: metadata.originalFilename,
            },
            metadata,
            {
              actorUser: request.user,
              allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
            },
          );
          if (!created) {
            response.status(404).json({ error: "Grave space or headstone not found" });
            return;
          }
          response.status(201).json(created);
        } catch (error) {
          if (error.message === "Unsupported photo type." || error.message === "Photo file is required.") {
            response.status(400).json({ error: error.message });
            return;
          }
          next(error);
        }
      },
    );
  
    app.delete("/api/media-assets/:id", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Media asset id");
        const deleted = await softDeleteMediaAsset(pool, id, {
          actorUser: request.user,
          reason: validateMutationReason(request.body?.reason),
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!deleted) {
          response.status(404).json({ error: "Photo not found" });
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
  
    app.patch("/api/media-assets/:id/order", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Media asset id");
        const linkId = validateUuid(request.body?.linkId, "Media link id");
        const linkType = optionalText(request.body?.linkType, "Media link type", 20);
        const direction = optionalText(request.body?.direction, "Move direction", 20);
        if (!["headstone", "gravesite"].includes(linkType)) throw new BadRequestError("Media link type is invalid.");
        if (!["earlier", "later"].includes(direction)) throw new BadRequestError("Move direction is invalid.");
        const result = await moveMediaAssetLink(pool, id, {
          linkId,
          linkType,
          direction,
          actorUser: request.user,
          reason: validateMutationReason(request.body?.reason) ?? "Reordered photo display",
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!result) {
          response.status(404).json({ error: "Photo not found" });
          return;
        }
        if (result.forbidden) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        if (!result.moved) {
          response.status(404).json({ error: "Adjacent photo not found" });
          return;
        }
        response.json(result);
      } catch (error) {
        next(error);
      }
    });
  
}
