export function registerAdminGovernanceRoutes(app, context) {
  const {
    assignedEditableCemeteryIds, bulkAddNorthHillsEntryNote, bulkAssignGravesitesToLot,
    bulkMarkNorthHillsReviewed, bulkUpdateHeadstones, canEditCemetery, canEditLot, canEditSection,
    createLookupRecord, createSourcePersonRecord, listCemeteryAdminRecords, listDataQualityDashboard,
    listLookupRecords, listSourcePersonRecords, pool, requireAdmin, requireCemeteryAdmin,
    requirePowerUser, softDeleteSourcePersonRecord, updateCemeteryText, updateLookupRecord,
    updateLotText, updateSectionText, updateSourcePersonRecord, validateBulkGravesiteLotPayload,
    validateBulkHeadstoneUpdatePayload, validateBulkNorthHillsNotePayload,
    validateBulkNorthHillsReviewedPayload, validateCemeteryTextPayload, validateLookupPayload,
    validateLookupTable, validateLotTextPayload, validateMutationReason, validateSectionTextPayload,
    validateSourcePersonRecordPayload, validateUuid,
  } = context;
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
