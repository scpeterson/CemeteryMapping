import { updateGraveSpaceMutation } from "./cemeteryGraveMutations.mjs";
import { loadDetailedGrave } from "./cemeteryGraveQueries.mjs";
import { selectHeadstoneById } from "./cemeteryHeadstoneQueries.mjs";
import { toHeadstone } from "./cemeteryMappers.mjs";

export { createOwnershipEvent } from "./cemeteryOwnershipMutations.mjs";
export { createGraveFeature, softDeleteGraveFeature, updateGraveFeature } from "./cemeteryFeatureMutations.mjs";
export { createMaintenanceRecord, updateMaintenanceRecord } from "./cemeteryMaintenanceMutations.mjs";
export { updateBurial } from "./cemeteryBurialMutations.mjs";
export { restoreGraveSpace, softDeleteGraveSpace } from "./cemeteryGraveMutations.mjs";
export { listHeadstoneLookupOptions } from "./cemeteryLookupQueries.mjs";
export { getCemeteryData, getDetailedCemeteryData } from "./cemeteryMapResponses.mjs";
export { createHeadstoneForGrave, updateHeadstone } from "./cemeteryHeadstoneMutations.mjs";
export {
  createHeadstoneRelationship,
  softDeleteHeadstoneRelationship,
  updateHeadstoneRelationship,
} from "./cemeteryHeadstoneRelationshipMutations.mjs";


export async function getGraveSpace(pool, cemeteryId, gravesiteId, { includeOwnership = true } = {}) {
  const client = await pool.connect();
  try {
    return await loadDetailedGrave(client, cemeteryId, gravesiteId, includeOwnership);
  } finally {
    client.release();
  }
}

export async function updateGraveSpace(pool, cemeteryId, gravesiteId, graveSpace, options = {}) {
  return await updateGraveSpaceMutation(pool, cemeteryId, gravesiteId, graveSpace, options, loadDetailedGrave);
}

export async function getHeadstone(pool, id) {
  const client = await pool.connect();
  try {
    const headstone = await selectHeadstoneById(client, id);
    return headstone ? toHeadstone(headstone) : undefined;
  } finally {
    client.release();
  }
}
