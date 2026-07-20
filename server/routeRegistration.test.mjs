import assert from "node:assert/strict";
import test from "node:test";
import { registerAdminGovernanceRoutes } from "./routes/adminGovernanceRoutes.mjs";
import { registerAdminOperationsRoutes } from "./routes/adminOperationsRoutes.mjs";
import { registerAdminReviewRoutes } from "./routes/adminReviewRoutes.mjs";
import { registerAdminUserRoutes } from "./routes/adminUserRoutes.mjs";
import { registerGraveRoutes } from "./routes/graveRoutes.mjs";
import { registerHeadstoneRoutes } from "./routes/headstoneRoutes.mjs";
import { registerMediaRoutes } from "./routes/mediaRoutes.mjs";
import { registerReportRoutes } from "./routes/reportRoutes.mjs";
import { registerSystemRoutes } from "./routes/systemRoutes.mjs";

const noop = () => undefined;
const context = new Proxy(
  { express: { raw: () => noop } },
  {
    get(target, property) {
      return property in target ? target[property] : noop;
    },
  },
);

function registeredRoutes(register) {
  const routes = [];
  const app = Object.fromEntries(
    ["get", "post", "put", "patch", "delete"].map((method) => [method, (path) => routes.push(`${method.toUpperCase()} ${path}`)]),
  );
  register(app, context);
  return routes;
}

const cases = [
  ["system", registerSystemRoutes, 3, ["GET /api/health", "GET /api/me"]],
  ["grave", registerGraveRoutes, 10, ["GET /api/cemetery-map", "PATCH /api/burials/:id", "POST /api/cemeteries/:cemeteryId/grave-spaces/:id/ownership-events"]],
  ["report", registerReportRoutes, 4, ["GET /api/search", "POST /api/reports/query"]],
  ["headstone", registerHeadstoneRoutes, 9, ["GET /api/headstone-lookups", "POST /api/headstones/:id/relationships", "POST /api/cemeteries/:cemeteryId/grave-spaces/:id/restore"]],
  ["media", registerMediaRoutes, 4, ["POST /api/headstones/:id/media-assets", "PATCH /api/media-assets/:id/order"]],
  ["admin user", registerAdminUserRoutes, 5, ["GET /api/admin/users", "POST /api/admin/auth0-users/resolve"]],
  ["admin governance", registerAdminGovernanceRoutes, 16, ["GET /api/admin/data-quality-dashboard", "POST /api/admin/bulk/headstones", "PUT /api/admin/cemetery-records/lots/:id"]],
  ["admin operations", registerAdminOperationsRoutes, 8, ["GET /api/admin/audit-events", "POST /api/admin/system-event-retention-purge"]],
  ["admin review", registerAdminReviewRoutes, 13, ["GET /api/admin/deed-registry-review", "PUT /api/admin/north-hills-ocr-review/:entryId"]],
];

for (const [name, register, count, expected] of cases) {
  test(`${name} registrar exposes its route contract`, () => {
    const routes = registeredRoutes(register);
    assert.equal(routes.length, count);
    assert.equal(new Set(routes).size, routes.length);
    for (const route of expected) assert.ok(routes.includes(route), `Missing ${route}`);
  });
}

test("focused registrars do not register overlapping method/path pairs", () => {
  const routes = cases.flatMap(([, register]) => registeredRoutes(register));
  assert.equal(new Set(routes).size, routes.length);
});
