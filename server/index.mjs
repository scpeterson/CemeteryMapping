import express from "express";
import pg from "pg";
import { pathToFileURL } from "node:url";
import { createUser, listAssignableRoles, listRoles, listUsers, updateUser } from "./adminRepository.mjs";
import { listAuditEvents } from "./auditRepository.mjs";
import { Auth0ProvisioningNotConfiguredError, createAuth0ManagementClient } from "./auth0Management.mjs";
import { loadApiConfig } from "./config.mjs";
import { assignedEditableCemeteryIds, canEditCemetery, canManageUsers, canViewOwnershipForCemetery, requireRole } from "./auth.mjs";
import { listCemeteryAdminRecords, updateCemeteryText, updateLotText, updateSectionText } from "./cemeteryAdminRepository.mjs";
import {
  createOwnershipEvent,
  getCemeteryData,
  getGraveSpace,
  getHeadstone,
  listHeadstoneLookupOptions,
  restoreGraveSpace,
  softDeleteGraveSpace,
  updateBurial,
  updateGraveSpace,
  updateHeadstone,
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
import { createGraveSpacePhoto, mediaUploadRoot } from "./mediaRepository.mjs";
import { listNorthHillsOcrReview, saveNorthHillsOcrEvidenceLink } from "./northHillsOcrReviewRepository.mjs";
import { searchCemetery } from "./cemeterySearch.mjs";
import { appVersionMetadata } from "./version.mjs";
import {
  BadRequestError,
  validateCemeteryId,
  validateGraveSpaceId,
  validateMutationReason,
  validateSearchQuery,
  validateStatuses,
} from "./requestValidation.mjs";

const { Pool } = pg;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function requiredText(value, label, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) throw new BadRequestError(`${label} is required.`);
  if (text.length > maxLength) throw new BadRequestError(`${label} is too long.`);
  return text;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (text.length > maxLength) throw new BadRequestError(`${label} is too long.`);
  return text;
}

function validateUuid(value, label) {
  const text = String(value ?? "").trim();
  if (!uuidPattern.test(text)) throw new BadRequestError(`${label} must be a UUID.`);
  return text;
}

function validateAdminUserPayload(body, roles) {
  const role = requiredText(body?.role, "Role", 50);
  if (!roles.includes(role)) throw new BadRequestError(`Unsupported role: ${role}.`);
  const assignedCemeteryIds = Array.isArray(body?.assignedCemeteryIds)
    ? [...new Set(body.assignedCemeteryIds.map((id, index) => validateUuid(id, `Assigned cemetery ${index + 1}`)))]
    : [];
  if ((role === "power-user" || role === "cemetery-admin") && assignedCemeteryIds.length === 0) {
    throw new BadRequestError("Assigned cemetery is required for this role.");
  }

  return {
    externalSubject: requiredText(body?.externalSubject, "Auth0 user ID", 300),
    email: requiredText(body?.email, "Email", 320),
    displayName: optionalText(body?.displayName, "Display name", 250),
    role,
    assignedCemeteryIds,
    isActive: body?.isActive !== false,
  };
}

function validateAuth0UserResolutionPayload(body) {
  return {
    email: requiredText(body?.email, "Email", 320),
    displayName: optionalText(body?.displayName, "Display name", 250),
  };
}

function validateCemeteryTextPayload(body) {
  return {
    name: requiredText(body?.name, "Cemetery name", 255),
    fullAddress: optionalText(body?.fullAddress, "Full address", 250),
    municipality: optionalText(body?.municipality, "Municipality", 150),
    agency: optionalText(body?.agency, "Agency", 50),
    agencyUrl: optionalText(body?.agencyUrl, "Agency URL", 300),
    operationalHours: optionalText(body?.operationalHours, "Operational hours", 150),
    contactName: optionalText(body?.contactName, "Contact name", 150),
    contactPhone: optionalText(body?.contactPhone, "Contact phone", 15),
    contactEmail: optionalText(body?.contactEmail, "Contact email", 100),
    imageUrl: optionalText(body?.imageUrl, "Image URL", 300),
    notes: optionalText(body?.notes, "Cemetery notes", 4000),
  };
}

function validateSectionTextPayload(body) {
  const alternateNames = Array.isArray(body?.alternateNames)
    ? body.alternateNames.map((value, index) => optionalText(value, `Alternate name ${index + 1}`, 255)).filter(Boolean)
    : [];

  if (alternateNames.length > 25) throw new BadRequestError("Sections can have at most 25 alternate names.");

  return {
    name: optionalText(body?.name, "Section name", 255),
    alternateNames,
    notes: optionalText(body?.notes, "Section notes", 4000),
  };
}

function validateLotTextPayload(body) {
  return {
    name: optionalText(body?.name, "Lot name", 255),
  };
}

function validateLookupCode(value) {
  const code = requiredText(value, "Lookup code", 50);
  if (!/^[a-z0-9_]+$/u.test(code)) throw new BadRequestError("Lookup code can contain only lowercase letters, numbers, and underscores.");
  return code;
}

function validateLookupTable(value) {
  const table = requiredText(value, "Lookup table", 100);
  if (!/^[a-z_]+$/u.test(table)) throw new BadRequestError("Lookup table is invalid.");
  return table;
}

function validateLookupPayload(body) {
  const sortOrder = Number.parseInt(String(body?.sortOrder ?? ""), 10);
  if (!Number.isFinite(sortOrder)) throw new BadRequestError("Sort order is required.");

  return {
    code: validateLookupCode(body?.code),
    label: requiredText(body?.label, "Label", 100),
    description: requiredText(body?.description, "Description", 500),
    sortOrder,
    isActive: body?.isActive !== false,
    sourceNotes: optionalText(body?.sourceNotes, "Source notes", 500),
    sourceUrl: optionalText(body?.sourceUrl, "Source URL", 500),
  };
}

function validateHeadstonePayload(body) {
  const lastInspectedAt = optionalText(body?.lastInspectedAt, "Last inspected date", 10);
  if (lastInspectedAt && !/^\d{4}-\d{2}-\d{2}$/u.test(lastInspectedAt)) throw new BadRequestError("Last inspected date must use YYYY-MM-DD format.");

  return {
    markerTypeId: validateUuid(body?.markerTypeId, "Marker type"),
    materialId: validateUuid(body?.materialId, "Marker material"),
    conditionId: validateUuid(body?.conditionId, "Condition"),
    conditionNotes: optionalText(body?.conditionNotes, "Condition notes", 4000),
    inscription: optionalText(body?.inscription, "Inscription", 20_000),
    designNotes: optionalText(body?.designNotes, "Design notes", 20_000),
    backDescription: optionalText(body?.backDescription, "Back description", 20_000),
    photoUrl: optionalText(body?.photoUrl, "Photo URL", 300),
    lastInspectedAt,
    reason: validateMutationReason(body?.reason),
  };
}

function validateGraveSpacePayload(body) {
  const status = optionalText(body?.status, "Gravesite status", 30) || "unknown";
  if (!["available", "reserved", "occupied", "sold", "needs_review", "unknown"].includes(status)) {
    throw new BadRequestError("Gravesite status is invalid.");
  }
  const costText = optionalText(body?.cost, "Cost", 30);
  const cost = costText ? Number(costText) : null;
  if (costText && (!Number.isFinite(cost) || cost < 0)) throw new BadRequestError("Cost must be a non-negative number.");

  return {
    name: optionalText(body?.name, "Name", 255) ?? "",
    status,
    cost,
    reason: validateMutationReason(body?.reason),
  };
}

function optionalDate(value, label) {
  const date = optionalText(value, label, 10);
  if (date && !/^\d{4}-\d{2}-\d{2}$/u.test(date)) throw new BadRequestError(`${label} must use YYYY-MM-DD format.`);
  return date;
}

function validateBurialPayload(body) {
  const intermentType = optionalText(body?.intermentType, "Interment type", 20) || "casket";
  if (!["casket", "urn"].includes(intermentType)) throw new BadRequestError("Interment type must be casket or urn.");

  return {
    firstName: optionalText(body?.firstName, "First name", 100) ?? "",
    lastName: optionalText(body?.lastName, "Last name", 100) ?? "",
    birthDate: optionalDate(body?.birthDate, "Birth date") ?? "",
    deathDate: optionalDate(body?.deathDate, "Death date") ?? "",
    burialDate: optionalDate(body?.burialDate, "Burial date") ?? "",
    intermentType,
    funeralHome: optionalText(body?.funeralHome, "Funeral home", 255) ?? "",
    notes: optionalText(body?.notes, "Burial notes", 4000) ?? "",
    reason: validateMutationReason(body?.reason),
  };
}

function validateOwnershipEventPayload(body) {
  const eventType = requiredText(body?.eventType, "Ownership event type", 50);
  if (!["deed", "sale", "gift", "church_council_action", "correction", "release"].includes(eventType)) {
    throw new BadRequestError("Ownership event type is invalid.");
  }

  const targetScope = requiredText(body?.targetScope, "Ownership target", 50);
  if (!["selected_gravesite", "selected_lot", "listed_gravesites"].includes(targetScope)) {
    throw new BadRequestError("Ownership target is invalid.");
  }

  const targetGravesiteIds = Array.isArray(body?.targetGravesiteIds)
    ? [...new Set(body.targetGravesiteIds.map((value) => optionalText(value, "Target gravesite ID", 80)).filter(Boolean))]
    : [];

  return {
    ownerDisplayName: requiredText(body?.ownerDisplayName, "Owner name", 250),
    eventType,
    targetScope,
    targetGravesiteIds,
    effectiveDate: optionalDate(body?.effectiveDate, "Effective date"),
    documentReference: optionalText(body?.documentReference, "Document reference", 250),
    notes: optionalText(body?.notes, "Ownership notes", 4000),
    reason: validateMutationReason(body?.reason),
  };
}

function validateNorthHillsEvidencePayload(body) {
  const targetType = requiredText(body?.targetType, "Evidence target type", 50);
  if (!["headstone", "gravesite"].includes(targetType)) throw new BadRequestError("Evidence target type must be headstone or gravesite.");
  const status = requiredText(body?.status, "Evidence status", 50);
  if (!["linked", "rejected", "needs_field_check"].includes(status)) {
    throw new BadRequestError("Evidence status must be linked, rejected, or needs_field_check.");
  }
  const confidence = optionalText(body?.confidence, "Evidence confidence", 50) || "review";
  if (!["high", "medium", "low", "review"].includes(confidence)) {
    throw new BadRequestError("Evidence confidence must be high, medium, low, or review.");
  }

  return {
    targetType,
    targetId: validateUuid(body?.targetId, "Evidence target"),
    status,
    confidence,
    notes: optionalText(body?.notes, "Evidence notes", 4000),
  };
}

function validateDeedInvestigationCasePayload(body) {
  return {
    cemeteryId: body?.cemeteryId ? validateUuid(body.cemeteryId, "Cemetery") : "",
    caseNumber: requiredText(body?.caseNumber, "Case number", 50),
    status: requiredText(body?.status, "Case status", 50),
    subjectName: requiredText(body?.subjectName, "Subject name", 250),
    requesterName: optionalText(body?.requesterName, "Requester name", 250),
    requesterContact: optionalText(body?.requesterContact, "Requester contact", 500),
    plotReference: optionalText(body?.plotReference, "Plot reference", 250),
    requestSummary: optionalText(body?.requestSummary, "Request summary", 4000),
    familySummary: optionalText(body?.familySummary, "Family summary", 4000),
    findings: optionalText(body?.findings, "Findings", 4000),
    councilDecision: optionalText(body?.councilDecision, "Council decision", 4000),
    affidavitStatus: requiredText(body?.affidavitStatus, "Affidavit status", 50),
    outcome: optionalText(body?.outcome, "Outcome", 4000),
    openedAt: optionalDate(body?.openedAt, "Opened date"),
    closedAt: optionalDate(body?.closedAt, "Closed date"),
    reason: validateMutationReason(body?.reason),
  };
}

function validateDeedInvestigationCaseLinkPayload(body) {
  return {
    entryId: validateUuid(body?.entryId, "Deed evidence row"),
    note: optionalText(body?.note, "Evidence note", 1000),
    reason: validateMutationReason(body?.reason),
  };
}

function validateDeedInvestigationCaseActionPayload(body) {
  const sortOrder = Number.parseInt(String(body?.sortOrder ?? "100"), 10);
  return {
    subjectName: requiredText(body?.subjectName, "Action subject", 250),
    actionType: requiredText(body?.actionType, "Action type", 50),
    plotReference: optionalText(body?.plotReference, "Action plot reference", 250),
    councilStatus: requiredText(body?.councilStatus, "Council status", 50),
    councilDecisionDate: optionalDate(body?.councilDecisionDate, "Council decision date"),
    councilDocumentReference: optionalText(body?.councilDocumentReference, "Council document reference", 250),
    affidavitStatus: requiredText(body?.affidavitStatus, "Affidavit status", 50),
    deedStatus: requiredText(body?.deedStatus, "Deed status", 50),
    outcome: optionalText(body?.outcome, "Action outcome", 4000),
    notes: optionalText(body?.notes, "Action notes", 4000),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 100,
    reason: validateMutationReason(body?.reason),
  };
}

function validateMediaUploadMetadata(query) {
  const source = optionalText(query?.source, "Photo source", 50) || "field_upload";
  if (!["iphone", "admin_upload", "field_upload", "import", "other"].includes(source)) throw new BadRequestError("Photo source is invalid.");
  return {
    originalFilename: optionalText(query?.filename, "Filename", 255),
    headstoneId: query?.headstoneId ? validateUuid(query.headstoneId, "Headstone id") : "",
    notes: optionalText(query?.notes, "Photo notes", 4000),
    latitude: optionalText(query?.latitude, "Latitude", 30),
    longitude: optionalText(query?.longitude, "Longitude", 30),
    gpsAccuracy: optionalText(query?.gpsAccuracy, "GPS accuracy", 30),
    capturedAt: optionalText(query?.capturedAt, "Captured at", 40),
    deviceMake: optionalText(query?.deviceMake, "Device make", 100),
    deviceModel: optionalText(query?.deviceModel, "Device model", 100),
    source,
  };
}

async function markerTypeCodeForId(pool, markerTypeId) {
  const result = await pool.query("SELECT code FROM marker_types WHERE id = $1", [markerTypeId]);
  return result.rows[0]?.code;
}

async function sectionNameForHeadstone(pool, headstoneId) {
  const result = await pool.query(
    `
      SELECT COALESCE(sections.name, gravesites.section_id) AS section_name
      FROM headstones
      LEFT JOIN gravesites
        ON gravesites.id = headstones.gravesite_uuid
      LEFT JOIN sections
        ON sections.section_id = gravesites.section_uuid
      WHERE headstones.id = $1
        AND headstones.deleted_at IS NULL
      LIMIT 1
    `,
    [headstoneId],
  );
  return result.rows[0]?.section_name;
}

async function validateHeadstoneBusinessRules(pool, headstoneId, headstone) {
  const [markerTypeCode, sectionName] = await Promise.all([markerTypeCodeForId(pool, headstone.markerTypeId), sectionNameForHeadstone(pool, headstoneId)]);
  if (!markerTypeCode) throw new BadRequestError("Marker type is invalid.");
  if (String(sectionName ?? "").toUpperCase() === "G" && markerTypeCode !== "flat_marker") {
    throw new BadRequestError("Section G can contain only flat markers.");
  }
}

async function cemeteryIdForSection(pool, sectionId) {
  const result = await pool.query("SELECT cemetery_id::text FROM sections WHERE section_id = $1 AND deleted_at IS NULL", [sectionId]);
  return result.rows[0]?.cemetery_id;
}

async function cemeteryIdForLot(pool, lotId) {
  const result = await pool.query("SELECT cemetery_id::text FROM lots WHERE id = $1 AND deleted_at IS NULL", [lotId]);
  return result.rows[0]?.cemetery_id;
}

async function canEditSection(pool, user, sectionId) {
  const cemeteryId = await cemeteryIdForSection(pool, sectionId);
  return cemeteryId ? canEditCemetery(user, cemeteryId) : false;
}

async function canEditLot(pool, user, lotId) {
  const cemeteryId = await cemeteryIdForLot(pool, lotId);
  return cemeteryId ? canEditCemetery(user, cemeteryId) : false;
}

export function createApp(config, pool) {
  const app = express();
  const versionMetadata = appVersionMetadata(config);
  const auth0ManagementClient = createAuth0ManagementClient({
    domain: config.auth.auth0.domain,
    ...config.auth.auth0.management,
  });

  app.use(express.json());
  app.use("/media", express.static(mediaUploadRoot()));

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
      next(error);
    }
  });

  const requireReader = requireRole(config.auth, pool, "reader");
  const requirePowerUser = requireRole(config.auth, pool, "power-user");
  const requireAdmin = requireRole(config.auth, pool, "admin");

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
      },
    });
  });

  app.get("/api/cemetery-map", requireReader, async (_request, response, next) => {
    try {
      response.json(await getCemeteryData(pool));
    } catch (error) {
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

  app.get("/api/headstone-lookups", requireReader, async (_request, response, next) => {
    try {
      response.json(await listHeadstoneLookupOptions(pool));
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

  app.get("/api/admin/audit-events", requireAdmin, async (request, response, next) => {
    try {
      response.json(await listAuditEvents(pool, request.query));
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

  app.use((error, _request, response, _next) => {
    void _next;
    if (error instanceof BadRequestError) {
      response.status(400).json({ error: error.message });
      return;
    }

    console.error(error);
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
