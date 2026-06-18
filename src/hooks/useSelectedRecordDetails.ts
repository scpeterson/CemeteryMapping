import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGraveSpace, fetchHeadstone } from "../api/cemeteryApi";
import type { GraveSpace, GraveSpaceSummary, Headstone, HeadstoneSummary, Owner } from "../types";

type UseSelectedRecordDetailsInput = {
  selectedGrave?: GraveSpaceSummary;
  selectedHeadstone?: HeadstoneSummary;
};

export function useSelectedRecordDetails({ selectedGrave, selectedHeadstone }: UseSelectedRecordDetailsInput) {
  const [selectedGraveDetails, setSelectedGraveDetails] = useState<GraveSpace>();
  const [selectedHeadstoneDetails, setSelectedHeadstoneDetails] = useState<Headstone>();
  const [selectedGraveOwners, setSelectedGraveOwners] = useState<Owner[]>([]);
  const [detailError, setDetailError] = useState<string>();
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailRequest, setDetailRequest] = useState({ version: 0, preserveCurrent: false });
  const selectionKey = useMemo(() => {
    if (selectedHeadstone) return `headstone:${selectedHeadstone.id}`;
    if (selectedGrave) return `grave:${selectedGrave.cemeteryId}:${selectedGrave.id}`;
    return "";
  }, [selectedGrave, selectedHeadstone]);
  const previousSelectionKey = useRef("");

  useEffect(() => {
    const isSameSelection = previousSelectionKey.current === selectionKey;
    previousSelectionKey.current = selectionKey;
    const shouldPreserveCurrent = detailRequest.preserveCurrent && isSameSelection;
    if (!shouldPreserveCurrent) {
      setSelectedGraveDetails(undefined);
      setSelectedHeadstoneDetails(undefined);
      setSelectedGraveOwners([]);
    }
    setDetailError(undefined);

    if (selectedHeadstone) {
      let isCurrent = true;
      setIsDetailLoading(true);

      fetchHeadstone(selectedHeadstone.id)
        .then((detail) => {
          if (!isCurrent) return;
          setSelectedHeadstoneDetails(detail);
        })
        .catch((error: unknown) => {
          if (!isCurrent) return;
          setDetailError(error instanceof Error ? error.message : "Unable to load marker details");
        })
        .finally(() => {
          if (isCurrent) setIsDetailLoading(false);
        });

      return () => {
        isCurrent = false;
      };
    }

    if (!selectedGrave) {
      setIsDetailLoading(false);
      return;
    }

    let isCurrent = true;
    setIsDetailLoading(true);

    fetchGraveSpace(selectedGrave.cemeteryId, selectedGrave.id)
      .then((detail) => {
        if (!isCurrent) return;
        setSelectedGraveDetails(detail);
        setSelectedGraveOwners(detail.owners);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        setDetailError(error instanceof Error ? error.message : "Unable to load grave details");
      })
      .finally(() => {
        if (isCurrent) setIsDetailLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedGrave, selectedHeadstone, selectionKey, detailRequest]);

  return {
    selectedGraveDetails,
    setSelectedGraveDetails,
    selectedHeadstoneDetails,
    setSelectedHeadstoneDetails,
    selectedGraveOwners,
    detailError,
    isDetailLoading,
    refreshDetails: ({ preserveCurrent = false } = {}) => setDetailRequest((current) => ({ version: current.version + 1, preserveCurrent })),
  };
}
