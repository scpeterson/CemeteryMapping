import type { CurrentUser } from "../types";

export function selectionPermissions(user: CurrentUser | undefined, graveCemeteryId?: string, markerCemeteryId?: string) {
  const isAdmin = user?.role === "admin";
  const canEditScope = user?.role === "power-user" || user?.role === "cemetery-admin";
  const assigned = (id?: string) => Boolean(id && user?.assignedCemeteryIds.includes(id));
  const canEdit = isAdmin || (canEditScope && (assigned(graveCemeteryId) || assigned(markerCemeteryId)));
  return {
    canViewSelectedOwnership: isAdmin || (canEditScope && assigned(graveCemeteryId ?? markerCemeteryId)),
    canUpdateSelectedHeadstones: canEdit,
    canUpdateSelectedGravesites: canEdit,
    canUpdateSelectedBurials: canEdit,
    canManageSelectedGraveLot: isAdmin || (user?.role === "cemetery-admin" && assigned(graveCemeteryId)),
  };
}
