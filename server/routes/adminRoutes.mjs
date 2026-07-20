import { validateUuid } from "../inputValidation.mjs";
import { validateMutationReason } from "../requestValidation.mjs";
import {
  validateAdminUserPayload, validateAuth0UserResolutionPayload, validateBulkGravesiteLotPayload,
  validateBulkHeadstoneUpdatePayload, validateBulkNorthHillsNotePayload,
  validateBulkNorthHillsReviewedPayload, validateCemeteryTextPayload,
  validateDeedInvestigationCaseActionPayload, validateDeedInvestigationCaseLinkPayload,
  validateDeedInvestigationCasePayload, validateLookupPayload, validateLookupTable,
  validateLotTextPayload, validateNorthHillsEntryPayload, validateNorthHillsEvidencePayload,
  validateNorthHillsEvidenceTargetPayload, validateNorthHillsSourceFactPromotionPayload,
  validateNorthHillsSourceFactReviewPayload, validateSectionTextPayload,
  validateSourcePersonRecordPayload,
} from "./adminRouteValidation.mjs";
import { registerAdminGovernanceRoutes } from "./adminGovernanceRoutes.mjs";
import { registerAdminOperationsRoutes } from "./adminOperationsRoutes.mjs";
import { registerAdminReviewRoutes } from "./adminReviewRoutes.mjs";
import { registerAdminUserRoutes } from "./adminUserRoutes.mjs";

export function registerAdminRoutes(app, context) {
  const routeContext = {
    ...context,
    validateAdminUserPayload,
    validateAuth0UserResolutionPayload,
    validateBulkGravesiteLotPayload,
    validateBulkHeadstoneUpdatePayload,
    validateBulkNorthHillsNotePayload,
    validateBulkNorthHillsReviewedPayload,
    validateCemeteryTextPayload,
    validateDeedInvestigationCaseActionPayload,
    validateDeedInvestigationCaseLinkPayload,
    validateDeedInvestigationCasePayload,
    validateLookupPayload,
    validateLookupTable,
    validateLotTextPayload,
    validateMutationReason,
    validateNorthHillsEntryPayload,
    validateNorthHillsEvidencePayload,
    validateNorthHillsEvidenceTargetPayload,
    validateNorthHillsSourceFactPromotionPayload,
    validateNorthHillsSourceFactReviewPayload,
    validateSectionTextPayload,
    validateSourcePersonRecordPayload,
    validateUuid,
  };

  registerAdminUserRoutes(app, routeContext);
  registerAdminGovernanceRoutes(app, routeContext);
  registerAdminOperationsRoutes(app, routeContext);
  registerAdminReviewRoutes(app, routeContext);
}
