import express from "express";
import pg from "pg";
import { pathToFileURL } from "node:url";
import { createUser, listAssignableRoles, listRoles, listUsers, updateUser } from "./adminRepository.mjs";
import { getAuditRetentionPolicy, listAuditEvents, updateAuditRetentionPolicy } from "./auditRepository.mjs";
import { Auth0ProvisioningNotConfiguredError, createAuth0ManagementClient } from "./auth0Management.mjs";
import {
  bulkAddNorthHillsEntryNote,
  bulkAssignGravesitesToLot,
  bulkMarkNorthHillsReviewed,
  bulkUpdateHeadstones,
} from "./bulkEditRepository.mjs";
import { loadApiConfig } from "./config.mjs";
import { assignedEditableCemeteryIds, canEditCemetery, canManageUsers, canViewOwnershipForCemetery, requireRole } from "./auth.mjs";
import { listCemeteryAdminRecords, updateCemeteryText, updateLotText, updateSectionText } from "./cemeteryAdminRepository.mjs";
import { listDataQualityDashboard } from "./dataQualityRepository.mjs";
import {
  createGraveFeature,
  createHeadstoneForGrave,
  createHeadstoneRelationship,
  createMaintenanceRecord,
  createOwnershipEvent,
  getCemeteryData,
  getGraveSpace,
  getHeadstone,
  listHeadstoneLookupOptions,
  restoreGraveSpace,
  softDeleteGraveFeature,
  softDeleteGraveSpace,
  softDeleteHeadstoneRelationship,
  updateBurial,
  updateGraveFeature,
  updateGraveSpace,
  updateHeadstone,
  updateHeadstoneRelationship,
  updateMaintenanceRecord,
} from "./cemeteryRepository.mjs";
import { listDeedRegistryReview } from "./deedRegistryReviewRepository.mjs";
import {
  createDeedInvestigationCase,
  createDeedInvestigationCaseAction,
  linkDeedInvestigationCaseEntry,
  listDeedInvestigationCases,
  updateDeedInvestigationCaseAction,
  updateDeedInvestigationCase,
} from "./deedInvestigationCaseRepository.mjs";
import { createLookupRecord, listLookupRecords, updateLookupRecord } from "./lookupAdminRepository.mjs";
import { createGraveSpacePhoto, createHeadstonePhoto, mediaUploadRoot, moveMediaAssetLink, softDeleteMediaAsset } from "./mediaRepository.mjs";
import {
  deleteNorthHillsOcrEvidenceLink,
  listNorthHillsOcrReview,
  promoteNorthHillsSourceFact,
  reviewNorthHillsSourceFact,
  saveNorthHillsOcrEvidenceLink,
  updateNorthHillsOcrEntry,
} from "./northHillsOcrReviewRepository.mjs";
import {
  createSourcePersonRecord,
  listSourcePersonRecords,
  softDeleteSourcePersonRecord,
  updateSourcePersonRecord,
} from "./sourcePersonRecordRepository.mjs";
import { listReportsForUser, matchReportQuery, runReport } from "./reportsRepository.mjs";
import { searchCemetery } from "./cemeterySearch.mjs";
import {
  getSystemEventRetentionPolicy,
  listSystemEvents,
  safelyRecordSystemEvent,
  updateSystemEventRetentionPolicy,
} from "./systemEventRepository.mjs";
import { runAuditRetentionPurgeJob, runSystemEventRetentionPurgeJob } from "./retentionJobs.mjs";
import { appVersionMetadata } from "./version.mjs";
import { BadRequestError } from "./requestValidation.mjs";
import { registerAdminRoutes } from "./routes/adminRoutes.mjs";
import { registerCemeteryRoutes } from "./routes/cemeteryRoutes.mjs";
import { registerMediaRoutes } from "./routes/mediaRoutes.mjs";
import { canEditLot, canEditSection, validateHeadstoneBusinessRules } from "./routes/routeBusinessRules.mjs";

const { Pool } = pg;

export function createApp(config, pool) {
  const app = express();
  const versionMetadata = appVersionMetadata(config);
  const auth0ManagementClient = createAuth0ManagementClient({
    domain: config.auth.auth0.domain,
    ...config.auth.auth0.management,
  });

  app.use(express.json());
  app.use("/media", express.static(mediaUploadRoot()));

  const requireReader = requireRole(config.auth, pool, "reader");
  const requirePowerUser = requireRole(config.auth, pool, "power-user");
  const requireCemeteryAdmin = requireRole(config.auth, pool, "cemetery-admin");
  const requireAdmin = requireRole(config.auth, pool, "admin");
  registerCemeteryRoutes(app, {
    assignedEditableCemeteryIds, canEditCemetery, canManageUsers, canViewOwnershipForCemetery, config,
    createGraveFeature, createHeadstoneForGrave, createHeadstoneRelationship, createMaintenanceRecord,
    createOwnershipEvent, getCemeteryData, getGraveSpace, getHeadstone, listHeadstoneLookupOptions,
    listReportsForUser, matchReportQuery, pool, requireAdmin, requireCemeteryAdmin, requirePowerUser,
    requireReader, restoreGraveSpace, runReport, safelyRecordSystemEvent, searchCemetery,
    softDeleteGraveFeature, softDeleteGraveSpace, softDeleteHeadstoneRelationship, updateBurial,
    updateGraveFeature, updateGraveSpace, updateHeadstone, updateHeadstoneRelationship,
    updateMaintenanceRecord, validateHeadstoneBusinessRules, versionMetadata,
  });

  registerMediaRoutes(app, {
    assignedEditableCemeteryIds, canEditCemetery, createGraveSpacePhoto, createHeadstonePhoto, express,
    moveMediaAssetLink, pool, requireCemeteryAdmin, requirePowerUser, softDeleteMediaAsset,
  });

  registerAdminRoutes(app, {
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
    updateSystemEventRetentionPolicy, updateUser, versionMetadata,
  });

  app.use(async (error, request, response, _next) => {
    void _next;
    if (error instanceof BadRequestError) {
      response.status(400).json({ error: error.message });
      return;
    }

    console.error(error);
    if ((request.originalUrl ?? request.url) !== "/api/health") {
      await safelyRecordSystemEvent(pool, {
        eventType: "error",
        severity: "error",
        source: "api",
        status: "failed",
        message: error instanceof Error ? error.message : "Unhandled API error.",
        detail: error instanceof Error ? error.stack : String(error),
        requestMethod: request.method,
        requestPath: request.originalUrl ?? request.url,
        responseStatus: 500,
        actorEmail: request.user?.email,
        actorRole: request.user?.role,
        environment: config.appEnv,
        appVersion: versionMetadata.version,
        metadata: {
          gitSha: versionMetadata.gitSha,
        },
      });
    }
    response.status(500).json({ error: "Internal server error" });
  });

  return app;
}

export function startServer(config = loadApiConfig(), pool = new Pool(config.database)) {
  const app = createApp(config, pool);
  const server = app.listen(config.apiPort, "127.0.0.1", () => {
    console.log(`Cemetery API listening on http://127.0.0.1:${config.apiPort} (${config.appEnv.toUpperCase()})`);
  });
  const keepAlive = setInterval(() => undefined, 2 ** 31 - 1);

  const shutdown = async () => {
    clearInterval(keepAlive);
    server.close();
    await pool.end();
  };

  process.on("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    void shutdown().then(() => process.exit(0));
  });

  return { app, server, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
