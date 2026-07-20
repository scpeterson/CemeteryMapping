export function registerAdminReviewRoutes(app, context) {
  const {
    assignedEditableCemeteryIds, createDeedInvestigationCase, createDeedInvestigationCaseAction,
    deleteNorthHillsOcrEvidenceLink, linkDeedInvestigationCaseEntry, listDeedInvestigationCases,
    listDeedRegistryReview, listNorthHillsOcrReview, pool, promoteNorthHillsSourceFact, requireAdmin,
    requireCemeteryAdmin, reviewNorthHillsSourceFact, saveNorthHillsOcrEvidenceLink,
    updateDeedInvestigationCase, updateDeedInvestigationCaseAction, updateNorthHillsOcrEntry,
    validateDeedInvestigationCaseActionPayload, validateDeedInvestigationCaseLinkPayload,
    validateDeedInvestigationCasePayload, validateNorthHillsEntryPayload, validateNorthHillsEvidencePayload,
    validateNorthHillsEvidenceTargetPayload, validateNorthHillsSourceFactPromotionPayload,
    validateNorthHillsSourceFactReviewPayload, validateUuid,
  } = context;
      app.get("/api/admin/deed-registry-review", requireAdmin, async (request, response, next) => {
        try {
          response.json(await listDeedRegistryReview(pool, request.query));
        } catch (error) {
          next(error);
        }
      });
    
      app.get("/api/admin/deed-investigation-cases", requireAdmin, async (request, response, next) => {
        try {
          response.json(await listDeedInvestigationCases(pool, request.query));
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/deed-investigation-cases", requireAdmin, async (request, response, next) => {
        try {
          const investigation = validateDeedInvestigationCasePayload(request.body);
          response.status(201).json(await createDeedInvestigationCase(pool, investigation, { actorUser: request.user, reason: investigation.reason }));
        } catch (error) {
          next(error);
        }
      });
    
      app.put("/api/admin/deed-investigation-cases/:caseId", requireAdmin, async (request, response, next) => {
        try {
          const caseId = validateUuid(request.params.caseId, "Investigation case");
          const investigation = validateDeedInvestigationCasePayload(request.body);
          const saved = await updateDeedInvestigationCase(pool, caseId, investigation, { actorUser: request.user, reason: investigation.reason });
          if (!saved) response.status(404).json({ error: "Investigation case not found." });
          else response.json(saved);
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/deed-investigation-cases/:caseId/evidence", requireAdmin, async (request, response, next) => {
        try {
          const caseId = validateUuid(request.params.caseId, "Investigation case");
          const link = validateDeedInvestigationCaseLinkPayload(request.body);
          response.status(201).json(await linkDeedInvestigationCaseEntry(pool, caseId, link.entryId, link.note, { actorUser: request.user, reason: link.reason }));
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/deed-investigation-cases/:caseId/actions", requireAdmin, async (request, response, next) => {
        try {
          const caseId = validateUuid(request.params.caseId, "Investigation case");
          const action = validateDeedInvestigationCaseActionPayload(request.body);
          response.status(201).json(await createDeedInvestigationCaseAction(pool, caseId, action, { actorUser: request.user, reason: action.reason }));
        } catch (error) {
          next(error);
        }
      });
    
      app.put("/api/admin/deed-investigation-cases/:caseId/actions/:actionId", requireAdmin, async (request, response, next) => {
        try {
          const caseId = validateUuid(request.params.caseId, "Investigation case");
          const actionId = validateUuid(request.params.actionId, "Recommended action");
          const action = validateDeedInvestigationCaseActionPayload(request.body);
          const saved = await updateDeedInvestigationCaseAction(pool, caseId, actionId, action, { actorUser: request.user, reason: action.reason });
          if (!saved) response.status(404).json({ error: "Recommended action not found." });
          else response.json(saved);
        } catch (error) {
          next(error);
        }
      });
    
      app.get("/api/admin/north-hills-ocr-review", requireAdmin, async (request, response, next) => {
        try {
          response.json(await listNorthHillsOcrReview(pool, request.query));
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/north-hills-ocr-review/:entryId/evidence", requireAdmin, async (request, response, next) => {
        try {
          const entryId = validateUuid(request.params.entryId, "North Hills reading");
          const evidence = validateNorthHillsEvidencePayload(request.body);
          response.status(201).json(await saveNorthHillsOcrEvidenceLink(pool, entryId, evidence, { actorUser: request.user }));
        } catch (error) {
          next(error);
        }
      });
    
      app.put("/api/admin/north-hills-ocr-review/:entryId", requireCemeteryAdmin, async (request, response, next) => {
        try {
          const entryId = validateUuid(request.params.entryId, "North Hills reading");
          const entry = validateNorthHillsEntryPayload(request.body);
          const updated = await updateNorthHillsOcrEntry(pool, entryId, entry, {
            actorUser: request.user,
            reason: entry.reason,
            allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
          });
          if (!updated) {
            response.status(404).json({ error: "North Hills reading not found." });
            return;
          }
          if (updated.forbidden) {
            response.status(403).json({ error: "Forbidden" });
            return;
          }
          response.json(updated);
        } catch (error) {
          next(error);
        }
      });
    
      app.delete("/api/admin/north-hills-ocr-review/:entryId/evidence", requireCemeteryAdmin, async (request, response, next) => {
        try {
          const entryId = validateUuid(request.params.entryId, "North Hills reading");
          const evidence = validateNorthHillsEvidenceTargetPayload(request.body);
          const deleted = await deleteNorthHillsOcrEvidenceLink(pool, entryId, evidence, { actorUser: request.user });
          if (!deleted) response.status(404).json({ error: "North Hills evidence link not found." });
          else response.json(deleted);
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/north-hills-source-facts/:factId/review", requireAdmin, async (request, response, next) => {
        try {
          const factId = validateUuid(request.params.factId, "North Hills source fact");
          const review = validateNorthHillsSourceFactReviewPayload(request.body);
          const saved = await reviewNorthHillsSourceFact(pool, factId, review, { actorUser: request.user });
          if (!saved) response.status(404).json({ error: "North Hills source fact not found." });
          else response.json(saved);
        } catch (error) {
          next(error);
        }
      });
    
      app.post("/api/admin/north-hills-source-facts/:factId/promote", requireAdmin, async (request, response, next) => {
        try {
          const factId = validateUuid(request.params.factId, "North Hills source fact");
          const promotion = validateNorthHillsSourceFactPromotionPayload(request.body);
          const saved = await promoteNorthHillsSourceFact(pool, factId, promotion, {
            actorUser: request.user,
            reason: promotion.reason,
          });
          if (!saved) response.status(404).json({ error: "North Hills source fact not found." });
          else response.json(saved);
        } catch (error) {
          next(error);
        }
      });
    
}
