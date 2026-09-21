import type { Dispatch, SetStateAction } from "react";
import type { CemeteryData, GraveSpace, GraveSpaceSummary, Headstone, HeadstoneSummary } from "../types";

export type RecordMutationContext = {
  selectedGrave?: GraveSpaceSummary;
  selectedHeadstone?: HeadstoneSummary;
  setSelectedGrave: Dispatch<SetStateAction<GraveSpaceSummary | undefined>>;
  setData: Dispatch<SetStateAction<CemeteryData>>;
  setSelectedGraveDetails: Dispatch<SetStateAction<GraveSpace | undefined>>;
  setSelectedHeadstoneDetails: Dispatch<SetStateAction<Headstone | undefined>>;
  refreshDetails: (options?: { preserveCurrent?: boolean }) => void;
};
