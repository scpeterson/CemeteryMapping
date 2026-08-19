import { canRun, definitionById, reportDefinitions, toDefinition } from "./reports/definitions.mjs";
import { selectedReportCemeteryIds } from "./reports/shared.mjs";
import { runBurialDateExtremes, runMarkerBurialPages, runVeteranServiceSummary } from "./reports/burialReports.mjs";
import { runAvailableInventory, runMarkerTypeInventory, runSpatialInventoryCounts } from "./reports/inventoryReports.mjs";
import { runDeedClaimTraceGuide, runMaintenanceNeeds } from "./reports/maintenanceReports.mjs";
import { runOwnerHoldings, runUnownedGravesites } from "./reports/ownershipReports.mjs";

export { matchReportQuery } from "./reports/queryMatcher.mjs";

const reportRunners = new Map([
  ["burial-date-extremes", (client, definition, _parameters, cemeteryIds) => runBurialDateExtremes(client, definition, cemeteryIds)],
  ["veteran-service-summary", (client, definition, _parameters, cemeteryIds) => runVeteranServiceSummary(client, definition, cemeteryIds)],
  ["spatial-inventory-counts", runSpatialInventoryCounts],
  ["marker-type-inventory", runMarkerTypeInventory],
  ["marker-burial-pages", runMarkerBurialPages],
  ["owner-holdings", runOwnerHoldings],
  ["unowned-gravesites", runUnownedGravesites],
  ["available-inventory", (client, definition, _parameters, cemeteryIds) => runAvailableInventory(client, definition, cemeteryIds)],
  ["maintenance-needs", runMaintenanceNeeds],
  ["deed-claim-trace-guide", (_client, definition, parameters) => runDeedClaimTraceGuide(definition, parameters)],
]);

export function listReportsForUser(user) {
  return reportDefinitions.filter((definition) => canRun(user?.role, definition.requiredRole)).map(toDefinition);
}

export async function runReport(pool, reportId, parameters = {}, user) {
  const definition = definitionById(reportId);
  const runner = reportRunners.get(reportId);
  if (!definition || !runner) {
    const error = new Error(`Unsupported report: ${reportId}.`);
    error.code = "REPORT_NOT_FOUND";
    throw error;
  }
  if (!canRun(user?.role, definition.requiredRole)) {
    const error = new Error("Forbidden");
    error.code = "REPORT_FORBIDDEN";
    throw error;
  }
  const cemeteryIds = selectedReportCemeteryIds(user, parameters);

  const client = await pool.connect();
  try {
    return await runner(client, definition, parameters, cemeteryIds);
  } finally {
    client.release();
  }
}
