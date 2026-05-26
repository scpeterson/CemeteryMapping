import express from "express";
import pg from "pg";
import { pathToFileURL } from "node:url";
import { createUser, listAssignableRoles, listRoles, listUsers, updateUser } from "./adminRepository.mjs";
import { Auth0ProvisioningNotConfiguredError, createAuth0ManagementClient } from "./auth0Management.mjs";
import { loadApiConfig } from "./config.mjs";
import { canViewOwnership, requireRole } from "./auth.mjs";
import { listCemeteryAdminRecords, updateCemeteryText, updateLotText, updateSectionText } from "./cemeteryAdminRepository.mjs";
import { getCemeteryData, getGraveSpace, restoreGraveSpace, softDeleteGraveSpace } from "./cemeteryRepository.mjs";
import { searchCemetery } from "./cemeterySearch.mjs";
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

  return {
    externalSubject: requiredText(body?.externalSubject, "Auth0 user ID", 300),
    email: requiredText(body?.email, "Email", 320),
    displayName: optionalText(body?.displayName, "Display name", 250),
    role,
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
  };
}

function validateLotTextPayload(body) {
  return {
    name: optionalText(body?.name, "Lot name", 255),
  };
}

export function createApp(config, pool) {
  const app = express();
  const auth0ManagementClient = createAuth0ManagementClient({
    domain: config.auth.auth0.domain,
    ...config.auth.auth0.management,
  });

  app.use(express.json());

  app.get("/api/health", async (_request, response, next) => {
    try {
      const result = await pool.query("SELECT now() AS server_time");
      response.json({
        status: "ok",
        environment: config.appEnv.toUpperCase(),
        database: config.database.database,
        serverTime: result.rows[0].server_time,
      });
    } catch (error) {
      next(error);
    }
  });

  const requireReader = requireRole(config.auth, pool, "reader");
  const requireAdmin = requireRole(config.auth, pool, "admin");

  app.get("/api/me", requireReader, async (request, response) => {
    const role = request.user.role;
    response.json({
      subject: request.user.subject,
      email: request.user.email,
      displayName: request.user.displayName,
      role,
      permissions: {
        canViewOwnership: canViewOwnership(role),
        canManageUsers: role === "admin",
        canCreateCemeteryRecords: role === "admin",
        canUpdateCemeteryRecords: role === "admin" || role === "power-user",
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
      const grave = await getGraveSpace(pool, cemeteryId, id, { includeOwnership: canViewOwnership(request.user.role) });
      if (!grave) {
        response.status(404).json({ error: "Grave space not found" });
        return;
      }

      response.json(grave);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/search", requireReader, async (request, response, next) => {
    try {
      const query = validateSearchQuery(request.query.q);
      const statuses = validateStatuses(request.query.status);
      response.json(await searchCemetery(pool, { query, statuses, includeOwnership: canViewOwnership(request.user.role) }));
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
      response.status(201).json(await createUser(pool, user));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (request, response, next) => {
    try {
      const id = validateUuid(request.params.id, "User id");
      const roles = await listAssignableRoles(pool);
      const user = validateAdminUserPayload(request.body, roles);
      const updated = await updateUser(pool, id, user);
      if (!updated) {
        response.status(404).json({ error: "User not found" });
        return;
      }
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/cemetery-records", requireAdmin, async (_request, response, next) => {
    try {
      response.json(await listCemeteryAdminRecords(pool));
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/cemetery-records/cemeteries/:id", requireAdmin, async (request, response, next) => {
    try {
      const id = validateUuid(request.params.id, "Cemetery id");
      const updated = await updateCemeteryText(pool, id, validateCemeteryTextPayload(request.body));
      if (!updated) {
        response.status(404).json({ error: "Cemetery not found" });
        return;
      }
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/cemetery-records/sections/:id", requireAdmin, async (request, response, next) => {
    try {
      const id = validateUuid(request.params.id, "Section id");
      const updated = await updateSectionText(pool, id, validateSectionTextPayload(request.body));
      if (!updated) {
        response.status(404).json({ error: "Section not found" });
        return;
      }
      response.json(updated);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/cemetery-records/lots/:id", requireAdmin, async (request, response, next) => {
    try {
      const id = validateUuid(request.params.id, "Lot id");
      const updated = await updateLotText(pool, id, validateLotTextPayload(request.body));
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
