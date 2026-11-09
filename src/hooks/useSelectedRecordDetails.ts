import { useEffect, useRef, useState } from "react";
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
  // Summary edits may replace objects without changing the selected record.
  // Marker selection takes precedence over a simultaneously selected gravesite.
  const headstoneId = selectedHeadstone?.id;
  const graveId = selectedHeadstone ? undefined : selectedGrave?.id;
  const cemeteryId = selectedHeadstone ? undefined : selectedGrave?.cemeteryId;
  const selectionKey = headstoneId !== undefined ? `headstone:${headstoneId}`
    : graveId !== undefined ? `grave:${cemeteryId}:${graveId}` : "";
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

    if (headstoneId !== undefined) {
      const controller = new AbortController();
      setIsDetailLoading(true);

      fetchHeadstone(headstoneId, controller.signal)
        .then((detail) => {
          if (controller.signal.aborted) return;
          setSelectedHeadstoneDetails(detail);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setDetailError(error instanceof Error ? error.message : "Unable to load marker details");
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsDetailLoading(false);
        });

      return () => {
        controller.abort();
      };
    }

    if (graveId === undefined || cemeteryId === undefined) {
      setIsDetailLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsDetailLoading(true);

    fetchGraveSpace(cemeteryId, graveId, controller.signal)
      .then((detail) => {
        if (controller.signal.aborted) return;
        setSelectedGraveDetails(detail);
        setSelectedGraveOwners(detail.owners);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDetailError(error instanceof Error ? error.message : "Unable to load grave details");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsDetailLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [graveId, cemeteryId, headstoneId, selectionKey, detailRequest]);

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
