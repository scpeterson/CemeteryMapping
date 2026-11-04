import type { CurrentUser } from "../types";
export function roleForCemetery(user: CurrentUser | undefined, id?: string) {
  if (user?.role === "admin") return "admin";
  return user?.cemeteryMemberships?.find(entry => entry.cemeteryId === id)?.role
    ?? (id && user?.assignedCemeteryIds.includes(id) && !user.cemeteryMemberships ? user.role : "reader");
}
export function selectionPermissions(user: CurrentUser | undefined, graveCemeteryId?: string, markerCemeteryId?: string) {
  const role = roleForCemetery(user, graveCemeteryId ?? markerCemeteryId);
  const canEdit = ["admin", "cemetery-admin", "power-user"].includes(role);
  return {
    canViewSelectedOwnership: canEdit,
    canUpdateSelectedHeadstones: ["admin", "cemetery-admin", "power-user"].includes(roleForCemetery(user, markerCemeteryId ?? graveCemeteryId)),
    canUpdateSelectedGravesites: canEdit,
    canUpdateSelectedBurials: canEdit,
    canManageSelectedGraveLot: user?.role === "admin" || Boolean(graveCemeteryId && ["admin", "cemetery-admin"].includes(roleForCemetery(user, graveCemeteryId))),
  };
}
