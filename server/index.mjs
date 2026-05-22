import express from "express";
import pg from "pg";
import { pathToFileURL } from "node:url";
import { loadApiConfig } from "./config.mjs";
import { requireRole } from "./auth.mjs";
import { getCemeteryData, getGraveSpace, restoreGraveSpace, softDeleteGraveSpace } from "./cemeteryRepository.mjs";
import { searchCemetery } from "./cemeterySearch.mjs";
import {
  BadRequestError,
  validateGraveSpaceId,
  validateMutationReason,
  validateSearchQuery,
  validateStatuses,
} from "./requestValidation.mjs";

const { Pool } = pg;

export function createApp(config, pool) {
  const app = express();

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

  app.get("/api/cemetery-map", requireReader, async (_request, response, next) => {
    try {
      response.json(await getCemeteryData(pool));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/grave-spaces/:id", requireReader, async (request, response, next) => {
    try {
      const id = validateGraveSpaceId(request.params.id);
      const grave = await getGraveSpace(pool, id);
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
      response.json(await searchCemetery(pool, { query, statuses }));
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/grave-spaces/:id", requireAdmin, async (request, response, next) => {
    try {
      const id = validateGraveSpaceId(request.params.id);
      const reason = validateMutationReason(request.body?.reason);
      const result = await softDeleteGraveSpace(pool, id, { actorUser: request.user, reason });
      if (!result) {
        response.status(404).json({ error: "Grave space not found" });
        return;
      }

      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/grave-spaces/:id/restore", requireAdmin, async (request, response, next) => {
    try {
      const id = validateGraveSpaceId(request.params.id);
      const reason = validateMutationReason(request.body?.reason);
      const result = await restoreGraveSpace(pool, id, { actorUser: request.user, reason });
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
