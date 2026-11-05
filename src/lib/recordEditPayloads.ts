import type { Burial, Headstone, LookupOption, SaveBurialInput, SaveHeadstoneInput } from "../types";
import { editableMarkerFaces } from "./markerFaces";

export function burialEditPayload(burial: Burial): SaveBurialInput {
  return {
    expectedVersion: burial.version,
    firstName: burial.person.firstName,
    givenNameStatus: burial.person.givenNameStatus ?? (burial.person.firstName.trim() ? "recorded" : "unknown"),
    displayName: burial.person.displayName ?? "",
    lastName: burial.person.lastName === "Unknown" ? "" : burial.person.lastName,
    maidenName: burial.person.maidenName ?? "",
    namePrefix: burial.person.namePrefix ?? "",
    nameSuffix: burial.person.nameSuffix ?? "",
    birthDate: burial.person.birthDate ?? "",
    deathDate: burial.person.deathDate ?? "",
    birthPlaceId: burial.birthPlace?.id ?? "",
    deathPlaceId: burial.deathPlace?.id ?? "",
    burialDate: burial.burialDate ?? "",
    intermentType: burial.intermentType ?? "unknown",
    recordStatusCode: burial.recordStatusCode ?? "interred",
    funeralHome: burial.funeralHome ?? "",
    sourceUrl: burial.sourceUrl ?? "",
    veteran: burial.veteran ?? false,
    militaryUnit: burial.militaryUnit ?? "",
    militaryBranchCode: burial.militaryBranchCode ?? "",
    militaryRankCode: burial.militaryRankCode ?? "",
    militaryWarServiceCode: burial.militaryWarServiceCode ?? "",
    militaryDecorationCodes: (burial.militaryDecorations ?? []).map((decoration) => decoration.code),
    militaryEnlistedDate: burial.militaryEnlistedDate ?? "",
    militaryDischargedDate: burial.militaryDischargedDate ?? "",
    notes: burial.recordNotes ?? "",
    dataConfidence: burial.dataConfidence ?? "unknown",
    reviewStatus: burial.reviewStatus ?? "unreviewed",
    reviewNotes: burial.reviewNotes ?? "",
    sourceConflict: burial.sourceConflict ?? false,
    reason: "Burial detail update",
  };
}

export function markerEditPayload(headstone: Headstone, markerTypeOptions?: LookupOption[], cemeteryName = ""): SaveHeadstoneInput {
  const markerTypeId = markerTypeOptions?.some((option) => option.id === headstone.markerType.id) ? headstone.markerType.id : (markerTypeOptions?.[0]?.id ?? headstone.markerType.id);
  const isTrinity = cemeteryName === "Trinity Lutheran Church Cemetery";

  return {
    expectedVersion:headstone.version,
    newInspections: [],
    markerTypeId,
    markerScopeId: headstone.markerScope.id,
    materialId: headstone.material.id,
    conditionId: headstone.condition.id,
    vaseTypeId: headstone.vaseType?.id ?? "",
    vaseMaterialId: headstone.vaseMaterial?.id ?? "",
    vasePlacementId: headstone.vasePlacement?.id ?? "",
    vaseNotes: headstone.vaseNotes ?? "",
    conditionNotes: headstone.conditionNotes ?? "",
    inscription: headstone.inscription ?? "",
    currentLegibility: headstone.currentLegibility,
    historicalTranscriptions: headstone.historicalTranscriptions,
    faces: editableMarkerFaces(headstone),
    facesRevision: headstone.facesRevision ?? 0,
    designNotes: headstone.designNotes ?? "",
    photoUrl: headstone.photoUrl ?? "",
    lastInspectedAt: headstone.lastInspectedAt ?? "",
    dataConfidence: headstone.dataConfidence ?? "unknown",
    reviewStatus: headstone.reviewStatus ?? "unreviewed",
    reviewNotes: headstone.reviewNotes ?? "",
    sourceConflict: headstone.sourceConflict ?? false,
    nhgInclusion: !headstone.nhgInclusionRecorded && isTrinity ? "listed" : (headstone.nhgInclusion ?? "not_checked"),
    provenanceVerificationSource: headstone.provenanceVerificationSource ?? "manual_review",
    provenanceVerifiedAt: headstone.provenanceVerifiedAt ?? "",
    orientationBearingDegrees: headstone.orientationBearingDegrees ?? "",
    applyNhgInclusionToBurials: false,
    reason: "Headstone detail update",
  };
}
