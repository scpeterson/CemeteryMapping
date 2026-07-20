import { validateUuid } from "../inputValidation.mjs";
import {
  validateCemeteryId, validateGraveSpaceId, validateMutationReason, validateSearchQuery, validateStatuses,
} from "../requestValidation.mjs";
import {
  validateBurialPayload, validateCreateHeadstonePayload, validateGraveFeaturePayload,
  validateGraveSpacePayload, validateHeadstonePayload, validateHeadstoneRelationshipPayload,
  validateMaintenanceRecordPayload, validateOwnershipEventPayload, validateReportParameters,
  validateReportQueryPayload, validateReportRunPayload,
} from "./cemeteryRouteValidation.mjs";
import { registerGraveRoutes } from "./graveRoutes.mjs";
import { registerHeadstoneRoutes } from "./headstoneRoutes.mjs";
import { registerReportRoutes } from "./reportRoutes.mjs";
import { registerSystemRoutes } from "./systemRoutes.mjs";

export function registerCemeteryRoutes(app, context) {
  const routeContext = {
    ...context,
    validateBurialPayload,
    validateCemeteryId,
    validateCreateHeadstonePayload,
    validateGraveFeaturePayload,
    validateGraveSpaceId,
    validateGraveSpacePayload,
    validateHeadstonePayload,
    validateHeadstoneRelationshipPayload,
    validateMaintenanceRecordPayload,
    validateMutationReason,
    validateOwnershipEventPayload,
    validateReportParameters,
    validateReportQueryPayload,
    validateReportRunPayload,
    validateSearchQuery,
    validateStatuses,
    validateUuid,
  };

  registerSystemRoutes(app, routeContext);
  registerGraveRoutes(app, routeContext);
  registerReportRoutes(app, routeContext);
  registerHeadstoneRoutes(app, routeContext);
}
