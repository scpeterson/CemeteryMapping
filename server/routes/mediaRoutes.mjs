import { listPhotoContexts, savePhotoContext, validatePhotoContext } from '../monumentPhotoContexts.mjs';
import { optionalText, validateUuid } from "../inputValidation.mjs";
import { BadRequestError, validateMutationReason } from "../requestValidation.mjs";
import { validateMediaUploadMetadata } from "./mediaRouteValidation.mjs";

export function registerMediaRoutes(app, context) {
  const {
    assignedEditableCemeteryIds, createHeadstonePhoto,
    express, moveMediaAssetLink, pool, requireReader, requireCemeteryAdmin, requirePowerUser, softDeleteMediaAsset, uploadRoot,
  } = context;
    app.get('/api/headstones/:id/photo-contexts',requireReader,async(request,response,next)=>{
      try {response.json(await listPhotoContexts(pool,validateUuid(request.params.id,'Monument')));} catch(error){next(error);}
    });
    for(const method of ['put','delete']) app[method]('/api/headstones/:id/photo-contexts/:mediaId',requirePowerUser,async(request,response,next)=>{
      try {
        const result=await savePhotoContext(pool,validateUuid(request.params.id,'Monument'),validateUuid(request.params.mediaId,'Photo'),validatePhotoContext(request.body),{
          actorUser:request.user,allowedCemeteryIds:request.user.role==='admin'?undefined:assignedEditableCemeteryIds(request.user),remove:method==='delete',
        });
        if(!result) return response.status(404).json({error:'Monument not found'});
        response.json(result);
      }catch(error){next(error);}
    });
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
              uploadRoot,
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
  
    // Retired collection endpoint: no files or new gravesite links are created.
    app.post("/api/cemeteries/:cemeteryId/grave-spaces/:id/media-assets", requirePowerUser, (_request, response) => {
      response.status(410).json({ error: "Photos must be attached to a monument. Use the monument photo upload form." });
    });

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
        if (!["earlier", "later", "primary", "automatic"].includes(direction)) throw new BadRequestError("Move direction is invalid.");
        const result = await moveMediaAssetLink(pool, id, {
          linkId,
          linkType,
          direction,
          actorUser: request.user,
          reason: validateMutationReason(request.body?.reason) ?? (direction === "primary" ? "Selected primary photo" : direction === "automatic" ? "Removed primary photo" : "Reordered photo display"),
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
        response.json(result);
      } catch (error) {
        next(error);
      }
    });
  
}
