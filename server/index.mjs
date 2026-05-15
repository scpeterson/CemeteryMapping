import express from "express";
import pg from "pg";
import { loadApiConfig } from "./config.mjs";
import { getCemeteryData, getGraveSpace } from "./cemeteryRepository.mjs";
import { searchCemetery } from "./cemeterySearch.mjs";

const { Pool } = pg;
const config = loadApiConfig();
const pool = new Pool(config.database);
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

app.get("/api/cemetery-map", async (_request, response, next) => {
  try {
    response.json(await getCemeteryData(pool));
  } catch (error) {
    next(error);
  }
});

app.get("/api/grave-spaces/:id", async (request, response, next) => {
  try {
    const grave = await getGraveSpace(pool, request.params.id);
    if (!grave) {
      response.status(404).json({ error: "Grave space not found" });
      return;
    }

    response.json(grave);
  } catch (error) {
    next(error);
  }
});

app.get("/api/search", async (request, response, next) => {
  try {
    const query = typeof request.query.q === "string" ? request.query.q : "";
    const statuses = typeof request.query.status === "string" ? request.query.status.split(",").filter(Boolean) : [];
    response.json(await searchCemetery(pool, { query, statuses }));
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  void _next;
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
});

const server = app.listen(config.apiPort, "127.0.0.1", () => {
  console.log(`Cemetery API listening on http://127.0.0.1:${config.apiPort} (${config.appEnv.toUpperCase()})`);
});

const shutdown = async () => {
  server.close();
  await pool.end();
};

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});
