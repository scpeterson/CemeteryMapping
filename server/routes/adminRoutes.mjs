export function registerAdminRoutes(app, context) {
  const {
    Auth0ProvisioningNotConfiguredError, assignedEditableCemeteryIds, auth0ManagementClient,
    bulkAddNorthHillsEntryNote, bulkAssignGravesitesToLot, bulkMarkNorthHillsReviewed,
    bulkUpdateHeadstones, canEditCemetery, canEditLot, canEditSection, config,
    createDeedInvestigationCase, createDeedInvestigationCaseAction, createLookupRecord,
    createSourcePersonRecord, createUser, deleteNorthHillsOcrEvidenceLink, getAuditRetentionPolicy,
    getSystemEventRetentionPolicy, linkDeedInvestigationCaseEntry, listAssignableRoles, listAuditEvents,
    listCemeteryAdminRecords, listDataQualityDashboard, listDeedInvestigationCases,
    listDeedRegistryReview, listLookupRecords, listNorthHillsOcrReview, listRoles,
    listSourcePersonRecords, listSystemEvents, listUsers, pool, promoteNorthHillsSourceFact,
    requireAdmin, requireCemeteryAdmin, requirePowerUser, reviewNorthHillsSourceFact,
    runAuditRetentionPurgeJob, runSystemEventRetentionPurgeJob, saveNorthHillsOcrEvidenceLink,
    softDeleteSourcePersonRecord, updateAuditRetentionPolicy, updateCemeteryText,
    updateDeedInvestigationCase, updateDeedInvestigationCaseAction, updateLookupRecord, updateLotText,
    updateNorthHillsOcrEntry, updateSectionText, updateSourcePersonRecord,
    updateSystemEventRetentionPolicy, updateUser, validateAdminUserPayload,
    validateAuth0UserResolutionPayload, validateBulkGravesiteLotPayload,
    validateBulkHeadstoneUpdatePayload, validateBulkNorthHillsNotePayload,
    validateBulkNorthHillsReviewedPayload, validateCemeteryTextPayload,
    validateDeedInvestigationCaseActionPayload, validateDeedInvestigationCaseLinkPayload,
    validateDeedInvestigationCasePayload, validateLookupPayload, validateLookupTable,
    validateLotTextPayload, validateMutationReason, validateNorthHillsEntryPayload,
    validateNorthHillsEvidencePayload, validateNorthHillsEvidenceTargetPayload,
    validateNorthHillsSourceFactPromotionPayload, validateNorthHillsSourceFactReviewPayload,
    validateSectionTextPayload, validateSourcePersonRecordPayload, validateUuid, versionMetadata,
  } = context;
    app.get("/api/admin/roles", requireAdmin, async (_request, response, next) => {
      try {
        response.json(await listRoles(pool));
      } catch (error) {
        next(error);
      }
    });
  
    app.get("/api/admin/users", requireAdmin, async (_request, response, next) => {
      try {
        response.json(await listUsers(pool));
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/admin/auth0-users/resolve", requireAdmin, async (request, response, next) => {
      try {
        const user = validateAuth0UserResolutionPayload(request.body);
        response.json(await auth0ManagementClient.resolveOrCreateUser(user));
      } catch (error) {
        if (error instanceof Auth0ProvisioningNotConfiguredError) {
          response.status(400).json({ error: error.message });
          return;
        }
        next(error);
      }
    });
  
    app.post("/api/admin/users", requireAdmin, async (request, response, next) => {
      try {
        const roles = await listAssignableRoles(pool);
        const user = validateAdminUserPayload(request.body, roles);
        response.status(201).json(await createUser(pool, { ...user, actorUser: request.user }));
      } catch (error) {
        next(error);
      }
    });
  
    app.put("/api/admin/users/:id", requireAdmin, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "User id");
        const roles = await listAssignableRoles(pool);
        const user = validateAdminUserPayload(request.body, roles);
        const updated = await updateUser(pool, id, { ...user, actorUser: request.user });
        if (!updated) {
          response.status(404).json({ error: "User not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.get("/api/admin/cemetery-records", requirePowerUser, async (_request, response, next) => {
      try {
        response.json(await listCemeteryAdminRecords(pool));
      } catch (error) {
        next(error);
      }
    });
  
    app.get("/api/admin/data-quality-dashboard", requirePowerUser, async (request, response, next) => {
      try {
        response.json(
          await listDataQualityDashboard(pool, {
            cemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  
    app.get("/api/admin/source-person-records", requireCemeteryAdmin, async (request, response, next) => {
      try {
        response.json(
          await listSourcePersonRecords(pool, request.query, {
            allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/admin/source-person-records", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const record = validateSourcePersonRecordPayload(request.body);
        if (!canEditCemetery(request.user, record.cemeteryId)) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        response.status(201).json(
          await createSourcePersonRecord(pool, record, {
            actorUser: request.user,
            reason: record.reason,
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  
    app.put("/api/admin/source-person-records/:recordId", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const recordId = validateUuid(request.params.recordId, "Source person record");
        const record = validateSourcePersonRecordPayload(request.body);
        if (!canEditCemetery(request.user, record.cemeteryId)) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        const updated = await updateSourcePersonRecord(pool, recordId, record, {
          actorUser: request.user,
          reason: record.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!updated) response.status(404).json({ error: "Source person record not found." });
        else response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.delete("/api/admin/source-person-records/:recordId", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const recordId = validateUuid(request.params.recordId, "Source person record");
        const deleted = await softDeleteSourcePersonRecord(pool, recordId, {
          actorUser: request.user,
          reason: validateMutationReason(request.body?.reason),
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (!deleted) response.status(404).json({ error: "Source person record not found." });
        else response.json(deleted);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/admin/bulk/headstones", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const update = validateBulkHeadstoneUpdatePayload(request.body);
        response.json(
          await bulkUpdateHeadstones(pool, update, {
            actorUser: request.user,
            reason: update.reason,
            allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/admin/bulk/gravesites/lot", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const update = validateBulkGravesiteLotPayload(request.body);
        const result = await bulkAssignGravesitesToLot(pool, update, {
          actorUser: request.user,
          reason: update.reason,
          allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
        });
        if (result.forbidden) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        if (result.invalid === "lot_not_found") {
          response.status(404).json({ error: "Lot not found." });
          return;
        }
        response.json(result);
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/admin/bulk/north-hills/reviewed", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const update = validateBulkNorthHillsReviewedPayload(request.body);
        response.json(
          await bulkMarkNorthHillsReviewed(pool, update, {
            actorUser: request.user,
            reason: update.reason,
            allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/admin/bulk/north-hills/entry-note", requireCemeteryAdmin, async (request, response, next) => {
      try {
        const update = validateBulkNorthHillsNotePayload(request.body);
        response.json(
          await bulkAddNorthHillsEntryNote(pool, update, {
            actorUser: request.user,
            reason: update.reason,
            allowedCemeteryIds: request.user.role === "admin" ? undefined : assignedEditableCemeteryIds(request.user),
          }),
        );
      } catch (error) {
        next(error);
      }
    });
  
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
  
    app.get("/api/admin/lookups", requireAdmin, async (_request, response, next) => {
      try {
        response.json(await listLookupRecords(pool));
      } catch (error) {
        next(error);
      }
    });
  
    app.post("/api/admin/lookups/:table", requireAdmin, async (request, response, next) => {
      try {
        const table = validateLookupTable(request.params.table);
        const record = validateLookupPayload(request.body);
        response.status(201).json(await createLookupRecord(pool, table, record, { actorUser: request.user }));
      } catch (error) {
        if (error.message?.startsWith("Unsupported lookup table:")) {
          response.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    });
  
    app.put("/api/admin/lookups/:table/:id", requireAdmin, async (request, response, next) => {
      try {
        const table = validateLookupTable(request.params.table);
        const id = validateUuid(request.params.id, "Lookup id");
        const record = validateLookupPayload(request.body);
        const updated = await updateLookupRecord(pool, table, id, record, { actorUser: request.user });
        if (!updated) {
          response.status(404).json({ error: "Lookup row not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        if (error.message?.startsWith("Unsupported lookup table:")) {
          response.status(404).json({ error: error.message });
          return;
        }
        next(error);
      }
    });
  
    app.put("/api/admin/cemetery-records/cemeteries/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Cemetery id");
        if (!canEditCemetery(request.user, id)) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        const updated = await updateCemeteryText(pool, id, validateCemeteryTextPayload(request.body), { actorUser: request.user });
        if (!updated) {
          response.status(404).json({ error: "Cemetery not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.put("/api/admin/cemetery-records/sections/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Section id");
        if (!(await canEditSection(pool, request.user, id))) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        const updated = await updateSectionText(pool, id, validateSectionTextPayload(request.body), { actorUser: request.user });
        if (!updated) {
          response.status(404).json({ error: "Section not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
    app.put("/api/admin/cemetery-records/lots/:id", requirePowerUser, async (request, response, next) => {
      try {
        const id = validateUuid(request.params.id, "Lot id");
        if (!(await canEditLot(pool, request.user, id))) {
          response.status(403).json({ error: "Forbidden" });
          return;
        }
        const updated = await updateLotText(pool, id, validateLotTextPayload(request.body), { actorUser: request.user });
        if (!updated) {
          response.status(404).json({ error: "Lot not found" });
          return;
        }
        response.json(updated);
      } catch (error) {
        next(error);
      }
    });
  
}
